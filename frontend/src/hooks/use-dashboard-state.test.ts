import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDashboardApiUrl,
  fetchDashboardSnapshot,
  getDashboardApiBaseCandidates,
} from "./use-dashboard-state";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useDashboardState helpers", () => {
  it("keeps unique API base candidates in fallback order", () => {
    expect(getDashboardApiBaseCandidates("http://localhost:3030/")).toEqual([
      "http://localhost:3030",
      "",
      "http://127.0.0.1:3030",
    ]);
  });

  it("builds relative and absolute API URLs safely", () => {
    expect(buildDashboardApiUrl("", "/api/state")).toBe("/api/state");
    expect(buildDashboardApiUrl("http://localhost:3030/", "/api/events")).toBe(
      "http://localhost:3030/api/events",
    );
  });

  it("tries the next API base when the first one fails by network error", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("proxy down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          config: {
            profile: "custom",
            runMode: "manual",
            autoContinueStepTwo: false,
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
          runs: [],
          sales: [],
          attempts: [],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDashboardSnapshot(["", "http://127.0.0.1:3030"]);

    expect(result.baseIndex).toBe(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/state");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:3030/api/state");
  });
});
