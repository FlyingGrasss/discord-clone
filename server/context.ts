import { resolve } from "node:path";
import type { AppConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import type { AppDatabase } from "./db.js";
import { openDatabase } from "./db.js";
import { EventBus } from "./events.js";
import { AuthService } from "./services/auth.js";
import { ChatService } from "./services/chat.js";
import { WorkspaceService } from "./services/workspace.js";
import { TicketStore } from "./tickets.js";

export interface AppServices {
  auth: AuthService;
  workspace: WorkspaceService;
  chat: ChatService;
}

export interface AppContext {
  config: AppConfig;
  db: AppDatabase;
  events: EventBus;
  tickets: TicketStore;
  services: AppServices;
  close(): void;
}

export interface CreateContextOptions {
  env?: NodeJS.ProcessEnv;
  config?: AppConfig;
  dbPath?: string;
  schemaPath?: string;
  isProduction?: boolean;
  allowedOrigins?: string[];
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const base = options.config ?? resolveConfig(options.env);
  const config: AppConfig = {
    ...base,
    ...(options.dbPath ? { dbPath: resolve(options.dbPath) } : {}),
    ...(options.isProduction !== undefined
      ? { isProduction: options.isProduction }
      : {}),
    ...(options.allowedOrigins ? { allowedOrigins: [...options.allowedOrigins] } : {}),
  };

  const db = openDatabase(config.dbPath, options.schemaPath);
  const events = new EventBus();
  const tickets = new TicketStore();
  const workspace = new WorkspaceService(db);
  const auth = new AuthService(db);
  const chat = new ChatService(db, events, workspace);

  let closed = false;

  return {
    config,
    db,
    events,
    tickets,
    services: { auth, workspace, chat },
    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
