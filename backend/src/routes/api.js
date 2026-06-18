import { Router } from "express";

export const apiRouter = Router();

apiRouter.get("/status", (_req, res) => {
  res.json({ ok: true, data: { status: "ready" } });
});
