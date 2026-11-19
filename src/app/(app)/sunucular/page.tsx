import type { Metadata } from "next";
import Link from "next/link";
import { AccountMenu } from "@/components/workspace/AccountMenu";
import { CreateServerModal } from "@/components/workspace/CreateServerModal";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { withNext } from "@/lib/auth";
import { formatCount } from "@/lib/format";
import { getMyServers, requireUser } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sunucuların",
  description: "Meydan sunucularını görüntüle ve yeni bir sunucu oluştur.",
  robots: { index: false, follow: false },
};

const SIGN_UP_HREF = withNext("/kayit", "/sunucular");

export default async function ServersPage() {
  const [user, servers] = await Promise.all([
    requireUser("/sunucular"),
    getMyServers(),
  ]);

  const isGuest = user.isGuest;

  return (
    <div className="min-h-dvh bg-[color:var(--bg)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[color:var(--text)]"
            href="/"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent)] text-white"
            >
              <Icon name="message-circle" size={17} />
            </span>
            Meydan
          </Link>

          <AccountMenu placement="bottom" user={user} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
              Meydan
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--text)] sm:text-3xl">
              Sunucuların
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
              {servers.length > 0
                ? `${formatCount(servers.length)} sunucuda sohbete hazırsın.`
                : "Topluluğunu kurmak için ilk sunucunu oluştur."}
            </p>
          </div>

          {!isGuest ? <CreateServerModal /> : null}
        </div>

        {isGuest && servers.length > 0 ? (
          <div
            className="mt-6 flex flex-col gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
            role="note"
          >
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              <span className="font-medium text-[color:var(--text)]">
                Misafir hesaplar sunucu oluşturamaz.
              </span>{" "}
              Kendi sunucunu açmak için hesap oluştur.
            </p>
            <Link
              className={buttonClasses("secondary", "sm", "shrink-0")}
              href={SIGN_UP_HREF}
            >
              Hesap oluştur
            </Link>
          </div>
        ) : null}

        {servers.length === 0 ? (
          <EmptyState
            className="mt-8"
            description={
              isGuest
                ? "Misafir hesaplar sunucu oluşturamaz. Bir davet bağlantısıyla katılabilir veya hesap oluşturabilirsin."
                : "İlk sunucunu oluştur; kanallar aç ve arkadaşlarını davet et."
            }
            icon={isGuest ? "users" : "message-circle"}
            title="Henüz bir sunucun yok."
            action={
              isGuest ? (
                <Link className={buttonClasses("primary", "md")} href={SIGN_UP_HREF}>
                  Hesap oluştur
                </Link>
              ) : (
                <CreateServerModal />
              )
            }
          />
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <li key={server.id}>
                <Link
                  className="flex h-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--elevated)]"
                  href={`/sunucu/${encodeURIComponent(server.id)}`}
                >
                  <Avatar
                    color={server.iconColor}
                    emoji={server.iconEmoji}
                    name={server.name}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[color:var(--text)]">
                      {server.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                      {server.isOwner ? "Kurucu" : "Üye"}
                    </span>
                  </span>
                  <Icon
                    className="shrink-0 text-[color:var(--muted)]"
                    name="arrow-right"
                    size={16}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
