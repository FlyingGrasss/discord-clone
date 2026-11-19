"use client";

import type {
  CallServerMessage,
  ErrorPayload,
} from "@shared/protocol";
import type { MessageAuthor, MessageDto } from "@shared/types";
import { MESSAGE_MAX_LENGTH } from "@shared/constants";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  REALTIME_RECONNECTING_MESSAGE,
} from "@/lib/realtime/client";
import {
  useChannelChat,
  type ChatMessage,
  type SendFailure,
  type TypingUser,
} from "@/lib/realtime/use-channel-chat";
import {
  useCall,
  type CallController,
} from "@/lib/webrtc/use-call";
import { CallBar } from "./CallBar";
import { CallPanel } from "./CallPanel";
import { ChatHeader } from "./ChatHeader";
import { MessageComposer, type ReplyTarget } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";

export interface ChannelChatProps {
  channel: { id: string; name: string };
  server: { id: string; name: string };
  currentUser: MessageAuthor;
  memberCount: number;
  initialMessages: MessageDto[];
  firstChannelHref: string;
}

function formatTypingLabel(users: TypingUser[]): string | null {
  if (users.length === 0) return null;
  if (users.length === 1) return `${users[0]!.username} yazıyor…`;
  if (users.length === 2) {
    return `${users[0]!.username} ve ${users[1]!.username} yazıyor…`;
  }
  return `${users.length} kişi yazıyor…`;
}

export function ChannelChat({
  channel,
  server,
  currentUser,
  memberCount,
  initialMessages,
  firstChannelHref,
}: ChannelChatProps) {
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);

  const handleSendFailed = useCallback((failure: SendFailure) => {
    setDraft((current) => (current.trim().length === 0 ? failure.content : current));
  }, []);

  // useChannelChat needs the call handlers and useCall needs the socket send
  // function, so the controller is connected through a ref after commit.
  const callControllerRef = useRef<CallController | null>(null);
  const handleCallEvent = useCallback((message: CallServerMessage) => {
    callControllerRef.current?.handleCallEvent(message);
  }, []);
  const handleCallServerError = useCallback((payload: ErrorPayload) => {
    callControllerRef.current?.handleServerError(payload);
  }, []);

  const chat = useChannelChat({
    serverId: server.id,
    channelId: channel.id,
    currentUser,
    initialMessages,
    firstChannelHref,
    onSendFailed: handleSendFailed,
    onCallEvent: handleCallEvent,
    onServerError: handleCallServerError,
  });

  const call = useCall({
    channelId: channel.id,
    currentUser: { id: currentUser.id, username: currentUser.username },
    connectionState: chat.connectionState,
    sendMessage: chat.sendClientMessage,
  });

  useEffect(() => {
    callControllerRef.current = call;
  }, [call]);

  const typingLabel = useMemo(
    () => formatTypingLabel(chat.typingUsers),
    [chat.typingUsers],
  );

  useEffect(() => {
    if (!replyTarget) return;
    const target = chat.messages.find((message) => message.id === replyTarget.id);
    if (!target || target.deletedAt !== null) setReplyTarget(null);
  }, [chat.messages, replyTarget]);

  useEffect(() => {
    if (!deleteTarget) return;
    const current = chat.messages.find(
      (message) => message.id === deleteTarget.id,
    );
    if (!current || current.deletedAt !== null) setDeleteTarget(null);
  }, [chat.messages, deleteTarget]);

  function handleSend(): void {
    if (!chat.isOpen) return;
    const content = draft.trim();
    if (content.length === 0 || content.length > MESSAGE_MAX_LENGTH) return;

    const replyToId = replyTarget?.id ?? null;
    setDraft("");
    setReplyTarget(null);
    chat.sendMessage(content, replyToId);
  }

  function handleReply(message: ChatMessage): void {
    setReplyTarget({
      id: message.id,
      username: message.author.username,
    });
  }

  function handleDelete(message: ChatMessage): void {
    setDeleteTarget(message);
  }

  const deletePending = deleteTarget
    ? chat.pendingDeletes.has(deleteTarget.id)
    : false;
  const connectionMessage =
    chat.connectionError ?? (chat.isOpen ? null : REALTIME_RECONNECTING_MESSAGE);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--bg)]">
      <ChatHeader channelName={channel.name} memberCount={memberCount} />

      <CallBar call={call} />
      <CallPanel
        localScreenStream={call.localScreenStream}
        onStopScreenShare={call.stopScreenShare}
        remoteParticipants={call.remoteParticipants}
        remoteStreams={call.remoteStreams}
      />

      <MessageList
        canInteract={chat.isOpen}
        channelName={channel.name}
        currentUserId={currentUser.id}
        messages={chat.messages}
        onDelete={handleDelete}
        onEdit={chat.editMessage}
        onReply={handleReply}
        onRetry={chat.retryMessage}
        onToggleReaction={chat.toggleReaction}
        pendingDeletes={chat.pendingDeletes}
        pendingEdits={chat.pendingEdits}
        reactions={chat.reactions}
      />

      <div className="shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-3 pt-1 sm:px-4">
        <TypingIndicator label={typingLabel} />
        <MessageComposer
          channelName={channel.name}
          connectionMessage={connectionMessage}
          disabled={!chat.isOpen}
          onCancelReply={() => setReplyTarget(null)}
          onSend={handleSend}
          onTyping={chat.notifyTyping}
          onValueChange={setDraft}
          replyTarget={replyTarget}
          value={draft}
        />
      </div>

      <ConfirmDialog
        confirmLabel="Sil"
        description="Bu mesajı silmek istediğine emin misin? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (!deleteTarget) return;
          chat.deleteMessage(deleteTarget.id);
        }}
        onOpenChange={(open) => {
          if (!open && !deletePending) setDeleteTarget(null);
        }}
        open={deleteTarget !== null}
        pending={deletePending}
        title="Mesajı sil"
      />
    </div>
  );
}
