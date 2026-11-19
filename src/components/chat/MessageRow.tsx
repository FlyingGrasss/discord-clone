"use client";

import { MESSAGE_MAX_LENGTH } from "@shared/constants";
import type { ReactionEmoji, ReactionGroup } from "@shared/protocol";
import { useEffect, useId, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/realtime/use-channel-chat";
import {
  authorColor,
  formatMessageTime,
  messageDateTime,
} from "./chat-utils";
import { ReactionBar } from "./ReactionBar";
import { ReactionPicker } from "./ReactionPicker";
import { ReplyQuote } from "./ReplyQuote";

const actionClass =
  "inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs text-[color:var(--muted)] transition-colors hover:bg-[color:var(--elevated)] hover:text-[color:var(--text)] disabled:pointer-events-none disabled:opacity-50";

export interface MessageRowProps {
  message: ChatMessage;
  parent?: ChatMessage;
  currentUserId: string;
  reactions: ReactionGroup[];
  mounted: boolean;
  canInteract: boolean;
  pendingEdit: boolean;
  pendingDelete: boolean;
  onReply: (message: ChatMessage) => void;
  onEdit: (messageId: number, content: string) => boolean;
  onDelete: (message: ChatMessage) => void;
  onToggleReaction: (messageId: number, emoji: ReactionEmoji) => void;
  onRetry: (message: ChatMessage) => void;
}

export function MessageRow({
  message,
  parent,
  currentUserId,
  reactions,
  mounted,
  canInteract,
  pendingEdit,
  pendingDelete,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onRetry,
}: MessageRowProps) {
  const editId = useId();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [editStartContent, setEditStartContent] = useState(message.content);
  const [editStartEditedAt, setEditStartEditedAt] = useState<number | null>(
    message.editedAt,
  );

  const deleted = message.deletedAt !== null;
  const own = message.author.id === currentUserId;
  const pending = message.state === "pending";
  const failed = message.state === "failed";
  const busy = pendingEdit || pendingDelete;

  useEffect(() => {
    if (!editing) return;
    if (deleted) {
      setEditing(false);
      return;
    }
    if (
      !pendingEdit &&
      (message.content !== editStartContent ||
        message.editedAt !== editStartEditedAt)
    ) {
      setEditing(false);
    }
  }, [
    deleted,
    editStartContent,
    editStartEditedAt,
    editing,
    message.content,
    message.editedAt,
    pendingEdit,
  ]);

  function startEditing(): void {
    setEditValue(message.content);
    setEditStartContent(message.content);
    setEditStartEditedAt(message.editedAt);
    setEditing(true);
  }

  function cancelEditing(): void {
    if (pendingEdit) return;
    setEditing(false);
    setEditValue(message.content);
  }

  function saveEdit(): void {
    if (pendingEdit) return;
    const content = editValue.trim();
    if (content.length === 0 || content.length > MESSAGE_MAX_LENGTH) return;
    if (content === message.content) {
      setEditing(false);
      return;
    }
    onEdit(message.id, content);
  }

  return (
    <article
      aria-label={`${message.author.username} tarafından gönderilen mesaj`}
      className="group relative flex gap-3 px-3 py-2 transition-colors hover:bg-[color:var(--elevated)]/35 sm:px-4"
      data-message-id={message.id}
    >
      <Avatar
        className="mt-0.5"
        name={message.author.username}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="text-sm font-semibold"
            style={{ color: authorColor(message.author.username) }}
          >
            {message.author.username}
          </span>
          {message.author.isGuest ? (
            <span className="rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[color:var(--muted)]">
              Misafir
            </span>
          ) : null}
          {mounted ? (
            <time
              className="text-xs text-[color:var(--muted)]"
              dateTime={messageDateTime(message.createdAt)}
            >
              {formatMessageTime(message.createdAt)}
            </time>
          ) : null}
          {message.editedAt !== null && !deleted ? (
            <span className="text-xs text-[color:var(--muted)]">(düzenlendi)</span>
          ) : null}
          {pending ? (
            <span className="text-xs text-[color:var(--muted)]">Gönderiliyor…</span>
          ) : null}
          {failed ? (
            <span className="text-xs text-[color:var(--danger-text)]">
              Gönderilemedi.
            </span>
          ) : null}

          {!deleted && !editing && !pending ? (
            <div className="ml-auto flex flex-wrap items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              {failed ? (
                <button
                  className={actionClass}
                  disabled={!canInteract}
                  onClick={() => onRetry(message)}
                  type="button"
                >
                  Tekrar dene
                </button>
              ) : null}
              <button
                aria-label={`${message.author.username} mesajını yanıtla`}
                className={actionClass}
                disabled={message.id < 0}
                onClick={() => onReply(message)}
                type="button"
              >
                Yanıtla
              </button>
              <ReactionPicker
                disabled={!canInteract || message.id < 0}
                onPick={(emoji) => onToggleReaction(message.id, emoji)}
              />
              {own ? (
                <>
                  <button
                    className={actionClass}
                    disabled={!canInteract || busy || message.id < 0}
                    onClick={startEditing}
                    type="button"
                  >
                    Düzenle
                  </button>
                  <button
                    className={cn(
                      actionClass,
                      "hover:bg-[color:var(--danger-soft)] hover:text-[color:var(--danger-text)]",
                    )}
                    disabled={!canInteract || busy || message.id < 0}
                    onClick={() => onDelete(message)}
                    type="button"
                  >
                    Sil
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {deleted ? (
          <p className="mt-0.5 text-sm italic text-[color:var(--muted)]">
            Bu mesaj silindi.
          </p>
        ) : editing ? (
          <div className="mt-1">
            <label className="sr-only" htmlFor={editId}>
              Mesajı düzenle
            </label>
            <textarea
              id={editId}
              className="min-h-[64px] w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm leading-6 text-[color:var(--text)] outline-none focus:border-[color:var(--focus)] disabled:opacity-60"
              disabled={pendingEdit}
              maxLength={MESSAGE_MAX_LENGTH}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !pendingEdit) {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
              rows={2}
              value={editValue}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Button
                disabled={editValue.trim().length === 0}
                loading={pendingEdit}
                onClick={saveEdit}
                size="sm"
                type="button"
              >
                Kaydet
              </Button>
              <Button
                disabled={pendingEdit}
                onClick={cancelEditing}
                size="sm"
                type="button"
                variant="ghost"
              >
                Vazgeç
              </Button>
              {editValue.length > 1800 ? (
                <span className="text-xs text-[color:var(--muted)]">
                  {editValue.length}/{MESSAGE_MAX_LENGTH}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {message.replyToId !== null ? <ReplyQuote parent={parent} /> : null}
            <Markdown
              className="text-sm leading-6 text-[color:var(--text)]"
              text={message.content}
            />
            <ReactionBar
              currentUserId={currentUserId}
              disabled={!canInteract}
              onToggle={(emoji) => onToggleReaction(message.id, emoji)}
              reactions={reactions}
            />
          </>
        )}
      </div>
    </article>
  );
}
