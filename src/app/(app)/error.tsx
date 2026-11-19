"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--danger-text)]">
        <Icon name="alert-triangle" size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold text-[color:var(--text)]">
        Sayfa yüklenemedi.
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[color:var(--muted)]">
        Sunucuya ulaşılamadı veya beklenmeyen bir hata oluştu. Tekrar denemek
        ister misin?
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} type="button">
          Tekrar dene
        </Button>
        <Link className={buttonClasses("secondary", "md")} href="/sunucular">
          Sunucularına dön
        </Link>
      </div>
    </main>
  );
}
