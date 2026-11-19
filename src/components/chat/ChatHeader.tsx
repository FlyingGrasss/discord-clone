"use client";

import { Icon } from "@/components/ui/Icon";
import { formatMemberCount } from "@/lib/format";
import { useWorkspaceUI } from "@/components/workspace/WorkspaceUIContext";

export interface ChatHeaderProps {
  channelName: string;
  memberCount: number;
}

const headerButtonClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)]";

export function ChatHeader({ channelName, memberCount }: ChatHeaderProps) {
  const { channelsOpen, membersOpen, openChannels, openMembers } =
    useWorkspaceUI();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 sm:px-4">
      <h1 className="flex min-w-0 items-center gap-0.5 text-sm font-semibold text-[color:var(--text)]">
        <span aria-hidden="true" className="text-[color:var(--muted)]">
          #
        </span>
        <span className="truncate">{channelName}</span>
      </h1>
      <span className="hidden shrink-0 text-xs text-[color:var(--muted)] sm:inline">
        {formatMemberCount(memberCount)}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <button
          aria-controls="workspace-channels-drawer"
          aria-expanded={channelsOpen}
          className={`${headerButtonClass} md:hidden`}
          onClick={openChannels}
          type="button"
        >
          <Icon name="hash" size={15} />
          Kanallar
        </button>
        <button
          aria-controls="workspace-members-drawer"
          aria-expanded={membersOpen}
          className={`${headerButtonClass} xl:hidden`}
          onClick={openMembers}
          type="button"
        >
          <Icon name="users" size={15} />
          Üyeler
        </button>
      </div>
    </header>
  );
}
