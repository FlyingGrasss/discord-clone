import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getSessionUser } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meydan — Topluluğun için sade bir mekân",
  description:
    "Sunucunu kur, kanallarını aç, arkadaşlarınla aynı anda sohbet et. Türkçe topluluklar için sade, gerçek zamanlı sohbet.",
};

const features: Array<{ icon: IconName; title: string; detail: string }> = [
  {
    icon: "message-circle",
    title: "Gerçek zamanlı sohbet",
    detail: "Kanallarda aynı anda konuş, mesajların anında ulaşsın.",
  },
  {
    icon: "hash",
    title: "Kanallar ve davet bağlantıları",
    detail: "Konuları kanallara ayır, tek bağlantıyla arkadaşlarını çağır.",
  },
  {
    icon: "sun",
    title: "Karanlık ve aydınlık tema",
    detail: "Göz yormayan bir arayüz; tercihini sen seç.",
  },
];

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
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

        <nav aria-label="Ana menü" className="flex items-center gap-2">
          {user ? (
            <Link
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--muted)] hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] sm:inline-flex"
              href="/sunucular"
            >
              Sunucularına git
            </Link>
          ) : (
            <Link
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--muted)] hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] sm:inline-flex"
              href="/giris"
            >
              Giriş yap
            </Link>
          )}
          <ThemeToggle />
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24 lg:pt-12">
        <section aria-labelledby="hero-title">
          <p className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted)]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]"
            />
            Türkçe topluluklar için
          </p>

          <h1
            className="mt-5 text-4xl font-bold tracking-tight text-[color:var(--text)] sm:text-5xl"
            id="hero-title"
          >
            Meydan
          </h1>
          <p className="mt-3 max-w-xl text-xl font-semibold leading-8 text-[color:var(--text)] sm:text-2xl">
            Topluluğun için sade bir mekân.
          </p>
          <p className="mt-4 max-w-xl text-base leading-7 text-[color:var(--muted)]">
            Sunucunu kur, kanallarını aç, arkadaşlarınla aynı anda sohbet et.
          </p>

          <ul className="mt-8 max-w-xl space-y-3">
            {features.map((feature) => (
              <li className="flex items-start gap-3" key={feature.title}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--accent)]">
                  <Icon name={feature.icon} size={16} />
                </span>
                <div>
                  <p className="text-sm font-medium text-[color:var(--text)]">
                    {feature.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-[color:var(--muted)]">
                    {feature.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {user ? (
              <Link className={buttonClasses("primary", "md")} href="/sunucular">
                Sunucularına git
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <>
                <Link className={buttonClasses("primary", "md")} href="/kayit">
                  Hesap oluştur
                  <Icon name="arrow-right" size={16} />
                </Link>
                <Link className={buttonClasses("secondary", "md")} href="/giris">
                  Giriş yap
                </Link>
                <Link
                  className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-medium text-[color:var(--muted)] underline-offset-4 hover:text-[color:var(--text)] hover:underline"
                  href="/misafir"
                >
                  Misafir olarak dene
                </Link>
              </>
            )}
          </div>
        </section>

        <div
          aria-hidden="true"
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
        >
          <div className="flex items-center gap-3 rounded-lg bg-[color:var(--elevated)] p-3">
            <Avatar color="#5865f2" emoji="💬" name="Meydan" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[color:var(--text)]">
                Meydan
              </p>
              <p className="text-xs text-[color:var(--muted)]">Topluluk sunucusu</p>
            </div>
            <span className="ml-auto rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] text-[color:var(--muted)]">
              Çevrimiçi
            </span>
          </div>

          <div className="mt-3 space-y-0.5">
            <p className="flex items-center gap-2 rounded-md bg-[color:var(--accent-soft)] px-2 py-1.5 text-sm font-medium text-[color:var(--text)]">
              <Icon name="hash" size={15} />
              genel
            </p>
            <p className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[color:var(--muted)]">
              <Icon name="hash" size={15} />
              tanışma
            </p>
            <p className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[color:var(--muted)]">
              <Icon name="hash" size={15} />
              duyurular
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-[color:var(--border)] px-3 py-2.5 text-xs text-[color:var(--muted)]">
            Mesajlar anında burada.
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-[color:var(--muted)] sm:px-6">
        Meydan · Türkçe topluluklar için.
      </footer>
    </div>
  );
}
