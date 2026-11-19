import type { ChatMessage } from "@/lib/realtime/use-channel-chat";
import { cn } from "@/lib/cn";
import { authorColor, truncatePreview } from "./chat-utils";

export interface ReplyQuoteProps {
  parent?: ChatMessage;
}

export function ReplyQuote({ parent }: ReplyQuoteProps) {
  if (!parent) {
    return (
      <div className="mb-1 flex min-w-0 items-center gap-2 border-l-2 border-[color:var(--border-strong)] pl-2 text-xs text-[color:var(--muted)]">
        <span className="truncate">Yanıtlanan mesaj görüntülenemiyor.</span>
      </div>
    );
  }

  const deleted = parent.deletedAt !== null;

  return (
    <div className="mb-1 flex min-w-0 items-center gap-2 border-l-2 border-[color:var(--border-strong)] pl-2 text-xs">
      <span
        className="shrink-0 font-medium"
        style={{ color: authorColor(parent.author.username) }}
      >
        @{parent.author.username}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-[color:var(--muted)]",
          deleted && "italic",
        )}
      >
        {deleted ? "Bu mesaj silindi." : truncatePreview(parent.content, 120)}
      </span>
    </div>
  );
}
