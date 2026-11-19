"use client";

import type { ChannelDto, WorkspaceDto } from "@shared/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { ChannelSettingsDialog } from "./ChannelSettingsDialog";
import { CreateChannelModal } from "./CreateChannelModal";
import { InviteDialog } from "./InviteDialog";
import { ServerSettingsDialog } from "./ServerSettingsDialog";

export interface ChannelSidebarProps {
  server: WorkspaceDto;
  channels: ChannelDto[];
  isOwner: boolean;
  inviteCode: string;
  showServerHeader?: boolean;
  onNavigate?: () => void;
}

export function ChannelSidebar({
  server,
  channels,
  isOwner,
  inviteCode,
  showServerHeader = true,
  onNavigate,
}: ChannelSidebarProps) {
  const pathname = usePathname();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);

  const activeChannel =
    channels.find((channel) => {
      const href = `/sunucu/${server.id}/${channel.id}`;
      return pathname === href || pathname.startsWith(`${href}/`);
    }) ?? null;

  const menuItems: MenuItem[] = [
    {
      id: "invite",
      label: "Davet et",
      icon: "users",
      onSelect: () => setInviteOpen(true),
    },
    ...(isOwner
      ? ([
          {
            id: "channel-settings",
            label: "Kanal ayarları",
            icon: "hash",
            disabled: !activeChannel,
            onSelect: () => setChannelSettingsOpen(true),
          },
          {
            id: "server-settings",
            label: "Sunucu ayarları",
            icon: "more-horizontal",
            onSelect: () => setServerSettingsOpen(true),
          },
        ] satisfies MenuItem[])
      : ([
          {
            id: "leave-server",
            label: "Sunucudan ayrıl",
            icon: "log-out",
            tone: "danger",
            onSelect: () => setServerSettingsOpen(true),
          },
        ] satisfies MenuItem[])),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[color:var(--surface)]">
      {showServerHeader ? (
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[color:var(--border)] px-3">
          <Avatar
            color={server.iconColor}
            emoji={server.iconEmoji}
            name={server.name}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[color:var(--text)]">
              {server.name}
            </p>
            <p className="text-xs text-[color:var(--muted)]">
              {isOwner ? "Kurucu" : "Üye"}
            </p>
          </div>
          <Menu
            align="end"
            items={menuItems}
            label="Sunucu menüsü"
            triggerClassName="h-8 w-8"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col px-2 py-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
            Kanallar
          </p>
          <div className="flex items-center gap-1">
            {!showServerHeader ? (
              <Menu
                align="end"
                items={menuItems}
                label="Sunucu menüsü"
                triggerClassName="h-8 w-8"
              />
            ) : null}
            {isOwner ? (
              <CreateChannelModal
                iconOnly
                serverId={server.id}
                triggerClassName="h-8 w-8"
                triggerLabel="Kanal oluştur"
                triggerVariant="ghost"
              />
            ) : null}
          </div>
        </div>

        <nav aria-label="Kanallar" className="mt-1 min-h-0 flex-1 overflow-y-auto">
          {channels.length > 0 ? (
            <ul className="space-y-0.5">
              {channels.map((channel) => {
                const href = `/sunucu/${server.id}/${channel.id}`;
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <li key={channel.id}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-[color:var(--accent-soft)] font-medium text-[color:var(--text)]"
                          : "text-[color:var(--muted)] hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)]",
                      )}
                      href={href}
                      onClick={onNavigate}
                    >
                      <Icon name="hash" size={15} />
                      <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 py-2 text-xs leading-5 text-[color:var(--muted)]">
              Henüz kanal yok.
            </p>
          )}
        </nav>
      </div>

      <InviteDialog
        inviteCode={inviteCode}
        onOpenChange={setInviteOpen}
        open={inviteOpen}
      />
      {activeChannel ? (
        <ChannelSettingsDialog
          channel={activeChannel}
          channels={channels}
          onOpenChange={setChannelSettingsOpen}
          open={channelSettingsOpen}
          serverId={server.id}
        />
      ) : null}
      <ServerSettingsDialog
        onOpenChange={setServerSettingsOpen}
        open={serverSettingsOpen}
        server={server}
      />
    </div>
  );
}
