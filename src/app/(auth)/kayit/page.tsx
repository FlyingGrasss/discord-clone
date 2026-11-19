import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { withNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kayıt ol",
  description: "Meydan'a katıl, kullanıcı adını seç ve topluluğa karış.",
};

interface RegisterPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthCard
      description="Bir kullanıcı adı seç, topluluğa karış."
      footer={
        <p>
          Zaten hesabın var mı?{" "}
          <Link
            className="font-medium text-[color:var(--accent-text)] underline-offset-4 hover:underline"
            href={withNext("/giris", next)}
          >
            Giriş yap
          </Link>
        </p>
      }
      title="Aramıza katıl"
    >
      <RegisterForm next={next} />
    </AuthCard>
  );
}
