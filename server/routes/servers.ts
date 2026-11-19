import { Router } from "express";
import type { AppContext } from "../context.js";
import {
  asyncHandler,
  asRecord,
  createRequireAuth,
  getAuth,
  pathParam,
} from "../http.js";

export function createServersRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(createRequireAuth(ctx));

  router.get("/", (req, res) => {
    const auth = getAuth(req);
    res.status(200).json({ servers: ctx.services.workspace.listServers(auth.user.id) });
  });

  router.post(
    "/",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const body = asRecord(req.body);
      const workspace = ctx.services.workspace.createServer(auth.user, {
        name: body.name,
        iconEmoji: body.iconEmoji,
        iconColor: body.iconColor,
      });
      res.status(201).json({ workspace });
    }),
  );

  router.get("/:serverId", (req, res) => {
    const auth = getAuth(req);
    const workspace = ctx.services.workspace.getServer(
      auth.user.id,
      pathParam(req, "serverId"),
    );
    res.status(200).json({ workspace });
  });

  router.patch(
    "/:serverId",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const body = asRecord(req.body);
      const workspace = ctx.services.workspace.updateServer(
        auth.user.id,
        pathParam(req, "serverId"),
        {
          name: body.name,
          iconEmoji: body.iconEmoji,
          iconColor: body.iconColor,
        },
      );
      res.status(200).json({ workspace });
    }),
  );

  router.delete(
    "/:serverId",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const body = asRecord(req.body);
      ctx.services.workspace.deleteServer(
        auth.user.id,
        pathParam(req, "serverId"),
        body.confirmName,
      );
      res.status(204).end();
    }),
  );

  router.post(
    "/:serverId/leave",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      ctx.services.workspace.leaveServer(auth.user.id, pathParam(req, "serverId"));
      res.status(204).end();
    }),
  );

  router.post(
    "/:serverId/channels",
    asyncHandler((req, res) => {
      const auth = getAuth(req);
      const body = asRecord(req.body);
      const channel = ctx.services.workspace.createChannel(
        auth.user.id,
        pathParam(req, "serverId"),
        { name: body.name },
      );
      res.status(201).json({ channel });
    }),
  );

  return router;
}
