"use client";

import type {
  ChannelDto,
  ServerSummary,
  UserDto,
  WorkspaceDto,
  WorkspaceMember,
} from "@shared/types";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { ChannelSidebar } from "./ChannelSidebar";
import { MemberList } from "./MemberList";
import { ServerRail } from "./ServerRail";
import {
  WorkspacePresenceProvider,
} from "./WorkspacePresenceContext";
import { useWorkspaceUI, WorkspaceUIProvider } from "./WorkspaceUIContext";

export interface WorkspaceShellProps {
  server: WorkspaceDto;
  channels: ChannelDto[];
  members: WorkspaceMember[];
  servers: ServerSummary[];
  user: UserDto;
  isOwner: boolean;
  inviteCode: string;
  children: ReactNode;
}

function WorkspaceFrame({
  server,
  channels,
  members,
  servers,
  user,
  isOwner,
  inviteCode,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const {
    channelsOpen,
    membersOpen,
    openChannels,
    closeChannels,
    openMembers,
    closeMembers,
  } = useWorkspaceUI();

  const activeChannel =
    channels.find((channel) => {
      const href = `/sunucu/${server.id}/${channel.id}`;
      return pathname === href || pathname.startsWith(`${href}/`);
    }) ?? null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[color:var(--bg)]">
      <ServerRail servers={servers} user={user} />

      <aside className="hidden w-60 shrink-0 border-r border-[color:var(--border)] md:block">
        <ChannelSidebar
          channels={channels}
          inviteCode={inviteCode}
          isOwner={isOwner}
          server={server}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 xl:hidden">
          <button
            aria-controls="workspace-channels-drawer"
            aria-expanded={channelsOpen}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] md:hidden"
            onClick={openChannels}
            type="button"
          >
            <Icon name="hash" size={15} />
            Kanallar
          </button>

          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--text)]">
            {server.name}
            {activeChannel ? (
              <span className="text-[color:var(--muted)]">
                {" / #"}
                {activeChannel.name}
              </span>
            ) : null}
          </p>

          <button
            aria-controls="workspace-members-drawer"
            aria-expanded={membersOpen}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)]"
            onClick={openMembers}
            type="button"
          >
            <Icon name="users" size={15} />
            Üyeler
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>

          <aside className="hidden w-[220px] shrink-0 border-l border-[color:var(--border)] xl:block">
            <MemberList members={members} />
          </aside>
        </div>
      </div>

      <div id="workspace-channels-drawer">
        <Drawer
          className="max-w-[300px]"
          onOpenChange={(open) => {
            if (!open) closeChannels();
          }}
          open={channelsOpen}
          side="left"
          title={server.name}
        >
          <ChannelSidebar
            channels={channels}
            inviteCode={inviteCode}
            isOwner={isOwner}
            onNavigate={closeChannels}
            server={server}
            showServerHeader={false}
          />
        </Drawer>
      </div>

      <div id="workspace-members-drawer">
        <Drawer
          className="max-w-xs"
          description={server.name}
          onOpenChange={(open) => {
            if (!open) closeMembers();
          }}
          open={membersOpen}
          side="right"
          title="Üyeler"
        >
          <MemberList members={members} showHeader={false} />
        </Drawer>
      </div>
    </div>
  );
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <WorkspacePresenceProvider initialOnlineUserIds={[props.user.id]}>
      <WorkspaceUIProvider>
        <WorkspaceFrame {...props} />
      </WorkspaceUIProvider>
    </WorkspacePresenceProvider>
  );
}
