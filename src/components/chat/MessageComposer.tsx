"use client";

import { MESSAGE_MAX_LENGTH } from "@shared/constants";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export interface ReplyTarget {
  id: number;
  username: string;
}

export interface MessageComposerProps {
  channelName: string;
  value: string;
  onValueChange: (value: string) => void;
  onSend: () => void;
  onTyping: () => void;
  onCancelReply: () => void;
  disabled: boolean;
  connectionMessage: string | null;
  replyTarget: ReplyTarget | null;
}

export function MessageComposer({
  channelName,
  value,
  onValueChange,
  onSend,
  onTyping,
  onCancelReply,
  disabled,
  connectionMessage,
  replyTarget,
}: MessageComposerProps) {
  const inputId = useId();
  const hintId = useId();
  const statusId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="w-full">
      {replyTarget ? (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--elevated)] px-3 py-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate text-[color:var(--muted)]">
            Yanıtlanıyor:{" "}
            <span className="font-medium text-[color:var(--text)]">
              @{replyTarget.username}
            </span>
          </span>
          <button
            aria-label="Yanıtı iptal et"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--text)]"
            onClick={onCancelReply}
            type="button"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "flex w-full items-end gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--elevated)] px-3 py-2 transition-colors focus-within:border-[color:var(--focus)]",
          disabled && "opacity-70",
        )}
      >
        <label className="sr-only" htmlFor={inputId}>
          {`#${channelName} kanalına mesaj`}
        </label>
        <textarea
          ref={textareaRef}
          aria-describedby={disabled ? statusId : hintId}
          className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-6 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)] disabled:cursor-not-allowed"
          disabled={disabled}
          id={inputId}
          maxLength={MESSAGE_MAX_LENGTH}
          name="message"
          onChange={(event) => {
            onValueChange(event.target.value);
            onTyping();
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={`#${channelName} kanalına mesaj gönder`}
          rows={1}
          spellCheck
          value={value}
        />
        <Button
          aria-label="Mesaj gönder"
          disabled={!canSend}
          onClick={onSend}
          size="sm"
          type="button"
        >
          Gönder
        </Button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-[color:var(--muted)]">
        {disabled ? (
          <p className="min-w-0 truncate" id={statusId} role="status">
            {connectionMessage}
          </p>
        ) : (
          <p className="min-w-0 truncate" id={hintId}>
            Enter ile gönder · Shift+Enter ile yeni satır
          </p>
        )}
        {value.length > 1800 ? (
          <span className="shrink-0 tabular-nums">
            {value.length}/{MESSAGE_MAX_LENGTH}
          </span>
        ) : null}
      </div>
    </div>
  );
}
