"use client";

import type { ReactionEmoji, ReactionGroup } from "@shared/protocol";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/ui/Icon";
import type { ChatMessage } from "@/lib/realtime/use-channel-chat";
import { formatDayLabel, needsDaySeparator } from "./chat-utils";
import { MessageRow } from "./MessageRow";

const BOTTOM_THRESHOLD_PX = 96;

export interface MessageListProps {
  channelName: string;
  messages: ChatMessage[];
  currentUserId: string;
  reactions: Record<number, ReactionGroup[]>;
  canInteract: boolean;
  pendingEdits: Set<number>;
  pendingDeletes: Set<number>;
  onReply: (message: ChatMessage) => void;
  onEdit: (messageId: number, content: string) => boolean;
  onDelete: (message: ChatMessage) => void;
  onToggleReaction: (messageId: number, emoji: ReactionEmoji) => void;
  onRetry: (message: ChatMessage) => void;
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

function maxServerId(messages: ChatMessage[]): number {
  let result = 0;
  for (const message of messages) {
    if (message.id > result) result = message.id;
  }
  return result;
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="flex items-center gap-3 px-3 py-2 sm:px-4"
      role="separator"
    >
      <span className="h-px flex-1 bg-[color:var(--border)]" />
      <span className="text-xs font-medium text-[color:var(--muted)]">{label}</span>
      <span className="h-px flex-1 bg-[color:var(--border)]" />
    </div>
  );
}

export function MessageList({
  channelName,
  messages,
  currentUserId,
  reactions,
  canInteract,
  pendingEdits,
  pendingDeletes,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onRetry,
}: MessageListProps) {
  const mounted = useMounted();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const snapshotRef = useRef({
    maxId: maxServerId(messages),
    length: messages.length,
  });
  const [hasNew, setHasNew] = useState(false);

  const parentById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [mounted]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const snapshot = snapshotRef.current;
    const nextMaxId = maxServerId(messages);
    const grew =
      nextMaxId > snapshot.maxId || messages.length > snapshot.length;
    snapshotRef.current = { maxId: nextMaxId, length: messages.length };

    if (!grew) return;

    if (pinnedRef.current) {
      window.requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
      });
      setHasNew(false);
    } else {
      setHasNew(true);
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distance <= BOTTOM_THRESHOLD_PX;
    pinnedRef.current = atBottom;
    if (atBottom) setHasNew(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    pinnedRef.current = true;
    setHasNew(false);
  }, []);

  const rows: ReactNode[] = [];
  let previousTimestamp: number | null = null;

  for (const message of messages) {
    if (
      mounted &&
      needsDaySeparator(previousTimestamp, message.createdAt)
    ) {
      rows.push(
        <DaySeparator
          key={`day-${message.id}-${message.createdAt}`}
          label={formatDayLabel(message.createdAt)}
        />,
      );
    }

    rows.push(
      <MessageRow
        canInteract={canInteract}
        currentUserId={currentUserId}
        key={message.id}
        message={message}
        mounted={mounted}
        onDelete={onDelete}
        onEdit={onEdit}
        onReply={onReply}
        onRetry={onRetry}
        onToggleReaction={onToggleReaction}
        parent={
          message.replyToId !== null
            ? parentById.get(message.replyToId)
            : undefined
        }
        pendingDelete={pendingDeletes.has(message.id)}
        pendingEdit={pendingEdits.has(message.id)}
        reactions={reactions[message.id] ?? []}
      />,
    );

    previousTimestamp = message.createdAt;
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        aria-label={`#${channelName} mesajları`}
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
        role="log"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)]">
              <Icon name="message-circle" size={22} />
            </span>
            <p className="mt-4 text-sm font-medium text-[color:var(--text)]">
              Bu kanalda henüz mesaj yok.
            </p>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              İlk mesajı sen yaz.
            </p>
          </div>
        ) : (
          <div className="flex flex-col py-2">{rows}</div>
        )}
      </div>

      {hasNew ? (
        <button
          className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--text)] shadow-lg transition-colors hover:bg-[color:var(--elevated)]"
          onClick={scrollToBottom}
          type="button"
        >
          Yeni mesajlar
        </button>
      ) : null}
    </div>
  );
}
