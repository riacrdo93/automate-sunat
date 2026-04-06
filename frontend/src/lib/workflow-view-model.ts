import type {
  DashboardRunRecord,
  DashboardSnapshot,
  DashboardRunEntry,
  WorkflowLogEntry,
  WorkflowStage,
  WorkflowStepStatus,
} from "@shared/dashboard-contract";
import type {
  WorkflowHeaderStatus,
  WorkflowLogView,
  WorkflowOutputView,
  WorkflowStepView,
  WorkflowSubStepView,
  WorkflowTimelineStepView,
  WorkflowStatusView,
} from "../components/workflow/types";
import {
  findLivePendingApproval,
  formatDate,
  formatLogTime,
  getRunStages,
  getRunSummary,
  labelForRunReason,
} from "./dashboard";

const DATA_STAGE_ID = "detectar_ventas";
const REGISTRATION_STAGE_ID = "registrar_facturas_sunat";

/** El run solo está “en vivo” en runtime mientras el coordinador sigue ejecutándose. */
function isRunLive(run: DashboardRunRecord, snapshot: DashboardSnapshot): boolean {
  return snapshot.runtime.isRunning && run.id === snapshot.runtime.currentRunId;
}

function mapStatus(status: WorkflowStepStatus): WorkflowStatusView {
  switch (status) {
    case "active":
      return "running";
    default:
      return status;
  }
}

function mapLogLevel(level: WorkflowLogEntry["level"]): WorkflowLogView["level"] {
  return level === "error" ? "error" : "info";
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) {
    return "-";
  }

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return "-";
  }

  const totalSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function fallbackDuration(status: WorkflowStatusView): string {
  switch (status) {
    case "running":
      return "En curso";
    case "completed":
      return "Listo";
    case "failed":
      return "Con error";
    default:
      return "-";
  }
}

function buildLogMessage(log: WorkflowLogEntry): string {
  return log.saleExternalId ? `[${log.saleExternalId}] ${log.message}` : log.message;
}

function getStageLogs(run: DashboardRunRecord, stageId: string): WorkflowLogEntry[] {
  const logs = run.logs.filter((log) => log.stageId === stageId);

  if (
    logs.length === 0 &&
    stageId === REGISTRATION_STAGE_ID &&
    getRunSummary(run).queuedSales > 0
  ) {
    return [
      {
        at: run.endedAt ?? run.startedAt,
        level: "info",
        stageId,
        stepId: "abrir_sunat",
        message: `Paso 2 listo para abrir SUNAT con ${getRunSummary(run).queuedSales} venta(s).`,
      },
    ];
  }

  return logs;
}

function mapLogsToView(logs: WorkflowLogEntry[]): WorkflowLogView[] {
  return logs.map((log) => ({
    timestamp: formatLogTime(log.at),
    level: mapLogLevel(log.level),
    message: buildLogMessage(log),
  }));
}

function pickStepWindow(
  logs: WorkflowLogEntry[],
  status: WorkflowStatusView,
  fallbackStart?: string,
  fallbackEnd?: string,
): string {
  if (logs.length >= 2) {
    return formatDuration(logs[0].at, logs[logs.length - 1].at);
  }

  if (logs.length === 1 && fallbackEnd) {
    return formatDuration(logs[0].at, fallbackEnd);
  }

  if (fallbackStart && fallbackEnd) {
    return formatDuration(fallbackStart, fallbackEnd);
  }

  return fallbackDuration(status);
}

function minimalEntry(entry: DashboardRunEntry) {
  return {
    saleExternalId: entry.saleExternalId,
    customerName: entry.customerName,
    customerDocument: entry.customerDocument,
    total: entry.total,
    status: entry.status,
    documentProgress: entry.documentProgress,
    receiptNumber: entry.receiptNumber,
    error: entry.error,
  };
}

