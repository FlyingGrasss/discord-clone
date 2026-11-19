import { Router } from "express";
import type { AppContext } from "../context.js";
import {
  asyncHandler,
  asRecord,
  createRequireAuth,
  getAuth,
  pathParam,
} from "../http.js";

export function createChannelsRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(createRequireAuth(ctx));

  router.patch(
    "/:channelId",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const body = asRecord(req.body);
      const channel = ctx.services.workspace.renameChannel(
        auth.user.id,
        pathParam(req, "channelId"),
        { name: body.name },
      );
      res.status(200).json({ channel });
    }),
  );

  router.delete(
    "/:channelId",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      ctx.services.workspace.deleteChannel(auth.user.id, pathParam(req, "channelId"));
      res.status(204).end();
    }),
  );

  router.get("/:channelId/messages", (req, res) => {
    const auth = getAuth(req);
    const page = ctx.services.chat.listMessages(
      auth.user.id,
      pathParam(req, "channelId"),
      {
        before: req.query.before,
        after: req.query.after,
        limit: req.query.limit,
      },
    );
    res.status(200).json(page);
  });

  return router;
}
