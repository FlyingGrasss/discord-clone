import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { withNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Giriş yap",
  description: "Meydan hesabına giriş yap ve kaldığın yerden devam et.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthCard
      description="Kaldığın yerden devam et."
      footer={
        <>
          <p>
            Hesabın yok mu?{" "}
            <Link
              className="font-medium text-[color:var(--accent-text)] underline-offset-4 hover:underline"
              href={withNext("/kayit", next)}
            >
              Kayıt ol
            </Link>
          </p>
          <p>
            <Link
              className="font-medium text-[color:var(--accent-text)] underline-offset-4 hover:underline"
              href={withNext("/misafir", next)}
            >
              Şifresiz devam et: Misafir olarak gir.
            </Link>
          </p>
          <p className="text-xs leading-5">
            Misafir oturumu 24 saat sürer. Sunucu oluşturmak için hesap açabilirsin.
          </p>
        </>
      }
      title="Tekrar hoş geldin"
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
