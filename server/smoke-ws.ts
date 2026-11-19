import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { SESSION_COOKIE_NAME } from "../shared/constants.js";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol.js";
import type {
  AuthResponse,
  MessagePage,
  RealtimeTicketDto,
  WorkspaceDto,
} from "../shared/types.js";
import { createContext } from "./context.js";
import { startServer, type RunningServer } from "./index.js";

const TEST_ORIGIN = "http://localhost:3000";

interface ApiResult {
  status: number;
  data: unknown;
  setCookie: string | null;
  cookie: string | null;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  cookie?: string | null;
}

interface ClientHandle {
  ws: WebSocket;
  inbox: ClientInbox;
}

function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function rawDataToText(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return Buffer.from(data).toString("utf8");
}

class ClientInbox {
  readonly messages: ServerMessage[] = [];
  private readonly waiters = new Set<() => void>();

  constructor(ws: WebSocket) {
    ws.on("message", (data) => {
      try {
        this.messages.push(JSON.parse(rawDataToText(data)) as ServerMessage);
      } catch {
        return;
      }
      for (const notify of [...this.waiters]) notify();
    });
  }

  async waitFor<T extends ServerMessage["type"]>(
    type: T,
    label: string,
    predicate?: (message: Extract<ServerMessage, { type: T }>) => boolean,
    timeoutMs = 5_000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const matches = (message: ServerMessage): boolean =>
      message.type === type &&
      (predicate?.(message as Extract<ServerMessage, { type: T }>) ?? true);

    const existing = this.messages.find(matches);
    if (existing) return existing as Extract<ServerMessage, { type: T }>;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(check);
        reject(new Error(`Zaman aşımı: ${label}`));
      }, timeoutMs);

      const check = () => {
        const found = this.messages.find(matches);
        if (!found) return;
        clearTimeout(timer);
        this.waiters.delete(check);
        resolve(found as Extract<ServerMessage, { type: T }>);
      };

      this.waiters.add(check);
    });
  }
}

async function api(
  baseUrl: string,
  path: string,
  options: ApiOptions = {},
): Promise<ApiResult> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (method !== "GET" && method !== "HEAD") {
    headers["x-meydan-client"] = "web";
    headers.origin = TEST_ORIGIN;
    headers["content-type"] = "application/json";
  }

  if (options.cookie) headers.cookie = options.cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const setCookie = response.headers.get("set-cookie");
  const text = await response.text();

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    status: response.status,
    data,
    setCookie,
    cookie: setCookie ? (setCookie.split(";")[0] ?? null) : null,
  };
}

