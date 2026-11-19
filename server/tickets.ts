import { randomBytes } from "node:crypto";
import { TICKET_BYTES, TICKET_TTL_MS } from "../shared/constants.js";
import { sha256Hex } from "./ids.js";

export interface TicketGrant {
  ticket: string;
  expiresAt: number;
}

export interface TicketRecord {
  userId: string;
  serverId: string;
  expiresAt: number;
}

/**
 * Single-use realtime handshake tickets. Only the SHA-256 hash is retained;
 * the plaintext ticket is returned once to the client.
 */
export class TicketStore {
  private readonly tickets = new Map<string, TicketRecord>();

  constructor(private readonly ttlMs: number = TICKET_TTL_MS) {}

  issue(userId: string, serverId: string, now: number = Date.now()): TicketGrant {
    this.sweep(now);
    const ticket = randomBytes(TICKET_BYTES).toString("base64url");
    const expiresAt = now + this.ttlMs;
    this.tickets.set(sha256Hex(ticket), { userId, serverId, expiresAt });
    return { ticket, expiresAt };
  }

  consume(ticket: string, now: number = Date.now()): TicketRecord | null {
    if (typeof ticket !== "string" || ticket.length === 0) return null;

    const key = sha256Hex(ticket);
    const record = this.tickets.get(key);
    if (!record) return null;

    // Single use: remove even when expired.
    this.tickets.delete(key);
    if (record.expiresAt <= now) return null;

    return { userId: record.userId, serverId: record.serverId, expiresAt: record.expiresAt };
  }

  private sweep(now: number): void {
    for (const [key, record] of this.tickets) {
      if (record.expiresAt <= now) this.tickets.delete(key);
    }
  }
}
