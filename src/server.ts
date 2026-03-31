import fs from "node:fs";
import path from "node:path";
import express from "express";
import { AutomationCoordinator } from "./coordinator";

const LOCAL_DASHBOARD_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;

export function createServer(coordinator: AutomationCoordinator): express.Express {
  const app = express();
  const staticRoot = path.resolve(process.cwd(), "frontend/dist");
  const hasBuiltDashboard = fs.existsSync(path.join(staticRoot, "index.html"));

  // This emitter fans out state updates to any number of dashboard clients.
  coordinator.events.setMaxListeners(0);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", (req, res, next) => {
    const origin = req.get("origin");

    if (origin && LOCAL_DASHBOARD_ORIGIN.test(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.append("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });
  if (hasBuiltDashboard) {
    app.use(express.static(staticRoot));
  }

  app.get("/api/state", (_req, res) => {
    res.json(coordinator.getSnapshot());
  });

  app.post("/api/run/manual", async (_req, res) => {
    const result = await coordinator.triggerManualRun();
    res.status(result.started ? 202 : 409).json(result);
  });

  app.post("/api/run/step-2", async (_req, res) => {
    const result = await coordinator.triggerStepTwoRun();
    res.status(result.started ? 202 : 409).json(result);
  });

  app.post("/api/run/stop", async (_req, res) => {
    await coordinator.stop();
    res.status(200).json({ message: "Ejecución detenida." });
  });

  app.post("/api/attempts/:attemptId/approve", (req, res) => {
    const result = coordinator.approveAttempt(req.params.attemptId);
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/api/attempts/:attemptId/cancel", (req, res) => {
    const result = coordinator.cancelAttempt(req.params.attemptId);
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/api/attempts/:attemptId/retry", async (req, res) => {
    const result = await coordinator.retryAttempt(req.params.attemptId);
    res.status(result.started ? 202 : 409).json(result);
  });

  app.delete("/api/runs/:runId", (req, res) => {
    const result = coordinator.deleteRun(req.params.runId);
    res.status(result.deleted ? 200 : 409).json(result);
  });

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendSnapshot = () => {
      res.write(`data: ${JSON.stringify(coordinator.getSnapshot())}\n\n`);
    };

    sendSnapshot();
    coordinator.events.on("state", sendSnapshot);

    const cleanup = () => {
      coordinator.events.off("state", sendSnapshot);
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("finish", cleanup);
    res.on("error", cleanup);
  });

  app.get(/.*/, (_req, res) => {
    if (!hasBuiltDashboard) {
      res
        .status(503)
        .type("text/plain")
        .send("El dashboard web no esta construido. Ejecuta `npm run build:web` o `npm start`.");
      return;
    }

    res.sendFile(path.join(staticRoot, "index.html"));
  });

  return app;
}