function parseExportedSalesJson(run: DashboardRunRecord): unknown[] {
  if (!run.outputJsonContent) {
    return [];
  }

  try {
    const parsed = JSON.parse(run.outputJsonContent) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseOutputJsonValue(run: DashboardRunRecord): unknown {
  if (!run.outputJsonContent) {
    return undefined;
  }

  try {
    return JSON.parse(run.outputJsonContent) as unknown;
  } catch {
    return run.outputJsonContent;
  }
}

function buildExtractionSummaryJson(run: DashboardRunRecord): string {
  const summary = getRunSummary(run);
  const exportedSales = parseExportedSalesJson(run);
  const exportedCount = exportedSales.length || summary.queuedSales || run.entries.length;
  const base = {
    observedSales: summary.observedSales,
    exportedSales: exportedCount,
    fields: [
      "orderNumber",
      "dni",
      "customerName",
      "products[].description",
      "products[].quantity",
      "products[].unitPrice",
      "products[].total",
      "total",
    ],
  };

  const resultado = parseOutputJsonValue(run);
  if (resultado !== undefined) {
    return JSON.stringify({ ...base, resultado }, null, 2);
  }

  return JSON.stringify(base, null, 2);
}

function buildOutputs(
  stage: WorkflowStage,
  run: DashboardRunRecord,
  stageLogs: WorkflowLogEntry[],
  snapshot: DashboardSnapshot,
): WorkflowOutputView[] {
  const outputs: WorkflowOutputView[] = [];

  if (stage.outputPath) {
    outputs.push({
      type: "text",
      label: "Ruta de salida",
      content: stage.outputCount ? `${stage.outputPath} (${stage.outputCount} venta(s))` : stage.outputPath,
    });
  }

  const firstStageId = getRunStages(run)[0]?.id;
  const embedsExportInResumen = stage.id === DATA_STAGE_ID && Boolean(run.outputJsonContent);

  if (run.outputJsonContent && stage.id === firstStageId && !embedsExportInResumen) {
    outputs.push({
      type: "json",
      label: "JSON de ventas",
      content: run.outputJsonContent,
    });
  } else if (run.outputJsonPath && stage.id === firstStageId) {
    outputs.push({
      type: "code",
      label: "Export JSON",
      content: run.outputJsonPath,
    });
  }

  if (stage.id === DATA_STAGE_ID) {
    outputs.push({
      type: "json",
      label: "Resumen de extraccion",
      content: buildExtractionSummaryJson(run),
    });
  } else {
    const summary = getRunSummary(run);
    if (!run.entries.length && summary.queuedSales > 0) {
      outputs.push({
        type: "text",
        label: "Preparacion SUNAT",
        content: `SUNAT queda lista para procesar ${summary.queuedSales} venta(s) detectada(s) en el paso 1.`,
      });
    }

    outputs.push({
      type: "json",
      label: "Resultado SUNAT",
      content: JSON.stringify(run.entries.map(minimalEntry), null, 2),
    });
  }

  if (stage.id === REGISTRATION_STAGE_ID) {
    const folderFromSummary =
      typeof run.summary.boletasDownloadDir === "string" ? run.summary.boletasDownloadDir : undefined;
    const outputFolder =
      folderFromSummary
      ?? (stage.outputPath && !stage.outputPath.toLowerCase().endsWith(".zip") ? stage.outputPath : undefined);

    if (outputFolder) {
      const count = typeof stage.outputCount === "number" ? stage.outputCount : undefined;
      outputs.push({
        type: "text",
        label: "Carpeta de boletas electrónicas",
        content: typeof count === "number" ? `${outputFolder} (${count} boleta(s))` : outputFolder,
      });
    }
  }

  const pendingApproval = findLivePendingApproval(snapshot);
  if (pendingApproval && stage.id === snapshot.runtime.currentWorkflowStageId) {
    outputs.push({
      type: "text",
      label: "Revision humana",
      content: `Esperando decision para ${pendingApproval.saleExternalId}.`,
    });
  }

  if (!stageLogs.length && !outputs.length) {
    outputs.push({
      type: "text",
      label: "Estado",
      content: "Sin salida disponible para esta etapa todavia.",
    });
  }

  return outputs;
}

function buildSubSteps(
  stage: WorkflowStage,
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
  stageLogs: WorkflowLogEntry[],
): WorkflowSubStepView[] {
  const live = isRunLive(run, snapshot);
  const runEnded = Boolean(run.endedAt) || run.status !== "running";

  return stage.steps.map((step) => {
    const logs = run.logs.filter((log) => log.stageId === stage.id && log.stepId === step.id);
    const backendMapped = mapStatus(step.status);
    const isLiveFocused =
      live &&
      snapshot.runtime.currentWorkflowStageId === stage.id &&
      snapshot.runtime.currentWorkflowStepId === step.id;

    const hasErrorLog = logs.some((l) => l.level === "error");
    const lastErrorLog = [...logs].reverse().find((l) => l.level === "error");
    const lastAnyLog = logs[logs.length - 1];

    let viewStatus: WorkflowStatusView = backendMapped;
    if (isLiveFocused) {
      viewStatus = "running";
    } else if (backendMapped === "running" && runEnded) {
      viewStatus = run.status === "failed" || hasErrorLog ? "failed" : "completed";
    } else if (run.status === "failed" && step.status === "active") {
      viewStatus = "failed";
    }

    const detailMessage = isLiveFocused
      ? snapshot.runtime.currentStep
      : lastErrorLog?.message ?? lastAnyLog?.message;

    const durationEnd =
      viewStatus === "running" && isLiveFocused
        ? snapshot.runtime.lastCheckAt
        : lastAnyLog?.at ?? run.endedAt;

    return {
      id: step.id,
      name: step.title,
      status: viewStatus,
      detail: detailMessage,
      duration: pickStepWindow(logs, viewStatus, logs[0]?.at ?? stageLogs[0]?.at, durationEnd),
    };
  });
}

function buildStepView(
  stage: WorkflowStage,
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
  overrides: Partial<Pick<WorkflowStepView, "id" | "name" | "description" | "status" | "subSteps" | "logs" | "outputs">> = {},
): WorkflowStepView {
  const stageLogs = getStageLogs(run, stage.id);
  const live = isRunLive(run, snapshot);
  const stageMapped = mapStatus(stage.status);
  const isLiveStage = live && snapshot.runtime.currentWorkflowStageId === stage.id;
  const runEnded = Boolean(run.endedAt) || run.status !== "running";
  const stageHasError = stageLogs.some((l) => l.level === "error");

  let stageViewStatus: WorkflowStatusView = stageMapped;
  if (isLiveStage) {
    stageViewStatus = "running";
  } else if (stageMapped === "running" && runEnded) {
    stageViewStatus = run.status === "failed" || stageHasError ? "failed" : "completed";
  } else if (run.status === "failed" && stage.status === "active") {
    stageViewStatus = "failed";
  }

  const resolvedStatus = overrides.status ?? stageViewStatus;
  const start = stageLogs[0]?.at ?? run.startedAt;
  const end =
    resolvedStatus === "running"
      ? snapshot.runtime.lastCheckAt ?? stageLogs[stageLogs.length - 1]?.at
      : stageLogs[stageLogs.length - 1]?.at ?? run.endedAt;

  return {
    id: overrides.id ?? stage.id,
    name: overrides.name ?? stage.title,
    description: overrides.description ?? stage.description,
    status: resolvedStatus,
    startTime: formatDate(start),
    endTime: end ? formatDate(end) : undefined,
    duration: pickStepWindow(stageLogs, resolvedStatus, start, end),
    subSteps: overrides.subSteps ?? buildSubSteps(stage, run, snapshot, stageLogs),
    logs: overrides.logs ?? mapLogsToView(stageLogs),
    outputs: overrides.outputs ?? buildOutputs(stage, run, stageLogs, snapshot),
  };
}

export function buildWorkflowSteps(run: DashboardRunRecord, snapshot: DashboardSnapshot): WorkflowStepView[] {
  const stages = getRunStages(run);
  const dataStage = stages.find((stage) => stage.id === DATA_STAGE_ID) ?? stages[0];
  const registrationStage =
    stages.find((stage) => stage.id === REGISTRATION_STAGE_ID)
    ?? stages.find((stage) => stage.id !== DATA_STAGE_ID)
    ?? stages[1];

  const steps: WorkflowStepView[] = [];

  if (dataStage) {
    steps.push(
      buildStepView(dataStage, run, snapshot, {
        name: "Obtencion de informacion de ventas",
        description: "Leemos las ventas pendientes desde Falabella y generamos el JSON con DNI, productos y precios.",
      }),
    );
  }

  if (registrationStage) {
    steps.push(
      buildStepView(registrationStage, run, snapshot, {
        name: "Registro de boleta electrónica",
        description:
          "Emitimos las boletas en SUNAT con revisión humana cuando aplica; al finalizar, los PDFs quedan guardados en una carpeta.",
      }),
    );
  }

  return steps;
}

export function buildWorkflowTimelineSteps(
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
): WorkflowTimelineStepView[] {
  return buildWorkflowSteps(run, snapshot).map((step) => ({
    id: step.id,
    name: step.name,
    status: step.status,
    duration: step.duration,
  }));
}

export function resolveWorkflowActiveStepId(
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
  selectedStageId?: string | null,
): string {
  const steps = buildWorkflowSteps(run, snapshot);

  if (selectedStageId && steps.some((step) => step.id === selectedStageId)) {
    return selectedStageId;
  }

  if (
    run.id === snapshot.runtime.currentRunId
    && snapshot.runtime.currentWorkflowStageId
    && steps.some((step) => step.id === snapshot.runtime.currentWorkflowStageId)
  ) {
    return snapshot.runtime.currentWorkflowStageId;
  }

  const runningStep = steps.find((step) => step.status === "running");
  if (runningStep) {
    return runningStep.id;
  }

  const failedStep = steps.find((step) => step.status === "failed");
  if (failedStep) {
    return failedStep.id;
  }

  const nextPendingStep = steps.find(
    (step, index) =>
      step.status === "pending" &&
      steps.slice(0, index).some((candidate) => candidate.status !== "pending"),
  );
  if (nextPendingStep) {
    return nextPendingStep.id;
  }

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index].status !== "pending") {
      return steps[index].id;
    }
  }

  return steps[0]?.id ?? "";
}

export function buildWorkflowHeader(run: DashboardRunRecord, snapshot: DashboardSnapshot) {
  const steps = buildWorkflowSteps(run, snapshot);
  const completedSteps = steps.filter((step) => step.status === "completed").length;
  const summary = getRunSummary(run);
  const hasPendingContinuation =
    summary.queuedSales > 0 &&
    steps.some(
      (step, index) =>
        step.status === "pending" &&
        steps.slice(0, index).some((candidate) => candidate.status !== "pending"),
    );
  const runLive = isRunLive(run, snapshot);
  const status: WorkflowHeaderStatus =
    runLive && snapshot.runtime.pendingApprovals.length
      ? "paused"
      : runLive
        ? "running"
        : hasPendingContinuation
          ? "paused"
          : run.status === "completed"
            ? "completed"
            : "failed";
  const totalDuration = formatDuration(
    run.startedAt,
    run.endedAt ??
      snapshot.runtime.lastCheckAt ??
      run.logs[run.logs.length - 1]?.at,
  );

  return {
    workflowName: "Seller a SUNAT",
    status,
    branch: labelForRunReason(run.reason),
    totalDuration,
    completedSteps,
    totalSteps: steps.length,
  };
}
