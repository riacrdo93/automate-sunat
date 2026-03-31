import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { DashboardSnapshot } from "@shared/dashboard-contract";

type StreamState = "loading" | "connected" | "reconnecting" | "error";

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function buildDashboardApiUrl(baseUrl: string, endpoint: string): string {
  const normalizedBase = normalizeApiBase(baseUrl);
  return normalizedBase ? `${normalizedBase}${endpoint}` : endpoint;
}

export function getDashboardApiBaseCandidates(
  preferredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined,
): string[] {
  const seen = new Set<string>();
  const candidates = [preferredBaseUrl, "", "http://localhost:3030", "http://127.0.0.1:3030"];

  return candidates.reduce<string[]>((list, candidate) => {
    if (typeof candidate !== "string") {
      return list;
    }

    const normalizedCandidate = normalizeApiBase(candidate.trim());

    if (seen.has(normalizedCandidate)) {
      return list;
    }

    seen.add(normalizedCandidate);
    list.push(normalizedCandidate);
    return list;
  }, []);
}

export async function fetchDashboardSnapshot(apiBases: string[]): Promise<{
  snapshot: DashboardSnapshot;
  baseIndex: number;
}> {
  let lastError: unknown;

  for (let index = 0; index < apiBases.length; index += 1) {
    try {
      const response = await fetch(buildDashboardApiUrl(apiBases[index] ?? "", "/api/state"));

      if (!response.ok) {
        lastError = new Error("No se pudo cargar el estado inicial.");
        continue;
      }

      return {
        snapshot: (await response.json()) as DashboardSnapshot,
        baseIndex: index,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo cargar el dashboard.");
}

export function useDashboardState() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const applySnapshot = useEffectEvent((nextSnapshot: DashboardSnapshot) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setStreamState("connected");
      setError(null);
    });
  });

  useEffect(() => {
    const apiBases = getDashboardApiBaseCandidates();
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | undefined;
    let activeBaseIndex = 0;

    const getActiveBase = () => apiBases[activeBaseIndex] ?? "";
    const rotateApiBase = () => {
      if (apiBases.length <= 1) {
        return;
      }

      activeBaseIndex = (activeBaseIndex + 1) % apiBases.length;
    };

    const closeStream = () => {
      eventSource?.close();
      eventSource = null;
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      closeStream();
      eventSource = new EventSource(buildDashboardApiUrl(getActiveBase(), "/api/events"));
      eventSource.onmessage = (event) => {
        try {
          applySnapshot(JSON.parse(event.data) as DashboardSnapshot);
        } catch {
          setError("No se pudo interpretar la actualizacion en vivo.");
          setStreamState("error");
        }
      };

      eventSource.onerror = () => {
        closeStream();

        if (cancelled) {
          return;
        }

        rotateApiBase();
        setStreamState((current) => (current === "loading" ? "error" : "reconnecting"));
        reconnectTimer = window.setTimeout(connect, 1500);
      };
    };

    const bootstrap = async () => {
      try {
        const result = await fetchDashboardSnapshot(apiBases);
        activeBaseIndex = result.baseIndex;
        applySnapshot(result.snapshot);
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar el dashboard.");
          setStreamState("error");
        }
      } finally {
        connect();
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      closeStream();
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [applySnapshot, refreshTick]);

  return {
    snapshot,
    streamState,
    error,
    refresh() {
      setRefreshTick((current) => current + 1);
    },
  };
}
