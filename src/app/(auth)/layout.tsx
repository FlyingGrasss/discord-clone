import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
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
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="px-4 py-6 text-center text-xs text-[color:var(--muted)]">
        Meydan · Türkçe topluluklar için.
      </footer>
    </div>
  );
}
