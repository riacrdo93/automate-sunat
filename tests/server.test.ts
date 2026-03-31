import { EventEmitter } from "node:events";
import request from "supertest";
import { describe, expect, test } from "vitest";
import { createServer } from "../src/server";

function createCoordinatorStub() {
  return {
    events: new EventEmitter(),
    getSnapshot: () => ({
      config: {
        profile: "custom",
        runMode: "manual",
        checkIntervalMinutes: 60,
        headful: true,
        baseUrl: "http://localhost:3030",
      },
      runtime: {
        isRunning: false,
        currentStep: "En espera",
        pendingApprovals: [],
        stepTwoReady: {
          available: false,
          pendingSales: 0,
          message: "Sin ventas pendientes.",
        },
      },
      sales: [],
      attempts: [],
      runs: [],
    }),
    triggerManualRun: async () => ({ started: true, message: "ok" }),
    triggerStepTwoRun: async () => ({ started: true, message: "ok" }),
    stop: async () => undefined,
    approveAttempt: () => ({ ok: true, message: "ok" }),
    cancelAttempt: () => ({ ok: true, message: "ok" }),
    retryAttempt: async () => ({ started: true, message: "ok" }),
    deleteRun: () => ({ deleted: true, message: "deleted" }),
  };
}

describe("createServer", () => {
  test("allows local dashboard origins to call the API directly", async () => {
    const app = createServer(createCoordinatorStub() as never);

    const response = await request(app)
      .get("/api/state")
      .set("Origin", "http://127.0.0.1:5174");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5174");
  });

  test("responds to local API preflight requests", async () => {
    const app = createServer(createCoordinatorStub() as never);

    const response = await request(app)
      .options("/api/state")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"]).toContain("GET");
  });

  test("deletes a run through the API", async () => {
    const app = createServer(createCoordinatorStub() as never);

    const response = await request(app)
      .delete("/api/runs/run-123")
      .set("Origin", "http://127.0.0.1:5174");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("deleted");
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5174");
  });
});
