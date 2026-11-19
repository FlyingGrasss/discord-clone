import { Router, type Request, type Response } from "express";
import type { AppContext } from "../context.js";
import { validationError } from "../errors.js";
import {
  asyncHandler,
  asRecord,
  createRequireAuth,
  getAuth,
} from "../http.js";

export function healthHandler(_req: Request, res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true });
}

export function createMetaRouter(ctx: AppContext): Router {
  const router = Router();
  const requireAuth = createRequireAuth(ctx);

  router.get("/health", healthHandler);

  router.post(
    "/realtime/ticket",
    requireAuth,
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const body = asRecord(req.body);
      const serverId = body.serverId;

      if (typeof serverId !== "string" || serverId.length === 0) {
        throw validationError("serverId", "Sunucu kimliği gerekli.");
      }

      ctx.services.workspace.requireMember(auth.user.id, serverId);
      const grant = ctx.tickets.issue(auth.user.id, serverId);

      res.status(201).json(grant);
    }),
  );

  return router;
}