function openClient(wsUrl: string, ticket: string): Promise<ClientHandle> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}?ticket=${encodeURIComponent(ticket)}`, {
      headers: { origin: TEST_ORIGIN },
      perMessageDeflate: false,
    });
    const inbox = new ClientInbox(ws);

    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error("WebSocket açılış zaman aşımı"));
    }, 5_000);

    ws.once("open", () => {
      clearTimeout(timer);
      resolve({ ws, inbox });
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sendMessage(client: ClientHandle, message: ClientMessage): void {
  client.ws.send(JSON.stringify(message));
}

function waitForClose(ws: WebSocket, timeoutMs = 3_000): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Kapatma zaman aşımı")), timeoutMs);
    ws.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function ensureNoMessage(
  inbox: ClientInbox,
  label: string,
  predicate: (message: ServerMessage) => boolean,
  waitMs = 350,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  ensure(!inbox.messages.some(predicate), label);
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "meydan-ws-smoke-"));
  const sockets: WebSocket[] = [];
  let running: RunningServer | undefined;

  try {
    const context = createContext({
      dbPath: join(tempDir, "meydan.db"),
      allowedOrigins: [TEST_ORIGIN],
      isProduction: false,
    });
    running = await startServer({ context, port: 0, host: "127.0.0.1" });

    const baseUrl = `http://127.0.0.1:${running.port}`;
    const wsUrl = `ws://127.0.0.1:${running.port}/ws`;

    console.log("Meydan WebSocket smoke testi\n");

    const aliceRegister = await api(baseUrl, "/api/auth/register", {
      method: "POST",
      body: { username: "Alice", password: "guclu-parola-1" },
    });
    ensure(aliceRegister.status === 201, "Alice kaydı 201");
    const alice = (aliceRegister.data as AuthResponse).user;
    const aliceCookie = aliceRegister.cookie ?? "";
    ensure(
      aliceCookie.startsWith(`${SESSION_COOKIE_NAME}=`),
      "Alice oturum çerezi aldı",
    );

    const bobRegister = await api(baseUrl, "/api/auth/register", {
      method: "POST",
      body: { username: "bob", password: "bob-parola-123" },
    });
    ensure(bobRegister.status === 201, "Bob kaydı 201");
    const bob = (bobRegister.data as AuthResponse).user;
    const bobCookie = bobRegister.cookie ?? "";
    ensure(bobCookie.startsWith(`${SESSION_COOKIE_NAME}=`), "Bob oturum çerezi aldı");

    const createServerResponse = await api(baseUrl, "/api/servers", {
      method: "POST",
      cookie: aliceCookie,
      body: { name: "WS Test", iconEmoji: "🚀", iconColor: "#5865f2" },
    });
    ensure(createServerResponse.status === 201, "sunucu oluşturma 201");
    const workspace = (createServerResponse.data as { workspace: WorkspaceDto }).workspace;
    const serverId = workspace.id;
    const channelId = workspace.channels[0]?.id;
    ensure(typeof channelId === "string", "varsayılan kanal mevcut");

    const joinResponse = await api(
      baseUrl,
      `/api/invites/${encodeURIComponent(workspace.inviteCode)}/join`,
      { method: "POST", cookie: bobCookie },
    );
    ensure(joinResponse.status === 200, "Bob davetle sunucuya katıldı");

    const bobCreateResponse = await api(baseUrl, "/api/servers", {
      method: "POST",
      cookie: bobCookie,
      body: { name: "Bob Sunucusu", iconEmoji: "🔒", iconColor: "#eb459e" },
    });
    ensure(bobCreateResponse.status === 201, "Bob ikinci sunucuyu oluşturdu");
    const bobWorkspace = (bobCreateResponse.data as { workspace: WorkspaceDto }).workspace;
    const bobChannelId = bobWorkspace.channels[0]?.id;
    ensure(typeof bobChannelId === "string", "Bob sunucusunun kanalı mevcut");
    ensure(bobWorkspace.id !== serverId, "ikinci sunucu ayrı sunucu");

    const aliceTicketResponse = await api(baseUrl, "/api/realtime/ticket", {
      method: "POST",
      cookie: aliceCookie,
      body: { serverId },
    });
    ensure(aliceTicketResponse.status === 201, "Alice realtime bileti 201");
    const aliceTicket = (aliceTicketResponse.data as RealtimeTicketDto).ticket;
    ensure(typeof aliceTicket === "string" && aliceTicket.length > 0, "Alice bileti döndü");

    const bobTicketResponse = await api(baseUrl, "/api/realtime/ticket", {
      method: "POST",
      cookie: bobCookie,
      body: { serverId },
    });
    ensure(bobTicketResponse.status === 201, "Bob realtime bileti 201");
    const bobTicket = (bobTicketResponse.data as RealtimeTicketDto).ticket;
    ensure(typeof bobTicket === "string" && bobTicket.length > 0, "Bob bileti döndü");

    const aliceClient = await openClient(wsUrl, aliceTicket);
    sockets.push(aliceClient.ws);

    const aliceReady = await aliceClient.inbox.waitFor("ready", "Alice ready");
    ensure(aliceReady.protocolVersion === PROTOCOL_VERSION, "ready protocolVersion 1");
    ensure(aliceReady.serverId === serverId, "ready doğru sunucuya bağlı");
    ensure(aliceReady.self.id === alice.id, "ready self Alice");
    ensure(
      aliceReady.online.length === 1 && aliceReady.online[0]?.id === alice.id,
      "Alice ready online listesinde yalnız",
    );

    const bobClient = await openClient(wsUrl, bobTicket);
    sockets.push(bobClient.ws);

    const bobReady = await bobClient.inbox.waitFor("ready", "Bob ready");
    ensure(bobReady.self.id === bob.id, "Bob ready self Bob");
    ensure(bobReady.online.length === 2, "Bob ready online listesinde 2 kullanıcı");
    ensure(
      bobReady.online.some((user) => user.id === alice.id) &&
        bobReady.online.some((user) => user.id === bob.id),
      "ready online listesi iki kullanıcıyı da içeriyor",
    );

    const onlineEvent = await aliceClient.inbox.waitFor(
      "presence:online",
      "Alice presence:online",
      (message) => message.user.id === bob.id,
    );
    ensure(onlineEvent.user.id === bob.id, "Bob bağlanınca presence:online yayınlandı");

    sendMessage(aliceClient, {
      type: "message:send",
      clientId: "ws-smoke-1",
      channelId,
      content: "Merhaba Meydan",
    });

    const [aliceNew, bobNew] = await Promise.all([
      aliceClient.inbox.waitFor(
        "message:new",
        "Alice message:new",
        (message) => message.message.content === "Merhaba Meydan",
      ),
      bobClient.inbox.waitFor(
        "message:new",
        "Bob message:new",
        (message) => message.message.content === "Merhaba Meydan",
      ),
    ]);
    ensure(aliceNew.message.id === bobNew.message.id, "message:new iki istemcide aynı kimlik");
    ensure(aliceNew.message.author.id === alice.id, "message:new yazarı Alice");
    ensure(aliceNew.message.channelId === channelId, "message:new doğru kanalda");
    const firstMessageId = aliceNew.message.id;

    sendMessage(bobClient, {
      type: "message:send",
      clientId: "ws-smoke-2",
      channelId,
      content: "Merhaba, yanıt",
      replyToId: firstMessageId,
    });

    const [aliceReply, bobReply] = await Promise.all([
      aliceClient.inbox.waitFor(
        "message:new",
        "Alice reply message:new",
        (message) => message.message.replyToId === firstMessageId,
      ),
      bobClient.inbox.waitFor(
        "message:new",
        "Bob reply message:new",
        (message) => message.message.replyToId === firstMessageId,
      ),
    ]);
    ensure(aliceReply.message.id === bobReply.message.id, "yanıt iki istemcide aynı kimlik");
    ensure(aliceReply.message.content === "Merhaba, yanıt", "yanıt içeriği doğru");
    ensure(aliceReply.message.replyToId === firstMessageId, "replyToId korunuyor");

    sendMessage(aliceClient, {
      type: "reaction:toggle",
      messageId: firstMessageId,
      emoji: "👍",
    });

    const [aliceReactions, bobReactions] = await Promise.all([
      aliceClient.inbox.waitFor(
        "message:reactions",
        "Alice message:reactions",
        (message) =>
          message.messageId === firstMessageId &&
          message.reactions.some((reaction) => reaction.emoji === "👍"),
      ),
      bobClient.inbox.waitFor(
        "message:reactions",
        "Bob message:reactions",
        (message) =>
          message.messageId === firstMessageId &&
          message.reactions.some((reaction) => reaction.emoji === "👍"),
      ),
    ]);
    ensure(aliceReactions.channelId === channelId, "message:reactions doğru kanalda");
    const liked = aliceReactions.reactions.find((reaction) => reaction.emoji === "👍");
    ensure(
      liked !== undefined && liked.userIds.length === 1 && liked.userIds[0] === alice.id,
      "message:reactions Alice'in tepkisini taşıyor",
    );
    ensure(bobReactions.messageId === firstMessageId, "tepki Bob'a da yayınlandı");

    sendMessage(aliceClient, {
      type: "message:edit",
      messageId: firstMessageId,
      content: "Merhaba Meydan (düzenlendi)",
    });

    const [aliceEdited, bobEdited] = await Promise.all([
      aliceClient.inbox.waitFor(
        "message:update",
        "Alice edited message:update",
        (message) =>
          message.message.id === firstMessageId &&
          message.message.editedAt !== null &&
          message.message.deletedAt === null,
      ),
      bobClient.inbox.waitFor(
        "message:update",
        "Bob edited message:update",
        (message) =>
          message.message.id === firstMessageId &&
          message.message.editedAt !== null &&
          message.message.deletedAt === null,
      ),
    ]);
    ensure(
      aliceEdited.message.content === "Merhaba Meydan (düzenlendi)",
      "düzenleme içeriği güncellendi",
    );
    ensure(bobEdited.message.id === firstMessageId, "düzenleme Bob'a da yayınlandı");

    sendMessage(aliceClient, {
      type: "message:delete",
      messageId: firstMessageId,
    });

    const [aliceDeleted, bobDeleted] = await Promise.all([
      aliceClient.inbox.waitFor(
        "message:update",
        "Alice deleted message:update",
        (message) =>
          message.message.id === firstMessageId && message.message.deletedAt !== null,
      ),
      bobClient.inbox.waitFor(
        "message:update",
        "Bob deleted message:update",
        (message) =>
          message.message.id === firstMessageId && message.message.deletedAt !== null,
      ),
    ]);
    ensure(aliceDeleted.message.content === "", "silme tombstone içeriği boş");
    ensure(bobDeleted.message.deletedAt !== null, "silme tombstone Bob'a da yayınlandı");

    sendMessage(aliceClient, { type: "typing", channelId });

    const typingEvent = await bobClient.inbox.waitFor(
      "typing",
      "Bob typing",
      (message) => message.channelId === channelId && message.user.id === alice.id,
    );
    ensure(typingEvent.expiresAt > Date.now(), "typing 5 saniyelik son kullanma taşıyor");

    sendMessage(aliceClient, {
      type: "message:send",
      clientId: "ws-forbidden",
      channelId: bobChannelId,
      content: "yetkisiz mesaj",
    });

    const forbiddenError = await aliceClient.inbox.waitFor(
      "error",
      "cross-server authorization error",
      (message) => message.clientId === "ws-forbidden",
    );
    ensure(forbiddenError.code === "FORBIDDEN", "başka sunucunun kanalı FORBIDDEN döndürdü");

    await ensureNoMessage(
      aliceClient.inbox,
      "yetkisiz mesaj Alice'e yayınlanmadı",
      (message) =>
        message.type === "message:new" && message.message.content === "yetkisiz mesaj",
    );
    await ensureNoMessage(
      bobClient.inbox,
      "yetkisiz mesaj Bob'a yayınlanmadı",
      (message) =>
        message.type === "message:new" && message.message.content === "yetkisiz mesaj",
    );

    sendMessage(aliceClient, { type: "ping", t: 4242 });
    const pong = await aliceClient.inbox.waitFor(
      "pong",
      "pong after recoverable error",
      (message) => message.t === 4242,
    );
    ensure(pong.t === 4242, "hata sonrası socket açık kalıyor (pong)");

    const historyResponse = await api(
      baseUrl,
      `/api/channels/${encodeURIComponent(channelId)}/messages?limit=50`,
      { cookie: aliceCookie },
    );
    ensure(historyResponse.status === 200, "mesaj geçmişi 200");
    const history = historyResponse.data as MessagePage;
    const persistedFirst = history.messages.find((message) => message.id === firstMessageId);
    ensure(persistedFirst !== undefined, "geçmişte ilk mesaj var");
    ensure(
      persistedFirst.deletedAt !== null && persistedFirst.content === "",
      "geçmişte ilk mesaj tombstone olarak duruyor",
    );
    const persistedReply = history.messages.find(
      (message) => message.replyToId === firstMessageId,
    );
    ensure(
      persistedReply !== undefined && persistedReply.content === "Merhaba, yanıt",
      "geçmişte yanıt mesajı kalıcı",
    );

    const bobHistoryResponse = await api(
      baseUrl,
      `/api/channels/${encodeURIComponent(bobChannelId)}/messages`,
      { cookie: bobCookie },
    );
    ensure(bobHistoryResponse.status === 200, "Bob kanalı geçmişi 200");
    ensure(
      (bobHistoryResponse.data as MessagePage).messages.length === 0,
      "yetkisiz mesaj başka sunucuya yazılmadı",
    );

    bobClient.ws.close(1000, "smoke done");
    const offlineEvent = await aliceClient.inbox.waitFor(
      "presence:offline",
      "Alice presence:offline",
      (message) => message.userId === bob.id,
    );
    ensure(offlineEvent.userId === bob.id, "Bob kapanınca presence:offline yayınlandı");
    await waitForClose(bobClient.ws);

    aliceClient.ws.close(1000, "smoke done");
    await waitForClose(aliceClient.ws);

    console.log("\nWebSocket smoke testi başarılı.");
  } finally {
    for (const socket of sockets) {
      try {
        socket.terminate();
      } catch {
        // Already closed.
      }
    }

    if (running) {
      await running.close();
    }

    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error("\nWebSocket smoke testi başarısız:");
  console.error(error);
  process.exitCode = 1;
});
