import type {
  AttemptStatus,
  DashboardRunEntry,
  DashboardRunRecord,
  DashboardSnapshot,
  RunRecordSummary,
  WorkflowLogEntry,
  WorkflowStage,
  WorkflowStep,
  WorkflowStepStatus,
} from "@shared/dashboard-contract";

export const moneyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
});

export type StatusTone = "neutral" | "live" | "success" | "warning" | "danger";

export function formatDate(value?: string): string {
  if (!value) {
    return "Nunca";
  }

  return new Date(value).toLocaleString("es-PE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLogTime(value?: string): string {
  if (!value) {
    return "--:--:--";
  }

  return new Date(value).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function compactStageTitle(title: string): string {
  return title.replace(/^Paso\s+\d+\s*:\s*/i, "").trim() || "Etapa";
}

export function labelForRunReason(reason: string): string {
  switch (reason) {
    case "manual":
      return "Lanzamiento manual";
    case "hourly":
      return "Revision programada";
    case "both":
      return "Manual y programada";
    case "retry":
      return "Reintento";
    case "step2":
      return "Solo paso 2";
    default:
      return reason;
  }
}

export function labelForRunStatus(status: RunRecordSummary["status"] | "active"): string {
  switch (status) {
    case "running":
    case "active":
      return "En ejecucion";
    case "completed":
      return "Completada";
    case "failed":
      return "Fallida";
    default:
      return status;
  }
}

export function labelForAttemptStatus(status: AttemptStatus): string {
  switch (status) {
    case "drafted":
      return "Recopilada";
    case "ready_for_review":
      return "Lista para revision";
    case "submitted":
      return "Enviada a SUNAT";
    case "failed":
      return "Con incidencia";
    default:
      return status;
  }
}

export function labelForStepStatus(status: WorkflowStepStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "active":
      return "En curso";
    case "completed":
      return "Completado";
    case "failed":
      return "Con error";
    default:
      return status;
  }
}

export function toneForStatus(
  status: RunRecordSummary["status"] | AttemptStatus | WorkflowStepStatus | "running",
): StatusTone {
  switch (status) {
    case "running":
    case "active":
      return "live";
    case "completed":
    case "submitted":
      return "success";
    case "ready_for_review":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function getRunSummary(run: DashboardRunRecord) {
  const summary = run.summary || {};

  return {
    observedSales: Number(summary.observedSales ?? 0),
    queuedSales: Number(summary.queuedSales ?? 0),
    submittedInvoices: Number(summary.submittedInvoices ?? 0),
    failedInvoices: Number(summary.failedInvoices ?? 0),
    cancelledInvoices: Number(summary.cancelledInvoices ?? 0),
  };
}

export function getIncidentCount(run: DashboardRunRecord): number {
  const summary = getRunSummary(run);
  return summary.failedInvoices + summary.cancelledInvoices;
}

export function buildFallbackWorkflow(run: DashboardRunRecord): WorkflowStage[] {
  const summary = getRunSummary(run);
  const stageOneStatus: WorkflowStepStatus =
    run.status === "failed" && summary.observedSales === 0 ? "failed" : "completed";
  const stageTwoStatus: WorkflowStepStatus = "pending";

  return [
    {
      id: "detectar_ventas",
      title: "Paso 1: Obtener informacion de ventas",
      description:
        "Entrar a Falabella, detectar ordenes con documento pendiente y exportar DNI, productos, precios y montos.",
      status: stageOneStatus,
      steps: [
        {
          id: "abrir_falabella",
          title: "Abrir Falabella",
          description: "Ingresar al seller y dejar la sesion lista.",
          status: stageOneStatus,
        },
        {
          id: "filtrar_ventas_pendientes",
          title: "Encontrar ventas pendientes",
          description: "Ir a Documentos tributarios y filtrar ordenes sin comprobante.",
          status: stageOneStatus,
        },
        {
          id: "leer_detalle_ventas",
          title: "Leer detalle de ventas",
          description: "Extraer DNI, cliente, productos, precios y montos por orden.",
          status: stageOneStatus,
        },
        {
          id: "exportar_json",
          title: "Exportar salida JSON",
          description: "Guardar el resultado del paso 1 como salida reutilizable.",
          status: stageOneStatus,
        },
      ],
    },
    {
      id: "registrar_facturas_sunat",
      title: "Paso 2: Registro de boleta electrónica",
      description:
        "Preparar, revisar y registrar la boleta en SUNAT; las boletas emitidas se agrupan en un ZIP de salida.",
      status: stageTwoStatus,
      steps: [
        {
          id: "abrir_sunat",
          title: "Abrir SUNAT",
          description: "Abrir el portal y autenticar la sesion.",
          status: stageTwoStatus,
        },
        {
          id: "cargar_factura_en_sunat",
          title: "Cargar comprobante",
          description: "Completar cliente, items y montos de la venta.",
          status: stageTwoStatus,
        },
        {
          id: "esperar_revision",
          title: "Esperar revision",
          description: "Pausar antes del envio final para aprobacion manual.",
          status: stageTwoStatus,
        },
        {
          id: "enviar_factura",
          title: "Registrar en SUNAT",
          description: "Enviar el comprobante y guardar el resultado.",
          status: stageTwoStatus,
        },
      ],
    },
  ];
}

export function getRunStages(run: DashboardRunRecord): WorkflowStage[] {
  return run.workflowStages.length ? run.workflowStages : buildFallbackWorkflow(run);
}

export function buildWorkflowProgressValue(run: DashboardRunRecord): number {
  const stages = getRunStages(run);

  if (!stages.length) {
    return 0;
  }

  const weight = 100 / stages.length;

  return stages.reduce((total, stage) => {
    if (stage.status === "completed") {
      return total + weight;
    }

    if (stage.status === "active") {
      return total + weight * 0.55;
    }

    if (stage.status === "failed") {
      return total + weight * 0.7;
    }

    return total;
  }, 0);
}

export function findRun(snapshot: DashboardSnapshot, runId?: string | null): DashboardRunRecord | null {
  if (!runId) {
    return null;
  }

  return snapshot.runs.find((run) => run.id === runId) ?? null;
}

export function findActiveRun(snapshot: DashboardSnapshot): DashboardRunRecord | null {
  return snapshot.runs.find((run) => run.id === snapshot.runtime.currentRunId) ?? null;
}

export function findPendingApproval(snapshot: DashboardSnapshot, attemptId: string) {
  return snapshot.runtime.pendingApprovals.find((pending) => pending.attemptId === attemptId);
}

export function findLivePendingApproval(snapshot: DashboardSnapshot) {
  return snapshot.runtime.pendingApprovals.find((pending) => pending.live) ?? null;
}

export function findLatestLog(
  run: DashboardRunRecord,
  predicate: (entry: WorkflowLogEntry) => boolean,
): WorkflowLogEntry | undefined {
  for (let index = run.logs.length - 1; index >= 0; index -= 1) {
    if (predicate(run.logs[index])) {
      return run.logs[index];
    }
  }

  return undefined;
}

export function findWorkflowStage(
  run: DashboardRunRecord,
  stageId?: string | null,
): WorkflowStage | null {
  if (!stageId) {
    return null;
  }

  return getRunStages(run).find((stage) => stage.id === stageId) ?? null;
}

export function findWorkflowStep(
  stage: WorkflowStage | null,
  stepId?: string | null,
): WorkflowStep | null {
  if (!stage || !stepId) {
    return null;
  }

  return stage.steps.find((step) => step.id === stepId) ?? null;
}

export function describeLogContext(run: DashboardRunRecord, log: WorkflowLogEntry) {
  const stage = findWorkflowStage(run, log.stageId);
  const step = findWorkflowStep(stage, log.stepId);

  return {
    stageLabel: compactStageTitle(stage?.title ?? log.stageId ?? "Etapa"),
    stepLabel: step?.title ?? log.stepId ?? "Evento del flujo",
  };
}

export function labelForLogLevel(level: WorkflowLogEntry["level"]): string {
  return level === "error" ? "ERROR" : "INFO";
}

export function resolveSelectedStageId(
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
  preferredStageId?: string | null,
): string | null {
  const stages = getRunStages(run);

  if (!stages.length) {
    return null;
  }

  if (preferredStageId && stages.some((stage) => stage.id === preferredStageId)) {
    return preferredStageId;
  }

  if (
    run.id === snapshot.runtime.currentRunId &&
    snapshot.runtime.currentWorkflowStageId &&
    stages.some((stage) => stage.id === snapshot.runtime.currentWorkflowStageId)
  ) {
    return snapshot.runtime.currentWorkflowStageId;
  }

  const activeStage = stages.find((stage) => stage.status === "active");
  if (activeStage) {
    return activeStage.id;
  }

  const failedStage = stages.find((stage) => stage.status === "failed");
  if (failedStage) {
    return failedStage.id;
  }

  const nextPendingStage = stages.find(
    (stage, index) =>
      stage.status === "pending" &&
      stages.slice(0, index).some((candidate) => candidate.status !== "pending"),
  );
  if (nextPendingStage) {
    return nextPendingStage.id;
  }

  for (let index = stages.length - 1; index >= 0; index -= 1) {
    if (stages[index].status !== "pending") {
      return stages[index].id;
    }
  }

  return stages[0].id;
}

export function resolveFocusedStep(
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
  stage: WorkflowStage,
): WorkflowStep | null {
  if (!stage.steps.length) {
    return null;
  }

  if (
    run.id === snapshot.runtime.currentRunId &&
    stage.id === snapshot.runtime.currentWorkflowStageId &&
    snapshot.runtime.currentWorkflowStepId
  ) {
    const runtimeStep = stage.steps.find((step) => step.id === snapshot.runtime.currentWorkflowStepId);
    if (runtimeStep) {
      return runtimeStep;
    }
  }

  return (
    stage.steps.find((step) => step.status === "active") ||
    stage.steps.find((step) => step.status === "failed") ||
    [...stage.steps].reverse().find((step) => step.status !== "pending") ||
    stage.steps[0]
  );
}

export function resolveUpcomingAction(
  run: DashboardRunRecord,
  snapshot: DashboardSnapshot,
  stage: WorkflowStage | null,
): string {
  const stages = getRunStages(run);

  if (!stages.length) {
    return "Sin accion pendiente";
  }

  if (!stage) {
    return run.status === "failed"
      ? "Revisar la incidencia y decidir si se relanza."
      : "Esperando la siguiente senal del flujo.";
  }

  const focusedStep = resolveFocusedStep(run, snapshot, stage);
  if (focusedStep) {
    const focusedStepIndex = stage.steps.findIndex((entry) => entry.id === focusedStep.id);
    const nextStep = stage.steps
      .slice(focusedStepIndex + 1)
      .find((entry) => entry.status === "pending" || entry.status === "active");

    if (nextStep) {
      return nextStep.title;
    }
  }

  const currentStageIndex = stages.findIndex((entry) => entry.id === stage.id);
  const nextStage = stages
    .slice(currentStageIndex + 1)
    .find((entry) => entry.status === "pending" || entry.status === "active");

  if (nextStage) {
    return compactStageTitle(nextStage.title);
  }

  if (run.status === "completed") {
    return "Corrida completada.";
  }

  if (run.status === "failed") {
    return "Revisar la incidencia y decidir si se relanza.";
  }

  return "Esperando la siguiente senal del flujo.";
}

export function buildEntrySummary(entry: DashboardRunEntry): string {
  const fragments = [
    moneyFormatter.format(entry.total),
    `Base ${moneyFormatter.format(entry.subtotal)}`,
    `IGV ${moneyFormatter.format(entry.tax)}`,
    `${entry.items.length} producto(s)`,
  ];

  if (entry.documentProgress) {
    fragments.push(entry.documentProgress);
  }

  if (entry.receiptNumber) {
    fragments.push(`Comprobante ${entry.receiptNumber}`);
  }

  return fragments.join(" · ");
}

export function buildRunSummaryText(run: DashboardRunRecord): string {
  const summary = getRunSummary(run);
  const exported = summary.queuedSales || summary.observedSales || run.entries.length;
  const incidents = getIncidentCount(run);

  return `${summary.observedSales} detectadas · ${exported} exportadas · ${incidents} incidencias`;
}
