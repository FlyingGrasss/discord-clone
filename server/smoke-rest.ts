import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_COOKIE_NAME } from "../shared/constants.js";
import type {
  AuthResponse,
  InvitePreview,
  JoinInviteResult,
  MessageDto,
  MessageNewEvent,
  MessagePage,
  RealtimeTicketDto,
  UserDto,
  WorkspaceDto,
} from "../shared/types.js";
import { createApp } from "./app.js";
import type { AppContext } from "./context.js";
import { createContext } from "./context.js";

const TEST_ORIGIN = "http://localhost:3000";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

interface ApiResult {
  status: number;
  data: unknown;
  setCookie: string | null;
  cookie: string | null;
  headers: Headers;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  cookie?: string | null;
  headers?: Record<string, string>;
  omitClient?: boolean;
  origin?: string | null;
  contentType?: string;
}

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function errorCode(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function cookieMaxAge(setCookie: string | null): number {
  const match = /Max-Age=(\d+)/i.exec(setCookie ?? "");
  return match ? Number(match[1]) : 0;
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "meydan-smoke-"));
  let ctx: AppContext | undefined;
  let server: Server | undefined;
  let unsubscribe: (() => void) | undefined;

  try {
    ctx = createContext({
      dbPath: join(tempDir, "meydan.db"),
      allowedOrigins: [TEST_ORIGIN],
      isProduction: false,
    });

    const app = createApp(ctx);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    async function api(path: string, options: ApiOptions = {}): Promise<ApiResult> {
      const method = options.method ?? "GET";
      const headers: Record<string, string> = { ...options.headers };

      if (method !== "GET" && method !== "HEAD") {
        headers["x-meydan-client"] = "web";
        headers.origin = TEST_ORIGIN;
        headers["content-type"] = "application/json";
      }

      if (options.cookie) headers.cookie = options.cookie;
      if (options.omitClient) delete headers["x-meydan-client"];
      if (options.contentType) headers["content-type"] = options.contentType;

      if (options.origin !== undefined) {
        if (options.origin === null) delete headers.origin;
        else headers.origin = options.origin;
      }

      const body =
        options.rawBody ??
        (options.body !== undefined ? JSON.stringify(options.body) : undefined);

      const response = await fetch(`${baseUrl}${path}`, { method, headers, body });
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
        headers: response.headers,
      };
    }

    console.log("Meydan REST smoke testi\n");

    // Database foundation
    const userVersion = ctx.db.pragma("user_version", { simple: true });
    const journalMode = ctx.db.pragma("journal_mode", { simple: true });
    const foreignKeys = ctx.db.pragma("foreign_keys", { simple: true });
    const busyTimeout = ctx.db.pragma("busy_timeout", { simple: true });
    ensure(userVersion === 1, "user_version 1");
    ensure(String(journalMode).toLowerCase() === "wal", "journal_mode WAL");
    ensure(foreignKeys === 1, "foreign_keys açık");
    ensure(busyTimeout === 5000, "busy_timeout 5000");

    const health = await api("/api/health");
    ensure(health.status === 200, "GET /api/health 200");
    ensure(
      typeof health.data === "object" &&
        health.data !== null &&
        (health.data as { ok?: unknown }).ok === true,
      "health gövdesi {ok:true}",
    );

    // Auth: register, cookie, me, logout, login
    const aliceRegister = await api("/api/auth/register", {
      method: "POST",
      body: { username: "Alice", password: "guclu-parola-1", email: "alice@example.com" },
    });
    ensure(aliceRegister.status === 201, "register 201");
    const aliceUser = (aliceRegister.data as AuthResponse).user;
    ensure(aliceUser.username === "Alice", "register kullanıcı adını koruyor");
    ensure(aliceUser.isGuest === false, "register is_guest=false");
    ensure(
      typeof aliceRegister.cookie === "string" &&
        aliceRegister.cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
      "register meydan_session çerezi verdi",
    );
    ensure(
      /HttpOnly/i.test(aliceRegister.setCookie ?? "") &&
        /SameSite=Lax/i.test(aliceRegister.setCookie ?? "") &&
        /Path=\//.test(aliceRegister.setCookie ?? ""),
      "çerez HttpOnly, SameSite=Lax, Path=/",
    );
    ensure(
      cookieMaxAge(aliceRegister.setCookie) > 29 * 24 * 60 * 60,
      "kayıtlı oturum 30 gün (Max-Age)",
    );
    ensure(
      !("password_hash" in (aliceUser as unknown as Record<string, unknown>)),
      "kullanıcı yanıtı password_hash içermiyor",
    );

    const aliceRow = ctx.db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(aliceUser.id) as { password_hash: string | null } | undefined;
    ensure(
      /^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(
        aliceRow?.password_hash ?? "",
      ),
      "parola scrypt$N$r$p$salt$hash biçiminde",
    );

    const aliceSession = ctx.db
      .prepare(
        "SELECT token_hash, expires_at, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
      )
      .get(aliceUser.id) as
      | { token_hash: string; expires_at: number; created_at: number }
      | undefined;
    ensure(
      aliceSession !== undefined &&
        aliceSession.expires_at - aliceSession.created_at === 30 * 24 * 60 * 60 * 1000,
      "kayıtlı oturum ömrü 30 gün",
    );
    ensure(
      aliceSession !== undefined && /^[0-9a-f]{64}$/.test(aliceSession.token_hash),
      "DB'de oturum belirtecinin SHA-256 özeti var",
    );
    ensure(
      aliceSession !== undefined &&
        aliceRegister.cookie !== null &&
        aliceSession.token_hash !== aliceRegister.cookie.split("=")[1],
      "DB'de düz metin belirteç yok",
    );

    let aliceCookie = aliceRegister.cookie ?? "";

    const aliceMe = await api("/api/auth/me", { cookie: aliceCookie });
    ensure(aliceMe.status === 200, "GET /auth/me 200");
    ensure((aliceMe.data as AuthResponse).user.id === aliceUser.id, "me aynı kullanıcıyı döndü");

    const meAnonymous = await api("/api/auth/me");
    ensure(meAnonymous.status === 401, "oturumsuz /auth/me 401");
    ensure(errorCode(meAnonymous.data) === "UNAUTHORIZED", "401 kodu UNAUTHORIZED");

    const meBogus = await api("/api/auth/me", {
      cookie: `${SESSION_COOKIE_NAME}=gecersiz-belirtec`,
    });
    ensure(meBogus.status === 401, "geçersiz çerez 401");

    const duplicateUsername = await api("/api/auth/register", {
      method: "POST",
      body: { username: "ALİCE", password: "baska-parola-1" },
    });
    ensure(duplicateUsername.status === 409, "Türkçe küçük harf anahtarıyla yinelenen ad 409");
    ensure(errorCode(duplicateUsername.data) === "USERNAME_TAKEN", "409 kodu USERNAME_TAKEN");

    const bobRegister = await api("/api/auth/register", {
      method: "POST",
      body: { username: "bob", password: "bob-parola-123" },
    });
    ensure(bobRegister.status === 201, "ikinci kullanıcı kaydı 201");
    const bobUser = (bobRegister.data as AuthResponse).user;
    const bobCookie = bobRegister.cookie ?? "";

    const registerLimited = await api("/api/auth/register", {
      method: "POST",
      body: { username: "carol", password: "carol-parola-1" },
    });
    ensure(registerLimited.status === 429, "register dakikada 3 istekte 429");
    ensure(errorCode(registerLimited.data) === "RATE_LIMITED", "register 429 kodu RATE_LIMITED");

    const guestRegister = await api("/api/auth/guest", {
      method: "POST",
      body: { username: "Misafir_1" },
    });
    ensure(guestRegister.status === 201, "guest 201");
    const guestUser = (guestRegister.data as AuthResponse).user;
    ensure(guestUser.isGuest === true, "guest is_guest=true");
    ensure(
      cookieMaxAge(guestRegister.setCookie) > 23 * 60 * 60,
      "misafir oturumu 24 saat (Max-Age)",
    );
    const guestCookie = guestRegister.cookie ?? "";

    const guestMe = await api("/api/auth/me", { cookie: guestCookie });
    ensure(guestMe.status === 200, "guest /auth/me 200");

    const guestServerAttempt = await api("/api/servers", {
      method: "POST",
      cookie: guestCookie,
      body: { name: "Misafir Sunucusu", iconEmoji: "👋", iconColor: "#5865f2" },
    });
    ensure(guestServerAttempt.status === 403, "misafir sunucu oluşturamaz (403)");
    ensure(
      errorCode(guestServerAttempt.data) === "GUEST_NOT_ALLOWED",
      "guest 403 kodu GUEST_NOT_ALLOWED",
    );

    const logout = await api("/api/auth/logout", {
      method: "POST",
      cookie: aliceCookie,
    });
    ensure(logout.status === 204, "logout 204");
    ensure(
      (logout.setCookie ?? "").includes(SESSION_COOKIE_NAME),
      "logout çerezi temizliyor",
    );

    const meAfterLogout = await api("/api/auth/me", { cookie: aliceCookie });
    ensure(meAfterLogout.status === 401, "logout sonrası eski oturum 401");

    const login = await api("/api/auth/login", {
      method: "POST",
      body: { username: "alice", password: "guclu-parola-1" },
    });
    ensure(login.status === 200, "login 200");
    ensure((login.data as AuthResponse).user.id === aliceUser.id, "login doğru kullanıcı");
    aliceCookie = login.cookie ?? "";
    ensure(aliceCookie.length > 0, "login yeni çerez verdi");

    // CSRF / content-type / auth negatives
    const noClientHeader = await api("/api/servers", {
      method: "POST",
      cookie: aliceCookie,
      omitClient: true,
      body: { name: "CSRF Test" },
    });
    ensure(noClientHeader.status === 403, "X-Meydan-Client yoksa 403");
    ensure(errorCode(noClientHeader.data) === "CSRF_REJECTED", "eksik başlık CSRF_REJECTED");

    const badOrigin = await api("/api/servers", {
      method: "POST",
      cookie: aliceCookie,
      origin: "http://evil.example",
      body: { name: "Origin Test" },
    });
    ensure(badOrigin.status === 403, "izin verilmeyen Origin 403");

    const wrongContentType = await api("/api/servers", {
      method: "POST",
      cookie: aliceCookie,
      contentType: "text/plain",
      body: { name: "Düz Metin" },
    });
    ensure(wrongContentType.status === 415, "text/plain gövde 415");
    ensure(
      errorCode(wrongContentType.data) === "UNSUPPORTED_MEDIA_TYPE",
      "415 kodu UNSUPPORTED_MEDIA_TYPE",
    );

    const serversAnonymous = await api("/api/servers");
    ensure(serversAnonymous.status === 401, "oturumsuz /servers 401");

    // Server creation and default channel
    const createServer = await api("/api/servers", {
      method: "POST",
      cookie: aliceCookie,
      body: { name: "Meydan Test", iconEmoji: "🚀", iconColor: "#5865f2" },
    });
    ensure(createServer.status === 201, "sunucu oluşturma 201");
    const workspace = (createServer.data as { workspace: WorkspaceDto }).workspace;
    ensure(workspace.name === "Meydan Test", "sunucu adı doğru");
    ensure(workspace.isOwner === true, "oluşturan isOwner=true");
    ensure(workspace.channels.length === 1, "varsayılan tek kanal var");
    ensure(workspace.channels[0]?.name === "genel", "varsayılan kanal #genel");
    ensure(workspace.channels[0]?.position === 0, "varsayılan kanal position 0");
    ensure(workspace.members.length === 1, "sahip tek üye");
    ensure(/^[A-Za-z0-9_-]{8}$/.test(workspace.inviteCode), "8 karakter davet kodu");

    const serverId = workspace.id;
    const genelId = workspace.channels[0]?.id ?? "";
    const inviteCode = workspace.inviteCode;

    const aliceServers = await api("/api/servers", { cookie: aliceCookie });
    ensure(
      Array.isArray((aliceServers.data as { servers?: unknown }).servers) &&
        (aliceServers.data as { servers: unknown[] }).servers.length === 1,
      "GET /servers alice için 1 sunucu",
    );

    const bobServersBefore = await api("/api/servers", { cookie: bobCookie });
    ensure(
      (bobServersBefore.data as { servers: unknown[] }).servers.length === 0,
      "bob katılmadan sunucu listesi boş",
    );

    const nonMemberServer = await api(`/api/servers/${serverId}`, { cookie: bobCookie });
    ensure(nonMemberServer.status === 404, "üye olmayan sunucu detayı 404");
    const nonMemberMessages = await api(`/api/channels/${genelId}/messages`, {
      cookie: bobCookie,
    });
    ensure(nonMemberMessages.status === 404, "üye olmayan kanal mesajları 404");

    const unknownServer = await api(`/api/servers/${MISSING_ID}`, { cookie: aliceCookie });
    ensure(unknownServer.status === 404, "bilinmeyen sunucu 404");

    // Channels
    const duyurular = await api(`/api/servers/${serverId}/channels`, {
      method: "POST",
      cookie: aliceCookie,
      body: { name: "Duyurular" },
    });
    ensure(duyurular.status === 201, "kanal oluşturma 201");
    const duyurularChannel = (duyurular.data as { channel: { id: string; name: string; position: number } })
      .channel;
    ensure(duyurularChannel.name === "duyurular", "kanal adı küçük harfe normalize edildi");
    ensure(duyurularChannel.position === 1, "ikinci kanal position 1");

    const offTopic = await api(`/api/servers/${serverId}/channels`, {
      method: "POST",
      cookie: aliceCookie,
      body: { name: "  Off Topic " },
    });
    ensure(offTopic.status === 201, "boşluklu kanal adı 201");
    const offTopicChannel = (offTopic.data as { channel: { id: string; name: string } }).channel;
    ensure(offTopicChannel.name === "off-topic", "boşluklar tireye çevrildi");

    const duplicateChannel = await api(`/api/servers/${serverId}/channels`, {
      method: "POST",
      cookie: aliceCookie,
      body: { name: "DUYURULAR" },
    });
    ensure(duplicateChannel.status === 409, "yinelenen kanal 409");
    ensure(errorCode(duplicateChannel.data) === "CHANNEL_EXISTS", "409 kodu CHANNEL_EXISTS");

    const renameChannel = await api(`/api/channels/${offTopicChannel.id}`, {
      method: "PATCH",
      cookie: aliceCookie,
      body: { name: "Sohbet" },
    });
    ensure(renameChannel.status === 200, "kanal yeniden adlandırma 200");
    ensure(
      (renameChannel.data as { channel: { name: string } }).channel.name === "sohbet",
      "kanal yeni adı sohbet",
    );

    const renameCollision = await api(`/api/channels/${offTopicChannel.id}`, {
      method: "PATCH",
      cookie: aliceCookie,
      body: { name: "duyurular" },
    });
    ensure(renameCollision.status === 409, "kanal adı çakışması 409");

    const deleteChannel = await api(`/api/channels/${offTopicChannel.id}`, {
      method: "DELETE",
      cookie: aliceCookie,
    });
    ensure(
      deleteChannel.status === 204,
      `kanal silme 204 (${deleteChannel.status} ${JSON.stringify(deleteChannel.data)})`,
    );

    // Messages via the chat service (the REST foundation only reads pages)
    const events: MessageNewEvent[] = [];
    unsubscribe = ctx.events.on("message:new", (event) => {
      events.push(event);
    });

    const createdMessages: MessageDto[] = [];
    for (let index = 1; index <= 5; index += 1) {
      createdMessages.push(
        ctx.services.chat.createMessage(aliceUser.id, genelId, {
          content: `mesaj ${index}`,
          clientId: `smoke-${index}`,
        }),
      );
    }
    ensure(createdMessages.length === 5, "chat servisi 5 mesaj yazdı");
    ensure(events.length === 5, "her mesaj için message:new olayı yayınlandı");
    ensure(
      events.every((event) => event.channelId === genelId && event.message.channelId === genelId),
      "message:new kanal kimliği taşıyor",
    );

    const idempotent = ctx.services.chat.createMessage(aliceUser.id, genelId, {
      content: "mesaj 5",
      clientId: "smoke-5",
    });
    ensure(idempotent.id === createdMessages[4]?.id, "aynı client_id aynı mesajı döndürdü");
    ensure(events.length === 5, "idempotent tekrar yeni olay üretmedi");

    const newestPage = await api(`/api/channels/${genelId}/messages?limit=2`, {
      cookie: aliceCookie,
    });
    ensure(newestPage.status === 200, "mesaj sayfası 200");
    const newest = newestPage.data as MessagePage;
    ensure(newest.messages.length === 2, "limit=2 iki mesaj");
    ensure(newest.hasMore === true, "daha eski mesaj var (hasMore)");
    ensure(
      newest.messages.map((message) => message.content).join(",") === "mesaj 4,mesaj 5",
      "en yeni sayfa kronolojik",
    );
    ensure(
      newest.messages[0] !== undefined &&
        newest.messages[1] !== undefined &&
        newest.messages[0].id < newest.messages[1].id,
      "mesaj kimlikleri artan sırada",
    );

    const beforePage = await api(
      `/api/channels/${genelId}/messages?before=${newest.messages[0]?.id}&limit=2`,
      { cookie: aliceCookie },
    );
    const before = beforePage.data as MessagePage;
    ensure(
      before.messages.map((message) => message.content).join(",") === "mesaj 2,mesaj 3",
      "before imleci eski sayfayı getirdi",
    );
    ensure(before.hasMore === true, "before sayfasında hasMore=true");

    const oldestPage = await api(
      `/api/channels/${genelId}/messages?before=${before.messages[0]?.id}&limit=2`,
      { cookie: aliceCookie },
    );
    const oldest = oldestPage.data as MessagePage;
    ensure(
      oldest.messages.map((message) => message.content).join(",") === "mesaj 1",
      "son eski sayfada tek mesaj",
    );
    ensure(oldest.hasMore === false, "son sayfada hasMore=false");

    const afterPage = await api(
      `/api/channels/${genelId}/messages?after=${newest.messages[0]?.id}&limit=10`,
      { cookie: aliceCookie },
    );
    const after = afterPage.data as MessagePage;
    ensure(
      after.messages.map((message) => message.content).join(",") === "mesaj 5",
      "after imleci yeni mesajı getirdi",
    );
    ensure(after.hasMore === false, "after sayfasında hasMore=false");

    const badLimit = await api(`/api/channels/${genelId}/messages?limit=0`, {
      cookie: aliceCookie,
    });
    ensure(badLimit.status === 400, "limit=0 400");
    ensure(errorCode(badLimit.data) === "VALIDATION_ERROR", "limit hatası VALIDATION_ERROR");

    // Realtime ticket
    const ticketResponse = await api("/api/realtime/ticket", {
      method: "POST",
      cookie: aliceCookie,
      body: { serverId },
    });
    ensure(ticketResponse.status === 201, "realtime ticket 201");
    const ticket = ticketResponse.data as RealtimeTicketDto;
    ensure(typeof ticket.ticket === "string" && ticket.ticket.length >= 32, "ticket döndü");
    ensure(ticket.expiresAt > Date.now(), "ticket 30 saniyelik gelecekte");

    const consumed = ctx.tickets.consume(ticket.ticket);
    ensure(consumed?.userId === aliceUser.id, "ticket kullanıcıya bağlı");
    ensure(consumed?.serverId === serverId, "ticket sunucuya bağlı");
    ensure(ctx.tickets.consume(ticket.ticket) === null, "ticket tek kullanımlık");

    // Invite preview and join
    const preview = await api(`/api/invites/${inviteCode}`, { cookie: bobCookie });
    ensure(preview.status === 200, "davet önizlemesi 200");
    const previewBody = preview.data as InvitePreview;
    ensure(previewBody.server.id === serverId, "önizleme doğru sunucu");
    ensure(previewBody.memberCount === 1, "önizleme üye sayısı 1");
    ensure(previewBody.isMember === false, "bob henüz üye değil");

    const unknownInvite = await api("/api/invites/doesnotexist", { cookie: bobCookie });
    ensure(unknownInvite.status === 404, "bilinmeyen davet 404");

    const joinResult = await api(`/api/invites/${inviteCode}/join`, {
      method: "POST",
      cookie: bobCookie,
    });
    ensure(joinResult.status === 200, "davete katılma 200");
    const joined = joinResult.data as JoinInviteResult;
    ensure(joined.serverId === serverId, "katılma doğru sunucu");
    ensure(joined.channelId === genelId, "katılma ilk kanalı döndürdü");
    ensure(joined.alreadyMember === false, "ilk katılmada alreadyMember=false");

    const joinAgain = await api(`/api/invites/${inviteCode}/join`, {
      method: "POST",
      cookie: bobCookie,
    });
    ensure(joinAgain.status === 409, "ikinci katılma 409");
    ensure(errorCode(joinAgain.data) === "ALREADY_MEMBER", "409 kodu ALREADY_MEMBER");

    const bobServer = await api(`/api/servers/${serverId}`, { cookie: bobCookie });
    ensure(bobServer.status === 200, "bob üye olarak sunucuyu görüyor");
    const bobWorkspace = (bobServer.data as { workspace: WorkspaceDto }).workspace;
    ensure(bobWorkspace.members.length === 2, "sunucuda 2 üye");
    ensure(bobWorkspace.isOwner === false, "bob isOwner=false");

    const bobMessages = await api(`/api/channels/${genelId}/messages`, { cookie: bobCookie });
    ensure(bobMessages.status === 200, "üye mesajları okuyabiliyor");

    const previewAfterJoin = await api(`/api/invites/${inviteCode}`, { cookie: bobCookie });
    ensure((previewAfterJoin.data as InvitePreview).isMember === true, "önizleme isMember=true");
    ensure(
      (previewAfterJoin.data as InvitePreview).memberCount === 2,
      "önizleme üye sayısı 2",
    );

    // Owner rules and leave
    const bobPatch = await api(`/api/servers/${serverId}`, {
      method: "PATCH",
      cookie: bobCookie,
      body: { name: "Bob'un Sunucusu" },
    });
    ensure(bobPatch.status === 403, "üye sunucuyu düzenleyemez (403)");

    const bobDelete = await api(`/api/servers/${serverId}`, {
      method: "DELETE",
      cookie: bobCookie,
      body: { confirmName: "Meydan Test" },
    });
    ensure(bobDelete.status === 403, "üye sunucuyu silemez (403)");

    const bobCreateChannel = await api(`/api/servers/${serverId}/channels`, {
      method: "POST",
      cookie: bobCookie,
      body: { name: "bob-kanal" },
    });
    ensure(bobCreateChannel.status === 403, "üye kanal oluşturamaz (403)");

    const bobRenameChannel = await api(`/api/channels/${duyurularChannel.id}`, {
      method: "PATCH",
      cookie: bobCookie,
      body: { name: "bob-kanal" },
    });
    ensure(bobRenameChannel.status === 403, "üye kanalı yeniden adlandıramaz (403)");

    const ownerLeave = await api(`/api/servers/${serverId}/leave`, {
      method: "POST",
      cookie: aliceCookie,
    });
    ensure(ownerLeave.status === 409, "sahip sunucudan ayrılamaz (409)");
    ensure(errorCode(ownerLeave.data) === "OWNER_CANNOT_LEAVE", "409 kodu OWNER_CANNOT_LEAVE");

    const bobLeave = await api(`/api/servers/${serverId}/leave`, {
      method: "POST",
      cookie: bobCookie,
    });
    ensure(bobLeave.status === 204, "üye sunucudan ayrıldı (204)");

    const bobServerAfterLeave = await api(`/api/servers/${serverId}`, {
      cookie: bobCookie,
    });
    ensure(bobServerAfterLeave.status === 404, "ayrılan üye sunucuyu göremez (404)");

    const bobMessagesAfterLeave = await api(`/api/channels/${genelId}/messages`, {
      cookie: bobCookie,
    });
    ensure(bobMessagesAfterLeave.status === 404, "ayrılan üye mesajları göremez (404)");

    // Last channel, rename/delete, delete confirmation
    const deleteDuyurular = await api(`/api/channels/${duyurularChannel.id}`, {
      method: "DELETE",
      cookie: aliceCookie,
    });
    ensure(deleteDuyurular.status === 204, "ikinci kanal silindi");

    const deleteLast = await api(`/api/channels/${genelId}`, {
      method: "DELETE",
      cookie: aliceCookie,
    });
    ensure(deleteLast.status === 409, "son kanal silinemez (409)");
    ensure(errorCode(deleteLast.data) === "LAST_CHANNEL", "409 kodu LAST_CHANNEL");

    const mismatchDelete = await api(`/api/servers/${serverId}`, {
      method: "DELETE",
      cookie: aliceCookie,
      body: { confirmName: "Yanlış Ad" },
    });
    ensure(mismatchDelete.status === 409, "yanlış onay adı 409");
    ensure(errorCode(mismatchDelete.data) === "NAME_MISMATCH", "409 kodu NAME_MISMATCH");

    const deleteServer = await api(`/api/servers/${serverId}`, {
      method: "DELETE",
      cookie: aliceCookie,
      body: { confirmName: "Meydan Test" },
    });
    ensure(deleteServer.status === 204, "doğru onayla sunucu silindi");

    const deletedServer = await api(`/api/servers/${serverId}`, { cookie: aliceCookie });
    ensure(deletedServer.status === 404, "silinen sunucu 404");

    const aliceServersAfter = await api("/api/servers", { cookie: aliceCookie });
    ensure(
      (aliceServersAfter.data as { servers: unknown[] }).servers.length === 0,
      "silinen sunucu listeden düştü",
    );

    // Login rate limit (last: it would block further logins for this key)
    const ghostUsername = "hayalet_kullanici";
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failed = await api("/api/auth/login", {
        method: "POST",
        body: { username: ghostUsername, password: "yanlisparola" },
      });
      ensure(failed.status === 401, `bilinmeyen kullanıcı denemesi ${attempt} → 401`);
      ensure(errorCode(failed.data) === "INVALID_CREDENTIALS", "401 kodu INVALID_CREDENTIALS");
    }

    const limited = await api("/api/auth/login", {
      method: "POST",
      body: { username: ghostUsername, password: "yanlisparola" },
    });
    ensure(limited.status === 429, "6. login denemesi 429");
    ensure(errorCode(limited.data) === "RATE_LIMITED", "login 429 kodu RATE_LIMITED");
    const limitedError = (limited.data as { error?: { retryAfterMs?: unknown } }).error;
    ensure(
      typeof limitedError?.retryAfterMs === "number" && limitedError.retryAfterMs > 0,
      "429 retryAfterMs içeriyor",
    );
    ensure(limited.headers.get("retry-after") !== null, "429 Retry-After başlığı içeriyor");

    ensure(guestUser.id !== aliceUser.id && guestUser.id !== bobUser.id, "misafir ayrı kullanıcı");
    ensure(inviteCode.length === 8, "davet kodu 8 karakter");

    console.log("\nSmoke test başarılı.");
  } finally {
    unsubscribe?.();

    if (server) {
      await new Promise<void>((resolveClose) => {
        server?.close(() => resolveClose());
        server?.closeAllConnections();
      });
    }

    ctx?.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error("\nSmoke test başarısız:");
  console.error(error);
  process.exitCode = 1;
});
