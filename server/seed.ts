import { openDatabase, type AppDatabase } from "./db.js";
import { resolveConfig } from "./config.js";
import { addMember, insertServer } from "./repos/servers.js";
import { insertChannel } from "./repos/channels.js";
import {
  insertMessage,
  softDeleteMessage,
  updateMessageContent,
} from "./repos/messages.js";
import { insertUser } from "./repos/users.js";
import { hashPassword } from "./services/auth.js";
import { usernameKey } from "../shared/validation.js";

const DEMO_PASSWORD = "demo1234";
const DEMO_SERVER_NAME = "RavenMUN";
const DEMO_SERVER_ID = "seed_ravenmun";
const DEMO_INVITE_CODE = "RAVENMUN";
const DEMO_INVITE_URL = "http://localhost:3000/davet/RAVENMUN";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SEED_USERNAMES = ["elif", "mert", "zeynep", "can", "selin", "burak"] as const;
type SeedUsername = (typeof SEED_USERNAMES)[number];

const USER_IDS: Record<SeedUsername, string> = {
  elif: "seed_user_elif",
  mert: "seed_user_mert",
  zeynep: "seed_user_zeynep",
  can: "seed_user_can",
  selin: "seed_user_selin",
  burak: "seed_user_burak",
};

interface ReactionSpec {
  emoji: string;
  users: SeedUsername[];
}

interface MessageSpec {
  author: SeedUsername;
  content: string;
  /** 1-based index of the replied message within the same channel. */
  replyTo?: number;
  edited?: boolean;
  deleted?: boolean;
  reactions?: ReactionSpec[];
}

interface ChannelSpec {
  id: string;
  name: string;
  position: number;
  messages: MessageSpec[];
}

const CHANNELS: ChannelSpec[] = [
  {
    id: "seed_genel",
    name: "genel",
    position: 0,
    messages: [
      {
        author: "elif",
        content:
          "RavenMUN ekibine hoş geldiniz! Bu hafta komite dağılımını netleştiriyoruz. 🦅",
        reactions: [
          { emoji: "👍", users: ["elif", "mert", "zeynep", "can"] },
          { emoji: "❤️", users: ["selin", "burak"] },
        ],
      },
      {
        author: "mert",
        content:
          "Hoş bulduk! Kayıt formunu dolduran arkadaşlar e-posta kutularını kontrol etsin.",
      },
      {
        author: "zeynep",
        content: "Cuma 19.00'da kısa bir tanışma toplantısı yapalım mı?",
      },
      { author: "can", content: "Ben varım. Kütüphane nasıl?", replyTo: 3 },
      {
        author: "selin",
        content: "Kütüphane kapalıymış, kampüs kafede buluşalım.",
      },
      {
        author: "burak",
        content: "Simit ve çay benden. ☕",
        reactions: [{ emoji: "😂", users: ["elif", "selin", "can"] }],
      },
      {
        author: "elif",
        content: "Gündem: açılış konuşmaları, komite tanıtımı, soru-cevap.",
      },
      {
        author: "mert",
        content:
          "Sunum dosyasını buraya bırakıyorum: [sunum](https://example.com/ravenmun-sunum)",
      },
      {
        author: "zeynep",
        content: "Toplantı linki: https://example.com/cuma",
        deleted: true,
      },
      {
        author: "can",
        content: "Toplantı notlarını **#genel** kanalında paylaşalım mı?",
        edited: true,
      },
      { author: "selin", content: "Ben de katılırım." },
      {
        author: "elif",
        content: "Son durum: 24 katılımcı, 6 komite.",
        reactions: [
          { emoji: "🎉", users: ["zeynep", "can", "selin", "burak", "mert"] },
        ],
      },
    ],
  },
  {
    id: "seed_yazilim",
    name: "yazilim",
    position: 1,
    messages: [
      {
        author: "mert",
        content:
          "Sohbet uygulamasının WebSocket tarafını bugün bitirdim. Mesajlar artık anlık geliyor.",
        reactions: [{ emoji: "🔥", users: ["can", "zeynep", "selin"] }],
      },
      {
        author: "can",
        content:
          "SQLite WAL modunda mı çalışıyor? Tek yazıcı olduğu için sorun çıkarmaz ama soralım.",
      },
      {
        author: "mert",
        content: "Evet, `journal_mode=WAL` ve `busy_timeout=5000` açık.",
        replyTo: 2,
      },
      {
        author: "zeynep",
        content:
          "Mesaj sırası için autoincrement id kullanıyoruz, istemcide optimistic ekleme var.",
      },
      {
        author: "selin",
        content: "Reconnect olunca son id'den sonrasını çekiyor musunuz?",
      },
      {
        author: "mert",
        content:
          "Evet, `after` parametresiyle kaçan mesajları tamamlıyoruz.",
        replyTo: 5,
      },
      {
        author: "burak",
        content:
          "Bu akşam deploy denemesi var mı? Caddy arkasında `/ws` upgrade'ini unutmayın.",
      },
      {
        author: "elif",
        content: "Docker yerine doğrudan systemd ile çalıştıracağız sanırım.",
      },
      {
        author: "can",
        content:
          "Ben `pnpm build` sonrası `next start` ve `tsx server/index.ts` ile deneyeceğim.",
      },
      {
        author: "mert",
        content: "Rate limit 5 mesaj/sn; test ederken dikkat.",
        reactions: [{ emoji: "👍", users: ["burak", "elif"] }],
      },
    ],
  },
  {
    id: "seed_offtopic",
    name: "off-topic",
    position: 2,
    messages: [
      {
        author: "selin",
        content: "Bugünün şarkısı: https://example.com/muzik",
      },
      {
        author: "burak",
        content:
          "Kedi fotoğrafı yükleyemediğimiz için link bırakıyorum: https://example.com/kedi",
      },
      {
        author: "can",
        content:
          "Bu uygulamaya dosya yükleme gelirse ilk ben deneyeceğim.",
      },
      {
        author: "zeynep",
        content: "Simit mi poğaça mı? *Bence* simit.",
        reactions: [
          { emoji: "😂", users: ["selin", "elif", "mert", "burak"] },
        ],
      },
      {
        author: "elif",
        content: "Simit, tartışmasız.",
        replyTo: 4,
        reactions: [{ emoji: "👍", users: ["zeynep", "can"] }],
      },
      { author: "mert", content: "Çay olmadan olmaz." },
      { author: "burak", content: "Akşam maç var mı?" },
      {
        author: "selin",
        content:
          "Bu akşam kod yazıyorum, maçı kaçırıyorum. Herkese iyi akşamlar! 🌙",
        reactions: [{ emoji: "❤️", users: ["elif", "mert"] }],
      },
    ],
  },
];

