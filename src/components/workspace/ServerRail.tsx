"use client";

import type { ServerSummary, UserDto } from "@shared/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { AccountMenu } from "./AccountMenu";
import { CreateServerModal } from "./CreateServerModal";

export interface ServerRailProps {
  servers: ServerSummary[];
  user: UserDto;
}

export function ServerRail({ servers, user }: ServerRailProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sunucular"
      className="flex h-full w-[72px] shrink-0 flex-col items-center border-r border-[color:var(--border)] bg-[color:var(--surface)] py-3"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-2">
        <ul className="flex flex-col items-center gap-2">
          {servers.map((server) => {
            const base = `/sunucu/${server.id}`;
            const active =
              pathname === base || pathname.startsWith(`${base}/`);

            return (
              <li key={server.id}>
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={server.name}
                  className="group relative flex h-11 w-11 items-center justify-center rounded-xl"
                  href={base}
                  title={server.name}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -left-2 h-6 w-1 rounded-r-full bg-[color:var(--accent)] transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Avatar
                    className={cn(
                      "transition-shadow",
                      active
                        ? "ring-2 ring-[color:var(--accent)] ring-offset-2 ring-offset-[color:var(--surface)]"
                        : "group-hover:ring-2 group-hover:ring-[color:var(--border-strong)] group-hover:ring-offset-2 group-hover:ring-offset-[color:var(--surface)]",
                    )}
                    color={server.iconColor}
                    emoji={server.iconEmoji}
                    name={server.name}
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        <div
          aria-hidden="true"
          className="my-1 h-px w-8 shrink-0 bg-[color:var(--border)]"
        />

        <CreateServerModal
          iconOnly
          triggerClassName="h-11 w-11 rounded-xl"
          triggerLabel="Sunucu oluştur"
          triggerVariant="secondary"
        />
      </div>

      <div className="mt-3 shrink-0 border-t border-[color:var(--border)] px-2 pt-3">
        <AccountMenu placement="top" user={user} />
      </div>
    </nav>
  );
}
