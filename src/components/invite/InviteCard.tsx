"use client";

import type { InvitePreview, JoinInviteResult } from "@shared/types";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ApiError, apiFetch } from "@/lib/api";
import { formatMemberCount, formatRetryAfter } from "@/lib/format";

export interface InviteCardProps {
  code: string;
  invite: InvitePreview;
}

export function InviteCard({ code, invite }: InviteCardProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextPath = `/davet/${encodeURIComponent(code)}`;

  async function handleJoin(): Promise<void> {
    if (pending) return;

    setError(null);
    setPending(true);

    try {
      const result = await apiFetch<JoinInviteResult>(
        `/api/invites/${encodeURIComponent(code)}/join`,
        { method: "POST" },
      );
      window.location.assign(`/sunucu/${encodeURIComponent(result.serverId)}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.code === "UNAUTHORIZED") {
          window.location.assign(
            `/giris?next=${encodeURIComponent(nextPath)}`,
          );
          return;
        }
        if (caught.code === "ALREADY_MEMBER") {
          window.location.assign(
            `/sunucu/${encodeURIComponent(invite.server.id)}`,
          );
          return;
        }

        setError(
          caught.retryAfterMs
            ? `${caught.message} (${formatRetryAfter(caught.retryAfterMs)})`
            : caught.message,
        );
      } else {
        setError("Bir şeyler ters gitti. Tekrar dene.");
      }
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="invite-title"
      className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-8"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
        Sunucu daveti
      </p>

      <div className="mt-5 flex items-center gap-4">
        <Avatar
          color={invite.server.iconColor}
          emoji={invite.server.iconEmoji}
          name={invite.server.name}
          size="lg"
        />
        <div className="min-w-0">
          <h1
            className="truncate text-xl font-semibold text-[color:var(--text)]"
            id="invite-title"
          >
            {invite.server.name}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[color:var(--muted)]">
            <Icon name="users" size={15} />
            {formatMemberCount(invite.memberCount)}
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-[color:var(--muted)]">
        Bu sunucuya katılarak kanallarda sohbete başlayabilirsin.
      </p>

      {error ? (
        <p
          className="mt-4 rounded-lg border border-[color:var(--danger)] bg-[color:var(--danger-soft)] px-3 py-2 text-sm leading-5 text-[color:var(--danger-text)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <Button
        className="mt-6 w-full"
        loading={pending}
        onClick={() => void handleJoin()}
        type="button"
      >
        Sunucuya katıl
      </Button>

      <p className="mt-3 text-center text-xs leading-5 text-[color:var(--muted)]">
        Katıldıktan sonra sunucunun ilk kanalına yönlendirileceksin.
      </p>
    </section>
  );
}
