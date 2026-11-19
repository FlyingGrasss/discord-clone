import {
  DEFAULT_CHANNEL_NAME,
  DEFAULT_SERVER_ICON_COLOR,
  DEFAULT_SERVER_ICON_EMOJI,
} from "../../shared/constants.js";
import type {
  ChannelDto,
  InvitePreview,
  JoinInviteResult,
  ServerSummary,
  WorkspaceDto,
  WorkspaceMember,
} from "../../shared/types.js";
import {
  isPlausibleInviteCode,
  validateChannelName,
  validateIconColor,
  validateIconEmoji,
  validateServerName,
  type Validated,
} from "../../shared/validation.js";
import type { AppDatabase } from "../db.js";
import { ApiError, forbidden, notFound, validationError } from "../errors.js";
import { newId, newInviteCode } from "../ids.js";
import {
  countChannelsByServer,
  deleteChannel,
  findChannelById,
  findChannelByName,
  insertChannel,
  listChannelsByServer,
  nextChannelPosition,
  renameChannel,
  type ChannelRow,
} from "../repos/channels.js";
import {
  addMember,
  countMembers,
  deleteServer,
  findServerById,
  findServerByInviteCode,
  insertServer,
  isMember,
  listMembers,
  listServersForUser,
  removeMember,
  updateServer,
  type ServerRow,
} from "../repos/servers.js";
import type { UserRow } from "../repos/users.js";

export interface ChannelAccess {
  channel: ChannelRow;
  serverId: string;
}

function unwrap<T>(result: Validated<T>): T {
  if (!result.ok) throw validationError(result.error.field, result.error.message);
  return result.value;
}

function toChannelDto(channel: ChannelRow): ChannelDto {
  return {
    id: channel.id,
    name: channel.name,
    position: channel.position,
    createdAt: channel.created_at,
  };
}

export class WorkspaceService {
  constructor(private readonly db: AppDatabase) {}

  listServers(userId: string): ServerSummary[] {
    return listServersForUser(this.db, userId).map((row) => ({
      id: row.id,
      name: row.name,
      iconEmoji: row.icon_emoji,
      iconColor: row.icon_color,
      isOwner: row.is_owner === 1,
    }));
  }

  createServer(
    user: UserRow,
    input: { name?: unknown; iconEmoji?: unknown; iconColor?: unknown },
  ): WorkspaceDto {
    if (user.is_guest === 1) {
      throw new ApiError(403, "GUEST_NOT_ALLOWED", "Misafir hesaplar sunucu oluşturamaz.");
    }

    const name = unwrap(validateServerName(input.name));
    const iconEmoji =
      input.iconEmoji === undefined
        ? DEFAULT_SERVER_ICON_EMOJI
        : unwrap(validateIconEmoji(input.iconEmoji));
    const iconColor =
      input.iconColor === undefined
        ? DEFAULT_SERVER_ICON_COLOR
        : unwrap(validateIconColor(input.iconColor));

    const now = Date.now();
    const serverId = newId();
    const channelId = newId();

    let inviteCode = "";
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidate = newInviteCode();
      if (!findServerByInviteCode(this.db, candidate)) {
        inviteCode = candidate;
        break;
      }
    }
    if (!inviteCode) {
      throw new ApiError(500, "INTERNAL_ERROR", "Davet kodu üretilemedi.");
    }

    this.db.transaction(() => {
      insertServer(this.db, {
        id: serverId,
        name,
        iconEmoji,
        iconColor,
        ownerId: user.id,
        inviteCode,
        createdAt: now,
      });

      insertChannel(this.db, {
        id: channelId,
        serverId,
        name: DEFAULT_CHANNEL_NAME,
        position: 0,
        createdAt: now,
      });

      addMember(this.db, serverId, user.id, now);
    })();

