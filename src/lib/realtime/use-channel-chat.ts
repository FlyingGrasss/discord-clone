"use client";

import { MESSAGE_MAX_LENGTH } from "@shared/constants";
import {
  WS_TYPING_THROTTLE_MS,
  type ReactionEmoji,
  type ReactionGroup,
  type TypingEventPayload,
  type WorkspaceChangedPayload,
} from "@shared/protocol";
import type { MessageAuthor, MessageDto } from "@shared/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/Toaster";
import { useWorkspacePresence } from "@/components/workspace/WorkspacePresenceContext";
import {
  ChannelRealtimeClient,
  REALTIME_RECONNECTING_MESSAGE,
  type RealtimeStatus,
} from "./client";

export type ChatMessageState = "sent" | "pending" | "failed";

export interface ChatMessage extends MessageDto {
  clientId: string | null;
  state: ChatMessageState;
}

export interface TypingUser {
  userId: string;
  username: string;
  expiresAt: number;
}

export interface SendFailure {
  clientId: string;
  content: string;
  replyToId: number | null;
}

export interface UseChannelChatOptions {
  serverId: string;
  channelId: string;
  currentUser: MessageAuthor;
  initialMessages: MessageDto[];
  /** Destination used when the open channel is deleted while viewing it. */
  firstChannelHref: string;
  /** Called when a send fails so the composer can restore the draft text. */
  onSendFailed?: (failure: SendFailure) => void;
}

function readClientId(message: MessageDto): string | null {
  const value = (message as MessageDto & { clientId?: unknown }).clientId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toChatMessage(message: MessageDto): ChatMessage {
  return {
    ...message,
    clientId: readClientId(message),
    state: "sent",
  };
}

function compareChatMessages(left: ChatMessage, right: ChatMessage): number {
  const leftPending = left.id < 0;
  const rightPending = right.id < 0;

  if (leftPending && rightPending) {
    return (
      left.createdAt - right.createdAt ||
      (left.clientId ?? "").localeCompare(right.clientId ?? "")
    );
  }
  if (leftPending) return 1;
  if (rightPending) return -1;
  return left.id - right.id;
}

function sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(compareChatMessages);
}

function mergeServerMessages(
  current: ChatMessage[],
  incoming: MessageDto[],
): ChatMessage[] {
  if (incoming.length === 0) return current;

  const byId = new Map<number, ChatMessage>();
  for (const message of current) byId.set(message.id, message);

  for (const message of incoming) {
    const existing = byId.get(message.id);
    byId.set(message.id, {
      ...toChatMessage(message),
      clientId: existing?.clientId ?? readClientId(message),
    });
  }

  return sortChatMessages([...byId.values()]);
}

function findReconcilableClientId(
  current: ChatMessage[],
  incoming: MessageDto,
  currentUserId: string,
): string | null {
  const explicit = readClientId(incoming);
  if (explicit) return explicit;
  if (incoming.author.id !== currentUserId) return null;

  // The wire MessageDto has no clientId, so own messages fall back to the
  // unique pending send with the same content and reply target.
  return (
    current.find(
      (message) =>
        message.id < 0 &&
        message.clientId !== null &&
        message.content === incoming.content &&
        message.replyToId === incoming.replyToId,
    )?.clientId ?? null
  );
}

function applyIncomingMessage(
  current: ChatMessage[],
  incoming: MessageDto,
  currentUserId: string,
): ChatMessage[] {
  const clientId = findReconcilableClientId(current, incoming, currentUserId);
  const withoutPending = clientId
    ? current.filter((message) => message.clientId !== clientId)
    : current;
  return mergeServerMessages(withoutPending, [incoming]);
}

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function maxServerId(messages: MessageDto[]): number | null {
  let result: number | null = null;
  for (const message of messages) {
    if (message.id > 0 && (result === null || message.id > result)) {
      result = message.id;
    }
  }
  return result;
}

