"use client";

import type { ReactionEmoji, ReactionGroup } from "@shared/protocol";
import { cn } from "@/lib/cn";

export interface ReactionBarProps {
  reactions: ReactionGroup[];
  currentUserId: string;
  disabled?: boolean;
  onToggle: (emoji: ReactionEmoji) => void;
}

export function ReactionBar({
  reactions,
  currentUserId,
  disabled = false,
  onToggle,
}: ReactionBarProps) {
  const visible = reactions.filter((reaction) => reaction.userIds.length > 0);
  if (visible.length === 0) return null;

  return (
    <div aria-label="Tepkiler" className="mt-1 flex flex-wrap items-center gap-1">
      {visible.map((reaction) => {
        const own = reaction.userIds.includes(currentUserId);
        const emoji = reaction.emoji as ReactionEmoji;
        const label = own
          ? `${reaction.emoji} tepkisi, ${reaction.userIds.length} kişi, tepkin var`
          : `${reaction.emoji} tepkisi, ${reaction.userIds.length} kişi`;

        return (
          <button
            aria-label={label}
            aria-pressed={own}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50",
              own
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
            )}
            disabled={disabled}
            key={reaction.emoji}
            onClick={() => onToggle(emoji)}
            title={label}
            type="button"
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.userIds.length}</span>
          </button>
        );
      })}
    </div>
  );
}
