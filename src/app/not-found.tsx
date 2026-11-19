import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)]">
        <Icon name="message-circle" size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-[color:var(--text)]">
        Aradığın sayfa bulunamadı.
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[color:var(--muted)]">
        Bağlantı taşınmış veya hiç var olmamış olabilir.
      </p>
      <Link className={buttonClasses("primary", "md", "mt-6")} href="/">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