export function useChannelChat(options: UseChannelChatOptions) {
  const {
    serverId,
    channelId,
    currentUser,
    initialMessages,
    firstChannelHref,
    onSendFailed,
  } = options;

  const router = useRouter();
  const { setOnlineUsers, addOnlineUser, removeOnlineUser } =
    useWorkspacePresence();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    sortChatMessages(initialMessages.map(toChatMessage)),
  );
  const [reactions, setReactions] = useState<Record<number, ReactionGroup[]>>({});
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(
    () => new Map(),
  );
  const [connectionState, setConnectionState] =
    useState<RealtimeStatus>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pendingEdits, setPendingEdits] = useState<Set<number>>(() => new Set());
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(
    () => new Set(),
  );

  const clientRef = useRef<ChannelRealtimeClient | null>(null);
  const lastMessageIdRef = useRef<number | null>(maxServerId(initialMessages));
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const tempIdRef = useRef(-1);
  const lastTypingSentRef = useRef(0);
  const pendingSendsRef = useRef<
    Map<string, { content: string; replyToId: number | null }>
  >(new Map());
  const onSendFailedRef = useRef(onSendFailed);

  useEffect(() => {
    onSendFailedRef.current = onSendFailed;
  }, [onSendFailed]);

  useEffect(() => {
    lastMessageIdRef.current = maxServerId(messages);
  }, [messages]);

  const clearTypingUser = useCallback((userId: string) => {
    const timer = typingTimersRef.current.get(userId);
    if (timer !== undefined) {
      clearTimeout(timer);
      typingTimersRef.current.delete(userId);
    }

    setTypingUsers((current) => {
      if (!current.has(userId)) return current;
      const next = new Map(current);
      next.delete(userId);
      return next;
    });
  }, []);

  const markSendFailed = useCallback((clientId: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.clientId === clientId
          ? { ...message, state: "failed" }
          : message,
      ),
    );

    const pending = pendingSendsRef.current.get(clientId);
    pendingSendsRef.current.delete(clientId);
    if (pending) {
      onSendFailedRef.current?.({ clientId, ...pending });
    }
  }, []);

  useEffect(() => {
    const client = new ChannelRealtimeClient({
      serverId,
      channelId,
      getLastMessageId: () => lastMessageIdRef.current,
      handlers: {
        onStatusChange: (status) => {
          setConnectionState(status);
        },
        onReady: (payload) => {
          setConnectionError(null);
          setOnlineUsers(payload.online.map((user) => user.id));
        },
        onMessageNew: (message) => {
          if (message.channelId !== channelId) return;

          clearTypingUser(message.author.id);
          const explicitClientId = readClientId(message);
          if (explicitClientId) {
            pendingSendsRef.current.delete(explicitClientId);
          } else {
            for (const [clientId, pending] of pendingSendsRef.current) {
              if (
                pending.content === message.content &&
                pending.replyToId === message.replyToId
              ) {
                pendingSendsRef.current.delete(clientId);
                break;
              }
            }
          }

          setMessages((current) =>
            applyIncomingMessage(current, message, currentUser.id),
          );
        },
        onMessageUpdate: (message) => {
          if (message.channelId !== channelId) return;

          setMessages((current) => mergeServerMessages(current, [message]));
          setPendingEdits((current) => {
            if (!current.has(message.id)) return current;
            const next = new Set(current);
            next.delete(message.id);
            return next;
          });
          setPendingDeletes((current) => {
            if (!current.has(message.id)) return current;
            const next = new Set(current);
            next.delete(message.id);
            return next;
          });
        },
        onMessageReactions: (payload) => {
          if (payload.channelId !== channelId) return;
          setReactions((current) => ({
            ...current,
            [payload.messageId]: payload.reactions,
          }));
        },
        onTyping: (payload: TypingEventPayload) => {
          if (payload.channelId !== channelId) return;
          if (payload.user.id === currentUser.id) return;

          const existing = typingTimersRef.current.get(payload.user.id);
          if (existing !== undefined) clearTimeout(existing);

          const expiresIn = Math.max(0, payload.expiresAt - Date.now()) + 100;
          const timer = setTimeout(() => {
            typingTimersRef.current.delete(payload.user.id);
            setTypingUsers((current) => {
              if (!current.has(payload.user.id)) return current;
              const next = new Map(current);
              next.delete(payload.user.id);
              return next;
            });
          }, expiresIn);

          typingTimersRef.current.set(payload.user.id, timer);
          setTypingUsers((current) => {
            const next = new Map(current);
            next.set(payload.user.id, {
              userId: payload.user.id,
              username: payload.user.username,
              expiresAt: payload.expiresAt,
            });
            return next;
          });
        },
        onPresenceOnline: (user) => {
          addOnlineUser(user.id);
        },
        onPresenceOffline: (userId) => {
          removeOnlineUser(userId);
        },
        onWorkspaceChanged: (payload: WorkspaceChangedPayload) => {
          router.refresh();
          const change = payload as WorkspaceChangedPayload & {
            kind: string;
            channelId?: string;
          };

          if (change.kind === "server:deleted") {
            client.destroy();
            router.push("/sunucular");
            return;
          }

          if (change.kind === "member:left") {
            client.destroy();
            return;
          }

          if (
            change.kind === "channel:deleted" ||
            change.channelId === channelId
          ) {
            if (!change.channelId || change.channelId === channelId) {
              router.push(firstChannelHref);
            }
          }
        },
        onOperationError: (payload) => {
          if (payload.clientId) {
            markSendFailed(payload.clientId);
            if (payload.code === "RATE_LIMITED") {
              toast(payload.message, { tone: "error" });
            }
            return;
          }

          setPendingEdits(new Set());
          setPendingDeletes(new Set());
          toast(payload.message, { tone: "error" });
        },
        onGapMessages: (gapMessages) => {
          const inChannel = gapMessages.filter(
            (message) => message.channelId === channelId,
          );
          if (inChannel.length === 0) return;

          for (const message of inChannel) {
            const explicitClientId = readClientId(message);
            if (explicitClientId) {
              pendingSendsRef.current.delete(explicitClientId);
              continue;
            }
            if (message.author.id !== currentUser.id) continue;

            for (const [clientId, pending] of pendingSendsRef.current) {
              if (
                pending.content === message.content &&
                pending.replyToId === message.replyToId
              ) {
                pendingSendsRef.current.delete(clientId);
                break;
              }
            }
          }

          setMessages((current) => {
            let next = current;
            for (const message of inChannel) {
              next = applyIncomingMessage(next, message, currentUser.id);
            }
            return next;
          });
        },
        onFatalError: (message) => {
          setConnectionError(message);
        },
      },
    });

    clientRef.current = client;
    client.start();
    const typingTimers = typingTimersRef.current;

    return () => {
      client.destroy();
      if (clientRef.current === client) clientRef.current = null;

      for (const timer of typingTimers.values()) {
        clearTimeout(timer);
      }
      typingTimers.clear();
    };
  }, [
    addOnlineUser,
    channelId,
    clearTypingUser,
    currentUser.id,
    firstChannelHref,
    markSendFailed,
    removeOnlineUser,
    router,
    serverId,
    setOnlineUsers,
  ]);

  const sendMessage = useCallback(
    (rawContent: string, replyToId: number | null): string | null => {
      const content = rawContent.trim();
      if (content.length === 0 || content.length > MESSAGE_MAX_LENGTH) return null;

      const clientId = createClientId();
      const tempId = tempIdRef.current;
      tempIdRef.current -= 1;

      const optimistic: ChatMessage = {
        id: tempId,
        channelId,
        author: { ...currentUser },
        content,
        replyToId,
        createdAt: Date.now(),
        editedAt: null,
        deletedAt: null,
        clientId,
        state: "pending",
      };

      setMessages((current) =>
        sortChatMessages([...current, optimistic]),
      );
      pendingSendsRef.current.set(clientId, { content, replyToId });

      const sent =
        clientRef.current?.sendClientMessage({
          type: "message:send",
          clientId,
          channelId,
          content,
          ...(replyToId !== null ? { replyToId } : {}),
        }) ?? false;

      if (!sent) markSendFailed(clientId);
      return clientId;
    },
    [channelId, currentUser, markSendFailed],
  );

  const retryMessage = useCallback(
    (message: ChatMessage): void => {
      const clientId = message.clientId;
      if (!clientId) return;

      setMessages((current) =>
        current.map((item) =>
          item.clientId === clientId ? { ...item, state: "pending" } : item,
        ),
      );
      pendingSendsRef.current.set(clientId, {
        content: message.content,
        replyToId: message.replyToId,
      });

      const sent =
        clientRef.current?.sendClientMessage({
          type: "message:send",
          clientId,
          channelId,
          content: message.content,
          ...(message.replyToId !== null
            ? { replyToId: message.replyToId }
            : {}),
        }) ?? false;

      if (!sent) markSendFailed(clientId);
    },
    [channelId, markSendFailed],
  );

  const editMessage = useCallback(
    (messageId: number, rawContent: string): boolean => {
      const content = rawContent.trim();
      if (content.length === 0 || content.length > MESSAGE_MAX_LENGTH) return false;

      const sent =
        clientRef.current?.sendClientMessage({
          type: "message:edit",
          messageId,
          content,
        }) ?? false;

      if (!sent) {
        toast(REALTIME_RECONNECTING_MESSAGE, { tone: "error" });
        return false;
      }

      setPendingEdits((current) => new Set(current).add(messageId));
      return true;
    },
    [],
  );

  const deleteMessage = useCallback((messageId: number): boolean => {
    const sent =
      clientRef.current?.sendClientMessage({
        type: "message:delete",
        messageId,
      }) ?? false;

    if (!sent) {
      toast(REALTIME_RECONNECTING_MESSAGE, { tone: "error" });
      return false;
    }

    setPendingDeletes((current) => new Set(current).add(messageId));
    return true;
  }, []);

  const toggleReaction = useCallback(
    (messageId: number, emoji: ReactionEmoji): void => {
      const sent =
        clientRef.current?.sendClientMessage({
          type: "reaction:toggle",
          messageId,
          emoji,
        }) ?? false;

      if (!sent) toast(REALTIME_RECONNECTING_MESSAGE, { tone: "error" });
    },
    [],
  );

  const notifyTyping = useCallback((): void => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < WS_TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    clientRef.current?.sendClientMessage({ type: "typing", channelId });
  }, [channelId]);

  const typingUserList = Array.from(typingUsers.values()).sort((left, right) =>
    left.username.localeCompare(right.username, "tr"),
  );

  return {
    messages,
    reactions,
    typingUsers: typingUserList,
    connectionState,
    connectionError,
    isOpen: connectionState === "open",
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    notifyTyping,
    pendingEdits,
    pendingDeletes,
  };
}