    return this.getServer(user.id, serverId);
  }

  getServer(userId: string, serverId: string): WorkspaceDto {
    const server = this.requireMember(userId, serverId);
    const isOwner = server.owner_id === userId;

    const channels = listChannelsByServer(this.db, serverId).map(toChannelDto);
    const members: WorkspaceMember[] = listMembers(this.db, serverId).map((member) => ({
      id: member.id,
      username: member.username,
      isGuest: member.is_guest === 1,
      joinedAt: member.joined_at,
      isOwner: member.id === server.owner_id,
    }));

    return {
      id: server.id,
      name: server.name,
      iconEmoji: server.icon_emoji,
      iconColor: server.icon_color,
      ownerId: server.owner_id,
      inviteCode: server.invite_code,
      isOwner,
      createdAt: server.created_at,
      channels,
      members,
    };
  }

  updateServer(
    userId: string,
    serverId: string,
    input: { name?: unknown; iconEmoji?: unknown; iconColor?: unknown },
  ): WorkspaceDto {
    const server = this.requireOwner(userId, serverId);

    const name =
      input.name === undefined ? server.name : unwrap(validateServerName(input.name));
    const iconEmoji =
      input.iconEmoji === undefined
        ? server.icon_emoji
        : unwrap(validateIconEmoji(input.iconEmoji));
    const iconColor =
      input.iconColor === undefined
        ? server.icon_color
        : unwrap(validateIconColor(input.iconColor));

    updateServer(this.db, serverId, { name, iconEmoji, iconColor });
    return this.getServer(userId, serverId);
  }

  deleteServer(userId: string, serverId: string, confirmName: unknown): void {
    const server = this.requireOwner(userId, serverId);

    if (typeof confirmName !== "string" || confirmName.trim() !== server.name) {
      throw new ApiError(409, "NAME_MISMATCH", "Sunucu adı eşleşmiyor.");
    }

    deleteServer(this.db, serverId);
  }

  leaveServer(userId: string, serverId: string): void {
    const server = this.requireMember(userId, serverId);

    if (server.owner_id === userId) {
      throw new ApiError(
        409,
        "OWNER_CANNOT_LEAVE",
        "Sunucu sahibi sunucudan ayrılamaz; sunucuyu silebilir.",
      );
    }

    removeMember(this.db, serverId, userId);
  }

  createChannel(
    userId: string,
    serverId: string,
    input: { name?: unknown },
  ): ChannelDto {
    this.requireOwner(userId, serverId);
    const name = unwrap(validateChannelName(input.name));

    if (findChannelByName(this.db, serverId, name)) {
      throw new ApiError(409, "CHANNEL_EXISTS", "Bu adda bir kanal zaten var.");
    }

    const now = Date.now();
    const channel: ChannelRow = {
      id: newId(),
      server_id: serverId,
      name,
      position: nextChannelPosition(this.db, serverId),
      created_at: now,
    };

    insertChannel(this.db, {
      id: channel.id,
      serverId,
      name: channel.name,
      position: channel.position,
      createdAt: channel.created_at,
    });

    return toChannelDto(channel);
  }

  renameChannel(
    userId: string,
    channelId: string,
    input: { name?: unknown },
  ): ChannelDto {
    const channel = findChannelById(this.db, channelId);
    if (!channel) throw notFound("Kanal bulunamadı.");

    this.requireOwner(userId, channel.server_id);
    const name = unwrap(validateChannelName(input.name));

    const existing = findChannelByName(this.db, channel.server_id, name);
    if (existing && existing.id !== channel.id) {
      throw new ApiError(409, "CHANNEL_EXISTS", "Bu adda bir kanal zaten var.");
    }

    renameChannel(this.db, channel.id, name);
    return toChannelDto({ ...channel, name });
  }

  deleteChannel(userId: string, channelId: string): void {
    const channel = findChannelById(this.db, channelId);
    if (!channel) throw notFound("Kanal bulunamadı.");

    this.requireOwner(userId, channel.server_id);

    if (countChannelsByServer(this.db, channel.server_id) <= 1) {
      throw new ApiError(409, "LAST_CHANNEL", "Sunucunun son kanalı silinemez.");
    }

    deleteChannel(this.db, channelId);
  }

  private findInviteServer(code: string): ServerRow {
    if (!isPlausibleInviteCode(code)) {
      throw notFound("Davet bulunamadı.");
    }

    const server = findServerByInviteCode(this.db, code);
    if (!server) throw notFound("Davet bulunamadı.");
    return server;
  }

  previewInvite(userId: string, code: string): InvitePreview {
    const server = this.findInviteServer(code);
    return {
      server: {
        id: server.id,
        name: server.name,
        iconEmoji: server.icon_emoji,
        iconColor: server.icon_color,
      },
      memberCount: countMembers(this.db, server.id),
      isMember: isMember(this.db, server.id, userId),
    };
  }

  joinInvite(userId: string, code: string): JoinInviteResult {
    const server = this.findInviteServer(code);

    if (isMember(this.db, server.id, userId)) {
      throw new ApiError(409, "ALREADY_MEMBER", "Zaten bu sunucunun üyesisin.");
    }

    const channel = listChannelsByServer(this.db, server.id)[0];
    if (!channel) {
      throw new ApiError(500, "INTERNAL_ERROR", "Sunucuda kanal bulunamadı.");
    }

    const added = addMember(this.db, server.id, userId, Date.now());
    if (!added) {
      throw new ApiError(409, "ALREADY_MEMBER", "Zaten bu sunucunun üyesisin.");
    }

    return {
      serverId: server.id,
      channelId: channel.id,
      alreadyMember: false,
    };
  }

  requireMember(userId: string, serverId: string): ServerRow {
    const server = findServerById(this.db, serverId);
    if (!server || !isMember(this.db, serverId, userId)) {
      throw notFound("Sunucu bulunamadı.");
    }
    return server;
  }

  requireOwner(userId: string, serverId: string): ServerRow {
    const server = this.requireMember(userId, serverId);
    if (server.owner_id !== userId) {
      throw forbidden("Bu işlem yalnızca sunucu sahibine açık.");
    }
    return server;
  }

  getChannelAccess(userId: string, channelId: string): ChannelAccess {
    const channel = findChannelById(this.db, channelId);
    if (!channel || !isMember(this.db, channel.server_id, userId)) {
      throw notFound("Kanal bulunamadı.");
    }

    return { channel, serverId: channel.server_id };
  }
}
