import { Router } from "express";
import type { AppContext } from "../context.js";
import { asyncHandler, createRequireAuth, getAuth, pathParam } from "../http.js";

export function createInvitesRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(createRequireAuth(ctx));

  router.get("/:code", (req, res) => {
    const auth = getAuth(req);
    const preview = ctx.services.workspace.previewInvite(auth.user.id, pathParam(req, "code"));
    res.status(200).json(preview);
  });

  router.post(
    "/:code/join",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const result = ctx.services.workspace.joinInvite(auth.user.id, pathParam(req, "code"));
      res.status(200).json(result);
    }),
  );

  return router;
}
