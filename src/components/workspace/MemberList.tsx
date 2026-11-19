"use client";

import type { WorkspaceMember } from "@shared/types";
import { useId } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useWorkspacePresence } from "./WorkspacePresenceContext";

export interface MemberListProps {
  members: WorkspaceMember[];
  showHeader?: boolean;
}

function sortMembers(members: WorkspaceMember[]): WorkspaceMember[] {
  return [...members].sort((left, right) => {
    if (left.isOwner !== right.isOwner) return left.isOwner ? -1 : 1;
    return left.username.localeCompare(right.username, "tr");
  });
}

function MemberRow({
  member,
  online,
}: {
  member: WorkspaceMember;
  online: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[color:var(--elevated)]">
      <span className="relative shrink-0">
        <Avatar name={member.username} size="sm" />
        <span
          aria-hidden="true"
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--surface)]",
            online ? "bg-[color:var(--success)]" : "bg-[color:var(--muted)]",
          )}
        />
      </span>

      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="min-w-0 truncate text-sm text-[color:var(--text)]">
          {member.username}
        </span>
        {member.isOwner ? (
          <span
            aria-label="Sunucu sahibi"
            className="shrink-0 text-xs"
            role="img"
            title="Sunucu sahibi"
          >
            👑
          </span>
        ) : null}
        {member.isGuest ? (
          <span className="shrink-0 rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[color:var(--muted)]">
            Misafir
          </span>
        ) : null}
      </span>
    </li>
  );
}

function MemberGroup({
  headingId,
  label,
  members,
  online,
  emptyCopy,
}: {
  headingId: string;
  label: string;
  members: WorkspaceMember[];
  online: boolean;
  emptyCopy: string;
}) {
  return (
    <section aria-labelledby={headingId} className="mb-5 last:mb-0">
      <h3
        className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]"
        id={headingId}
      >
        <span>{label}</span>
        <span className="font-normal normal-case tracking-normal">
          {members.length}
        </span>
      </h3>
      {members.length > 0 ? (
        <ul className="space-y-0.5">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} online={online} />
          ))}
        </ul>
      ) : (
        <p className="px-2 py-1 text-xs leading-5 text-[color:var(--muted)]">
          {emptyCopy}
        </p>
      )}
    </section>
  );
}

export function MemberList({ members, showHeader = true }: MemberListProps) {
  const { onlineUserIds } = useWorkspacePresence();
  const idPrefix = useId();

  const onlineMembers = sortMembers(
    members.filter((member) => onlineUserIds.has(member.id)),
  );
  const offlineMembers = sortMembers(
    members.filter((member) => !onlineUserIds.has(member.id)),
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[color:var(--surface)]">
      {showHeader ? (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-3">
          <Icon name="users" size={16} />
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Üyeler</h2>
          <span className="text-xs text-[color:var(--muted)]">{members.length}</span>
        </header>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <MemberGroup
          emptyCopy="Henüz çevrimiçi kimse yok."
          headingId={`${idPrefix}-online`}
          label="Çevrimiçi"
          members={onlineMembers}
          online
        />
        <MemberGroup
          emptyCopy="Çevrimdışı üye yok."
          headingId={`${idPrefix}-offline`}
          label="Çevrimdışı"
          members={offlineMembers}
          online={false}
        />
      </div>
    </div>
  );
}
