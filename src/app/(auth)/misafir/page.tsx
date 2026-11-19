import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { GuestForm } from "@/components/auth/GuestForm";
import { withNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Misafir girişi",
  description: "Şifre gerekmeden bir takma adla Meydan sohbetlerine katıl.",
};

interface GuestPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function GuestPage({ searchParams }: GuestPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthCard
      description="Şifre yok. Takma adınla sohbete katıl."
      footer={
        <>
          <p>
            Hesabın var mı?{" "}
            <Link
              className="font-medium text-[color:var(--accent-text)] underline-offset-4 hover:underline"
              href={withNext("/giris", next)}
            >
              Giriş yap
            </Link>
          </p>
          <p className="text-xs leading-5">
            Misafir oturumu 24 saat sürer. Sunucu oluşturmak için hesap açabilirsin.
          </p>
        </>
      }
      title="Misafir olarak devam et"
    >
      <GuestForm next={next} />
    </AuthCard>
  );
}
