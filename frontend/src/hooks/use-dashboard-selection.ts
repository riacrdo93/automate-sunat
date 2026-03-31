import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot } from "@shared/dashboard-contract";

function readSelectionFromLocation() {
  const url = new URL(window.location.href);

  return {
    runId: url.searchParams.get("run"),
    stageId: url.searchParams.get("stage"),
  };
}

function writeSelectionToLocation(runId?: string | null, stageId?: string | null) {
  const url = new URL(window.location.href);

  if (runId) {
    url.searchParams.set("run", runId);
  } else {
    url.searchParams.delete("run");
  }

  if (runId && stageId) {
    url.searchParams.set("stage", stageId);
  } else {
    url.searchParams.delete("stage");
  }

  window.history.replaceState({}, "", url);
}

export function useDashboardSelection(snapshot: DashboardSnapshot | null) {
  const [selection, setSelection] = useState(() => readSelectionFromLocation());

  useEffect(() => {
    const onPopState = () => {
      setSelection(readSelectionFromLocation());
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!snapshot || !selection.runId) {
      return;
    }

    const runStillExists = snapshot.runs.some((run) => run.id === selection.runId);

    if (!runStillExists) {
      writeSelectionToLocation(null, null);
      setSelection({ runId: null, stageId: null });
    }
  }, [selection.runId, snapshot]);

  const api = useMemo(
    () => ({
      selectedRunId: selection.runId,
      selectedStageId: selection.stageId,
      openRun(runId: string, stageId?: string | null) {
        writeSelectionToLocation(runId, stageId ?? null);
        setSelection({ runId, stageId: stageId ?? null });
      },
      closeRun() {
        writeSelectionToLocation(null, null);
        setSelection({ runId: null, stageId: null });
      },
      selectStage(stageId: string | null) {
        writeSelectionToLocation(selection.runId, stageId);
        setSelection((current) => ({ ...current, stageId }));
      },
    }),
    [selection.runId, selection.stageId],
  );

  return api;
}
