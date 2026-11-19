import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { InviteCard } from "@/components/invite/InviteCard";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { withNext } from "@/lib/auth";
import { formatMemberCount } from "@/lib/format";
import { getInvite } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Davet",
  description: "Meydan sunucu daveti.",
  robots: { index: false, follow: false },
};

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const lookup = await getInvite(code);
  const nextPath = `/davet/${encodeURIComponent(code)}`;

  let content: React.ReactNode;

  if (lookup.status === "unauthenticated") {
    content = (
      <AuthCard
        description="Davet bağlantısı seni bekliyor. Giriş yap ya da yeni bir hesap oluştur."
        footer={
          <>
            <Link
              className={buttonClasses("primary", "md", "w-full")}
              href={withNext("/giris", nextPath)}
            >
              Giriş yap
            </Link>
            <Link
              className={buttonClasses("secondary", "md", "w-full")}
              href={withNext("/kayit", nextPath)}
            >
              Hesap oluştur
            </Link>
            <p className="text-center text-xs leading-5">
              Davet bağlantısı giriş yaptıktan sonra açılacak.
            </p>
          </>
        }
        title="Sunucuya katılmak için giriş yap."
      />
    );
  } else if (lookup.status === "not_found") {
    content = (
      <AuthCard
        description="Bu davet bağlantısı geçersiz veya sunucu artık mevcut değil."
        footer={
          <Link
            className={buttonClasses("secondary", "md", "w-full")}
            href="/"
          >
            Ana sayfaya dön
          </Link>
        }
        title="Davet bulunamadı."
      />
    );
  } else if (lookup.invite.isMember) {
    content = (
      <AuthCard
        description="Bu sunucuya daha önce katıldın."
        footer={
          <Link
            className={buttonClasses("primary", "md", "w-full")}
            href={`/sunucu/${encodeURIComponent(lookup.invite.server.id)}`}
          >
            Sunucuya git
          </Link>
        }
        title="Zaten bu sunucunun üyesisin."
      >
        <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--elevated)] p-3">
          <Avatar
            color={lookup.invite.server.iconColor}
            emoji={lookup.invite.server.iconEmoji}
            name={lookup.invite.server.name}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[color:var(--text)]">
              {lookup.invite.server.name}
            </p>
            <p className="text-xs text-[color:var(--muted)]">
              {formatMemberCount(lookup.invite.memberCount)}
            </p>
          </div>
        </div>
      </AuthCard>
    );
  } else {
    content = <InviteCard code={code} invite={lookup.invite} />;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md items-center justify-between pb-6">
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
      </div>

      {content}

      <p className="mt-6 text-xs text-[color:var(--muted)]">
        Meydan · Türkçe topluluklar için.
      </p>
    </main>
  );
}
