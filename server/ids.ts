import { createHash, randomBytes, randomUUID } from "node:crypto";
import { INVITE_CODE_LENGTH } from "../shared/constants.js";

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MAX_UNBIASED_BYTE = 256 - (256 % BASE62_ALPHABET.length);

export function newId(): string {
  return randomUUID();
}

export function newOpaqueToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Cryptographically random base62 invite code without modulo bias. */
export function newInviteCode(length: number = INVITE_CODE_LENGTH): string {
  let code = "";

  while (code.length < length) {
    const bytes = randomBytes(length - code.length + 8);
    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) continue;
      code += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
      if (code.length === length) break;
    }
  }

  return code;
}