interface SeedCounts {
  users: number;
  servers: number;
  channels: number;
  messages: number;
  reactions: number;
}

function countRows(db: AppDatabase, table: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .get() as { count: number };
  return row.count;
}

function resetTables(db: AppDatabase): void {
  // FK-safe order; messages self-references are removed in one statement.
  db.exec(`
    DELETE FROM reactions;
    DELETE FROM messages;
    DELETE FROM channels;
    DELETE FROM server_members;
    DELETE FROM servers;
    DELETE FROM sessions;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

function insertSeedData(
  db: AppDatabase,
  passwordHashes: Map<SeedUsername, string>,
  now: number,
): void {
  const usersCreatedAt = now - 30 * DAY;
  SEED_USERNAMES.forEach((username, index) => {
    insertUser(db, {
      id: USER_IDS[username],
      username,
      usernameKey: usernameKey(username),
      email: null,
      passwordHash: passwordHashes.get(username) ?? null,
      isGuest: false,
      createdAt: usersCreatedAt + index * MINUTE,
    });
  });

  const serverCreatedAt = now - 20 * DAY;
  insertServer(db, {
    id: DEMO_SERVER_ID,
    name: DEMO_SERVER_NAME,
    iconEmoji: "🦅",
    iconColor: "#e5484d",
    ownerId: USER_IDS.elif,
    inviteCode: DEMO_INVITE_CODE,
    createdAt: serverCreatedAt,
  });

  SEED_USERNAMES.forEach((username, index) => {
    addMember(db, DEMO_SERVER_ID, USER_IDS[username], serverCreatedAt + index * MINUTE);
  });

  const insertReaction = db.prepare(
    `INSERT INTO reactions (message_id, user_id, emoji, created_at)
     VALUES (?, ?, ?, ?)`,
  );

  let messageClock = now - 4 * HOUR;
  for (const channel of CHANNELS) {
    insertChannel(db, {
      id: channel.id,
      serverId: DEMO_SERVER_ID,
      name: channel.name,
      position: channel.position,
      createdAt: serverCreatedAt + channel.position * MINUTE,
    });

    const insertedIds: number[] = [];
    for (const message of channel.messages) {
      const createdAt = messageClock;
      messageClock += 5 * MINUTE;

      const replyToId =
        message.replyTo === undefined ? null : insertedIds[message.replyTo - 1];
      if (message.replyTo !== undefined && replyToId === undefined) {
        throw new Error(
          `[seed] ${channel.name} kanalında yanıt hedefi bulunamadı: ${message.replyTo}`,
        );
      }

      const messageId = insertMessage(db, {
        channelId: channel.id,
        authorId: USER_IDS[message.author],
        content: message.content,
        replyToId: replyToId ?? null,
        clientId: null,
        createdAt,
      });
      insertedIds.push(messageId);

      if (message.edited) {
        updateMessageContent(db, messageId, message.content, createdAt + MINUTE);
      }
      if (message.deleted) {
        softDeleteMessage(db, messageId, createdAt + 2 * MINUTE);
      }

      for (const reaction of message.reactions ?? []) {
        reaction.users.forEach((username, index) => {
          insertReaction.run(
            messageId,
            USER_IDS[username],
            reaction.emoji,
            createdAt + 10_000 + index * 1_000,
          );
        });
      }
    }
  }
}

function verifySeedCounts(db: AppDatabase): SeedCounts {
  const counts: SeedCounts = {
    users: countRows(db, "users"),
    servers: countRows(db, "servers"),
    channels: countRows(db, "channels"),
    messages: countRows(db, "messages"),
    reactions: countRows(db, "reactions"),
  };

  const checks: Array<[keyof SeedCounts, boolean]> = [
    ["users", counts.users === 6],
    ["servers", counts.servers === 1],
    ["channels", counts.channels === 3],
    ["messages", counts.messages === 30],
    ["reactions", counts.reactions > 0],
  ];
  const failed = checks.find(([, ok]) => !ok);
  if (failed) {
    throw new Error(
      `[seed] Beklenen demo sayıları tutmadı: ${JSON.stringify(counts)}`,
    );
  }

  return counts;
}

function printSummary(counts: SeedCounts): void {
  console.log("[seed] Demo verisi hazır.");
  console.log(
    `[seed] Girişler (parola: ${DEMO_PASSWORD}): ${SEED_USERNAMES.join(", ")}`,
  );
  console.log(
    `[seed] Sayılar: ${counts.users} kullanıcı, ${counts.servers} sunucu, ` +
      `${counts.channels} kanal, ${counts.messages} mesaj, ${counts.reactions} tepki`,
  );
  console.log("[seed] Giriş sayfası: http://localhost:3000/giris");
  console.log(`[seed] Davet: ${DEMO_INVITE_URL}`);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const reset = args.has("--reset");
  const ifEmpty = args.has("--if-empty");
  const config = resolveConfig();

  if (reset && config.isProduction) {
    console.error("[seed] --reset üretim ortamında reddedildi.");
    process.exitCode = 1;
    return;
  }

  const db = openDatabase(config.dbPath);
  try {
    if (!reset && countRows(db, "users") > 0) {
      if (ifEmpty) {
        console.log("[seed] Kullanıcılar mevcut; --if-empty nedeniyle atlandı.");
        return;
      }
      throw new Error(
        "Veritabanında kullanıcı var. Temiz demo verisi için `pnpm seed:reset` çalıştır.",
      );
    }

    const passwordHashes = new Map<SeedUsername, string>();
    const hashes = await Promise.all(
      SEED_USERNAMES.map((username) => hashPassword(DEMO_PASSWORD)),
    );
    SEED_USERNAMES.forEach((username, index) => {
      passwordHashes.set(username, hashes[index] ?? "");
    });

    const now = Date.now();
    const counts = db.transaction(() => {
      if (reset) resetTables(db);
      insertSeedData(db, passwordHashes, now);
      return verifySeedCounts(db);
    })();

    printSummary(counts);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed] Hata: ${message}`);
  process.exitCode = 1;
});
