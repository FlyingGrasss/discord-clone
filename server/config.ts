import { resolve } from "node:path";
import {
  API_DEFAULT_HOST,
  API_DEFAULT_PORT,
  DEFAULT_ALLOWED_ORIGINS,
} from "../shared/constants.js";

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  isProduction: boolean;
  allowedOrigins: string[];
  trustProxy: boolean;
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: parsePort(env.API_PORT),
    host: env.API_HOST?.trim() || API_DEFAULT_HOST,
    dbPath: resolve(process.cwd(), env.DB_PATH?.trim() || "data/meydan.db"),
    isProduction: env.NODE_ENV === "production",
    allowedOrigins: parseOrigins(env.APP_ORIGINS),
    trustProxy: parseBoolean(env.TRUST_PROXY),
  };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return API_DEFAULT_PORT;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`API_PORT 1 ile 65535 arasında bir tam sayı olmalı (verilen: ${raw}).`);
  }
  return port;
}

function parseOrigins(raw: string | undefined): string[] {
  const values = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) return [...DEFAULT_ALLOWED_ORIGINS];

  const origins = values.map((value) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`APP_ORIGINS geçerli bir kaynak içermiyor: ${value}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`APP_ORIGINS yalnızca http/https kaynakları kabul eder: ${value}`);
    }
    return parsed.origin;
  });

  return [...new Set(origins)];
}

function parseBoolean(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}
