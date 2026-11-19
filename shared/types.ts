/** Wire contracts shared by the Next app, the Express API, and the realtime layer. */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "GUEST_NOT_ALLOWED"
  | "NOT_FOUND"
  | "USERNAME_TAKEN"
  | "CHANNEL_EXISTS"
  | "LAST_CHANNEL"
  | "OWNER_CANNOT_LEAVE"
  | "NAME_MISMATCH"
  | "ALREADY_MEMBER"
  | "RATE_LIMITED"
  | "CSRF_REJECTED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_JSON"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    field?: string;
    retryAfterMs?: number;
  };
}

export interface UserDto {
  id: string;
  username: string;
  isGuest: boolean;
  createdAt: number;
}

export interface AuthResponse {
  user: UserDto;
}

export interface ServerSummary {
  id: string;
  name: string;
  iconEmoji: string;
  iconColor: string;
  isOwner: boolean;
}

export interface ChannelDto {
  id: string;
  name: string;
  position: number;
  createdAt: number;
}

export interface WorkspaceMember {
  id: string;
  username: string;
  isGuest: boolean;
  joinedAt: number;
  isOwner: boolean;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  iconEmoji: string;
  iconColor: string;
  ownerId: string;
  inviteCode: string;
  isOwner: boolean;
  createdAt: number;
  channels: ChannelDto[];
  members: WorkspaceMember[];
}

export interface InviteServerPreview {
  id: string;
  name: string;
  iconEmoji: string;
  iconColor: string;
}

export interface InvitePreview {
  server: InviteServerPreview;
  memberCount: number;
  isMember: boolean;
}

export interface JoinInviteResult {
  serverId: string;
  channelId: string;
  alreadyMember: boolean;
}

export interface MessageAuthor {
  id: string;
  username: string;
  isGuest: boolean;
}

export interface MessageDto {
  id: number;
  channelId: string;
  author: MessageAuthor;
  content: string;
  replyToId: number | null;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
}

export interface MessageChannel {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface MessagePage {
  channel: MessageChannel;
  messages: MessageDto[];
  hasMore: boolean;
}

export interface RealtimeTicketDto {
  ticket: string;
  expiresAt: number;
}

export interface MessageNewEvent {
  serverId: string;
  channelId: string;
  message: MessageDto;
}

export interface MessageUpdatedEvent {
  serverId: string;
  channelId: string;
  message: MessageDto;
}

export interface MessageDeletedEvent {
  serverId: string;
  channelId: string;
  messageId: number;
  deletedAt: number;
}
