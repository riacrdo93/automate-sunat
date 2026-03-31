import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import {
  AutomationError,
  InvoiceEmitter,
  OperatorCancelledError,
  PreparedSubmission,
  SellerSource,
  StepReporter,
} from "./browser";
import { AppConfig } from "./config";
import {
  DashboardSnapshot,
  Sale,
  saleToInvoiceDraft,
  WorkflowLogEntry,
  WorkflowStage,
  WorkflowStepStatus,
} from "./domain";
import { RunStore } from "./store";

type ApprovalDecision = "approve" | "cancel";
type ApprovalOutcome = {
  decision: ApprovalDecision;
  message?: string;
  interrupted?: boolean;
};

type PendingApproval = {
  attemptId: string;
  saleExternalId: string;
  createdAt: string;
  resolve: (decision: ApprovalDecision) => void;
};

type RunProgress = {
  summary: {
    observedSales: number;
    queuedSales: number;
    submittedInvoices: number;
    failedInvoices: number;
    cancelledInvoices: number;
  };
  workflowStages: WorkflowStage[];
  logs: WorkflowLogEntry[];
  outputJsonPath?: string;
  outputJsonContent?: string;
  currentWorkflowStageId?: string;
  currentWorkflowStepId?: string;
};

type RunReason = "manual" | "hourly" | "retry" | "step2";

type StepTwoReadiness = {
  available: boolean;
  pendingSales: number;
  message: string;
};

export class AutomationCoordinator {
  readonly events = new EventEmitter();
  private interval?: NodeJS.Timeout;
  private runInFlight = false;
  private activeRunPromise?: Promise<{ started: boolean; message: string }>;
  private pendingApprovals = new Map<string, PendingApproval>();
  private runProgressById = new Map<string, RunProgress>();
  private runtime = {
    isRunning: false,
    currentRunId: undefined as string | undefined,
    currentSaleId: undefined as string | undefined,
    currentStep: "En espera",
    lastCheckAt: undefined as string | undefined,
    nextCheckAt: undefined as string | undefined,
    currentWorkflowStageId: undefined as string | undefined,
    currentWorkflowStepId: undefined as string | undefined,
  };

  constructor(
    private readonly config: AppConfig,
    private readonly store: RunStore,
    private readonly sellerSource: SellerSource,
    private readonly invoiceEmitter: InvoiceEmitter,
  ) {
    this.refreshNextCheckAt();
  }

  start(): void {
    if (this.config.runMode === "hourly" || this.config.runMode === "both") {
      if (this.interval) {
        return;
      }

      const intervalMs = this.config.checkIntervalMinutes * 60 * 1000;
      this.launchRun("hourly");
      this.interval = setInterval(() => {
        this.launchRun("hourly");
      }, intervalMs);
      this.refreshNextCheckAt();
      this.publish();
    }
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    for (const pending of this.pendingApprovals.values()) {
      pending.resolve("cancel");
    }

    this.pendingApprovals.clear();
    await this.activeRunPromise?.catch(() => undefined);
    this.runtime.nextCheckAt = undefined;
    this.publish();
  }

  async triggerManualRun(): Promise<{ started: boolean; message: string }> {
    if (this.runInFlight) {
      return { started: false, message: "Ya hay una ejecución en progreso." };
    }

    this.launchRun("manual");
    return { started: true, message: "Ejecución iniciada." };
  }

  async triggerStepTwoRun(): Promise<{ started: boolean; message: string }> {
    if (this.runInFlight) {
      return { started: false, message: "Ya hay una ejecución en progreso." };
    }

    const reusableSales = this.store.getPendingSalesForRegistration();

    if (!reusableSales.length) {
      return {
        started: false,
        message: "No hay ventas guardadas del paso 1 listas para ejecutar el paso 2.",
      };
    }

    this.launchRun("step2", reusableSales, true);
    return {
      started: true,
      message: `Paso 2 iniciado con ${reusableSales.length} venta(s) guardada(s) del paso 1.`,
    };
  }

  async retryAttempt(attemptId: string): Promise<{ started: boolean; message: string }> {
    const attempt = this.store.getAttempt(attemptId);

    if (!attempt) {
      return { started: false, message: "No se encontr? el intento." };
    }

    if (attempt.status === "submitted") {
      return { started: false, message: "Los intentos ya enviados no se pueden reintentar." };
    }

    const sale = this.store.getSaleForAttempt(attemptId);

    if (!sale) {
      return { started: false, message: "La venta vinculada a este intento ya no est? disponible." };
    }

    if (this.runInFlight) {
      return { started: false, message: "Ya hay una ejecución en progreso." };
    }

    this.launchRun("retry", [sale]);
    return { started: true, message: "Reintento iniciado." };
  }

  approveAttempt(attemptId: string): { ok: boolean; message: string } {
    const pending = this.pendingApprovals.get(attemptId);

    if (!pending) {
      return {
        ok: false,
        message: "Esa factura ya no est? esperando aprobaci?n en vivo. Usa reintentar para volver a abrirla.",
      };
    }

    pending.resolve("approve");
    return { ok: true, message: "Env?o aprobado." };
  }

  cancelAttempt(attemptId: string): { ok: boolean; message: string } {
    const pending = this.pendingApprovals.get(attemptId);

    if (!pending) {
      return {
        ok: false,
        message: "Esa factura ya no est? esperando aprobaci?n en vivo.",
      };
    }

    pending.resolve("cancel");
    return { ok: true, message: "Env?o pendiente cancelado." };
  }

  deleteRun(runId: string): { deleted: boolean; message: string } {
    if (this.runInFlight && this.runtime.currentRunId === runId) {
      return {
        deleted: false,
        message: "No puedes eliminar un workflow mientras sigue en ejecución.",
      };
    }

    const result = this.store.deleteRun(runId);

    if (result.deleted) {
      this.publish();
    }

    return result;
  }

  getSnapshot(): DashboardSnapshot {
    const dashboardData = this.store.getDashboardData();
    const stepTwoReady = this.getStepTwoReadiness();

    return {
      config: {
        profile: this.config.profileKind,
        runMode: this.config.runMode,
        checkIntervalMinutes: this.config.checkIntervalMinutes,
        headful: this.config.headful,
        baseUrl: this.config.appBaseUrl,
      },
      runtime: {
        ...this.runtime,
        pendingApprovals: dashboardData.attempts
          .filter((attempt) => attempt.status === "ready_for_review")
          .map((attempt) => ({
            attemptId: attempt.id,
            saleExternalId: attempt.saleExternalId,
            createdAt: attempt.updatedAt,
            live: this.pendingApprovals.has(attempt.id),
          })),
        stepTwoReady,
      },
      sales: dashboardData.sales,
      attempts: dashboardData.attempts,
      runs: dashboardData.runs,
    };
  }

  private async run(
    reason: RunReason,
    retrySales?: Sale[],
    stepTwoOnly = false,
  ): Promise<{ started: boolean; message: string }> {
    if (this.runInFlight) {
      return { started: false, message: "Ya hay una ejecución en progreso." };
    }

    this.runInFlight = true;
    this.runtime.isRunning = true;
    this.runtime.currentStep =
      reason === "retry"
        ? "Reintentando venta fallida"
        : stepTwoOnly
          ? "Reutilizando ventas guardadas para el paso 2"
          : "Iniciando automatizaci?n";
    this.runtime.currentSaleId = undefined;
    this.runtime.currentRunId = this.store.createRun(reason);
    this.initializeRunProgress(this.runtime.currentRunId);
    this.publish();

    try {
      this.runtime.lastCheckAt = new Date().toISOString();
      let observedSales: Sale[] = [];
      let salesForSunat: Sale[] = [];

      if (stepTwoOnly) {
        observedSales = retrySales ?? [];
        salesForSunat = observedSales;
        this.currentRunProgress().summary.observedSales = observedSales.length;
        this.currentRunProgress().summary.queuedSales = salesForSunat.length;
        this.completeStage("detectar_ventas", observedSales.length);
        this.appendRunLog({
          level: "info",
          stageId: "detectar_ventas",
          stepId: "exportar_json",
          message: `Paso 1 reutilizado: ${observedSales.length} venta(s) guardada(s) quedaron listas para SUNAT.`,
        });
      } else {
        this.advanceWorkflow("detectar_ventas", "abrir_falabella", "Automatizaci?n iniciada.");
        if (reason === "retry" && retrySales?.length === 1) {
          const targetSale = retrySales[0];
          const refreshedSale = await this.sellerSource.refreshSale(
            targetSale.externalId,
            this.stepReporter(targetSale.externalId),
          );
          observedSales = refreshedSale ? [refreshedSale] : retrySales;
        } else {
          observedSales = retrySales ?? (await this.sellerSource.fetchSales(this.stepReporter()));
        }
        this.currentRunProgress().summary.observedSales = observedSales.length;
        this.advanceWorkflow(
          "detectar_ventas",
          "leer_detalle_ventas",
          `Se detectaron ${observedSales.length} venta(s) con documento pendiente en Falabella.`,
        );

        const output = this.writePendingSalesOutput(this.runtime.currentRunId!, observedSales);
        this.currentRunProgress().outputJsonPath = output.path;
        this.currentRunProgress().outputJsonContent = output.content;
        this.advanceWorkflow(
          "detectar_ventas",
          "exportar_json",
          `Se export? el JSON del paso 1 en ${output.path}.`,
        );
        this.completeStage("detectar_ventas", observedSales.length, output.path);

        this.store.registerObservedSales(observedSales);
        salesForSunat = this.store.getSalesForRegistration(
          observedSales.map((sale) => sale.externalId),
        );
        this.currentRunProgress().summary.queuedSales = salesForSunat.length;

        if (observedSales.length > salesForSunat.length) {
          this.appendRunLog({
            level: "info",
            stageId: "registrar_facturas_sunat",
            stepId: "abrir_sunat",
            message:
              salesForSunat.length > 0
                ? `Se omiten ${observedSales.length - salesForSunat.length} venta(s) porque ya estaban en revisión o enviadas a SUNAT.`
                : "Las ventas detectadas ya estaban en revisión o enviadas a SUNAT; no se abrir? una nueva sesi?n de registro.",
          });
        }
      }

      if (salesForSunat.length > 0) {
        await this.processSunatRegistrations(salesForSunat);
      }

      this.runtime.currentStep = stepTwoOnly
        ? `Paso 2 completado con ${salesForSunat.length} venta(s) guardada(s) del paso 1`
        : salesForSunat.length > 0
          ? `Paso 2 preparado para ${salesForSunat.length} venta(s) exportada(s) desde Falabella`
          : observedSales.length > 0
            ? `Paso 1 completado: ${observedSales.length} venta(s) exportada(s); sin nuevas ventas para SUNAT`
            : "Paso 1 completado: no se encontraron ventas pendientes";
      this.refreshNextCheckAt();
      this.syncRunProgress();
      this.publish();

      const progress = this.currentRunProgress();
      const sunatStage = progress.workflowStages.find((s) => s.id === "registrar_facturas_sunat");
      const runEndedFailed =
        sunatStage?.status === "failed" ||
        (progress.summary.failedInvoices > 0 &&
          progress.summary.submittedInvoices === 0 &&
          progress.summary.cancelledInvoices === 0);

      this.store.finishRun(
        this.runtime.currentRunId!,
        runEndedFailed ? "failed" : "completed",
        this.buildRunSummaryPayload(),
      );
      return { started: true, message: "Ejecución iniciada." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallo desconocido en la automatizaci?n.";
      this.failCurrentWorkflowStep(message);
      this.store.finishRun(this.runtime.currentRunId!, "failed", {
        ...this.buildRunSummaryPayload(),
        error: message,
      });
      return {
        started: false,
        message,
      };
    } finally {
      if (this.runtime.currentRunId) {
        this.runProgressById.delete(this.runtime.currentRunId);
      }
      this.runtime.isRunning = false;
      this.runtime.currentRunId = undefined;
      this.runtime.currentSaleId = undefined;
      this.runtime.currentStep = "En espera";
      this.runtime.currentWorkflowStageId = undefined;
      this.runtime.currentWorkflowStepId = undefined;
      this.runInFlight = false;
      this.refreshNextCheckAt();
      this.publish();
    }
  }

  private async processSunatRegistrations(sales: Sale[]): Promise<void> {
    const runId = this.runtime.currentRunId;
    if (!runId) {
      return;
    }

    let submitted = 0;
    let failed = 0;
    let cancelled = 0;

    this.advanceWorkflow(
      "registrar_facturas_sunat",
      "abrir_sunat",
      "Iniciando paso 2: registro en SUNAT.",
    );

    for (const sale of sales) {
      const draft = saleToInvoiceDraft(sale);
      const attemptId = this.store.createAttempt(sale.externalId, draft, runId);
      this.store.setSaleStatus(sale.externalId, "drafted", attemptId);

      let submission: PreparedSubmission | undefined;

      try {
        submission = await this.invoiceEmitter.prepareSubmission(
          attemptId,
          draft,
          this.stepReporter(sale.externalId),
        );
      } catch (error) {
        if (error instanceof OperatorCancelledError) {
          cancelled += 1;
        } else {
          failed += 1;
        }
        const message =
          error instanceof AutomationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Error al preparar el envío en SUNAT.";
        const artifacts = error instanceof AutomationError ? error.artifacts : [];
        this.store.markAttemptFailed(attemptId, message, artifacts);
        this.store.setSaleStatus(sale.externalId, "failed", attemptId);
        this.appendRunLog({
          level: "error",
          stageId: "registrar_facturas_sunat",
          stepId: "cargar_factura_en_sunat",
          message,
          saleExternalId: sale.externalId,
        });
        this.syncRegistrationSummary(submitted, failed, cancelled);
        this.publish();
        if (error instanceof OperatorCancelledError) {
          throw error;
        }
        continue;
      }

      this.store.markAttemptReadyForReview(attemptId, submission.preSubmitArtifacts);
      this.store.setSaleStatus(sale.externalId, "ready_for_review", attemptId);

      const approval = await this.waitForApproval(attemptId, sale.externalId, submission);

      if (approval.decision === "cancel") {
        cancelled += 1;
        if (approval.interrupted) {
          const interruptionMessage =
            approval.message ?? "Flujo cancelado porque el operador cerr? el navegador.";
          this.store.markAttemptFailed(attemptId, interruptionMessage);
          this.store.setSaleStatus(sale.externalId, "failed", attemptId);
          this.appendRunLog({
            level: "error",
            stageId: "registrar_facturas_sunat",
            stepId: "esperar_revision",
            message: interruptionMessage,
            saleExternalId: sale.externalId,
          });
          this.syncRegistrationSummary(submitted, failed, cancelled);
          this.publish();
          throw new OperatorCancelledError(interruptionMessage);
        }

        try {
          const cancelArtifacts = await submission.cancel(this.stepReporter(sale.externalId));
          this.store.appendAttemptArtifacts(attemptId, cancelArtifacts);
        } catch {
          /* ignore */
        }
        this.store.markAttemptFailed(attemptId, "Cancelado por el operador.");
        this.store.setSaleStatus(sale.externalId, "failed", attemptId);
        this.appendRunLog({
          level: "info",
          stageId: "registrar_facturas_sunat",
          stepId: "esperar_revision",
          message: `Env?o cancelado para la orden ${sale.externalId}.`,
          saleExternalId: sale.externalId,
        });
        this.syncRegistrationSummary(submitted, failed, cancelled);
        this.publish();
        continue;
      }

      try {
        const result = await submission.submit(this.stepReporter(sale.externalId));
        submitted += 1;
        this.store.markAttemptSubmitted(attemptId, result.artifacts, result.receiptNumber);
        this.store.setSaleStatus(sale.externalId, "submitted", attemptId);
        this.completeWorkflowStep(
          "registrar_facturas_sunat",
          "enviar_factura",
          result.receiptNumber
            ? `Boleta registrada para ${sale.externalId} (${result.receiptNumber}).`
            : `Boleta registrada para ${sale.externalId}.`,
          sale.externalId,
        );
      } catch (error) {
        if (error instanceof OperatorCancelledError) {
          cancelled += 1;
        } else {
          failed += 1;
        }
        const message =
          error instanceof AutomationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Error al enviar el comprobante a SUNAT.";
        const artifacts = error instanceof AutomationError ? error.artifacts : [];
        this.store.markAttemptFailed(attemptId, message, artifacts);
        this.store.setSaleStatus(sale.externalId, "failed", attemptId);
        this.appendRunLog({
          level: "error",
          stageId: "registrar_facturas_sunat",
          stepId: "enviar_factura",
          message,
          saleExternalId: sale.externalId,
        });
        this.syncRegistrationSummary(submitted, failed, cancelled);
        this.publish();
        if (error instanceof OperatorCancelledError) {
          throw error;
        }
        continue;
      }

      this.syncRegistrationSummary(submitted, failed, cancelled);
      this.publish();
    }

    this.syncRegistrationSummary(submitted, failed, cancelled);

    if (submitted === 0 && failed > 0 && cancelled === 0) {
      this.failWorkflowStep(
        "registrar_facturas_sunat",
        "cargar_factura_en_sunat",
        "No se pudo completar el registro en SUNAT para ninguna venta.",
      );
    } else {
      this.completeStage("registrar_facturas_sunat", submitted);
    }
  }

  private launchRun(reason: RunReason, retrySales?: Sale[], stepTwoOnly = false): void {
    const trackedPromise = this.run(reason, retrySales, stepTwoOnly).finally(() => {
      if (this.activeRunPromise === trackedPromise) {
        this.activeRunPromise = undefined;
      }
    });
    this.activeRunPromise = trackedPromise;
  }

  private waitForApproval(
    attemptId: string,
    saleExternalId: string,
    submission: PreparedSubmission,
  ): Promise<ApprovalOutcome> {
    this.runtime.currentStep = `Esperando aprobaci?n para ${saleExternalId}`;
    const createdAt = new Date().toISOString();
    this.advanceWorkflow(
      "registrar_facturas_sunat",
      "esperar_revision",
      `La orden ${saleExternalId} quedó lista para revisión antes de enviarla a SUNAT.`,
      saleExternalId,
    );

    return new Promise<ApprovalOutcome>((resolve) => {
      let settled = false;
      const finish = (outcome: ApprovalOutcome) => {
        if (settled) {
          return;
        }

        settled = true;
        this.pendingApprovals.delete(attemptId);
        resolve(outcome);
      };

      this.pendingApprovals.set(attemptId, {
        attemptId,
        saleExternalId,
        createdAt,
        resolve: (decision) => {
          finish({ decision });
        },
      });

      void submission.waitForInterruption().then((message) => {
        finish({
          decision: "cancel",
          message,
          interrupted: true,
        });
      });

      this.publish();
    });
  }

  private syncRegistrationSummary(submitted: number, failed: number, cancelled: number): void {
    const summary = this.currentRunProgress().summary;
    summary.submittedInvoices = submitted;
    summary.failedInvoices = failed;
    summary.cancelledInvoices = cancelled;
    this.syncRunProgress();
  }

  private stepReporter(saleExternalId?: string): StepReporter {
    return async (step: string) => {
      this.runtime.currentStep = step;
      if (saleExternalId) {
        this.runtime.currentSaleId = saleExternalId;
      }
      this.recordWorkflowStep(step, saleExternalId);
      this.publish();
    };
  }

  private refreshNextCheckAt(): void {
    if (this.config.runMode === "manual") {
      this.runtime.nextCheckAt = undefined;
      return;
    }

    this.runtime.nextCheckAt = new Date(
      Date.now() + this.config.checkIntervalMinutes * 60 * 1000,
    ).toISOString();
  }

  private publish(): void {
    this.events.emit("state");
  }

  private getStepTwoReadiness(): StepTwoReadiness {
    const pendingSales = this.store.getPendingSalesForRegistration().length;

    if (!pendingSales) {
      return {
        available: false,
        pendingSales: 0,
        message: "No hay ventas guardadas del paso 1 listas para ejecutar solo el paso 2.",
      };
    }

    return {
      available: true,
      pendingSales,
      message: `${pendingSales} venta(s) guardada(s) del paso 1 listas para ejecutar solo el paso 2.`,
    };
  }

  private initializeRunProgress(runId: string): void {
    const progress: RunProgress = {
      summary: {
        observedSales: 0,
        queuedSales: 0,
        submittedInvoices: 0,
        failedInvoices: 0,
        cancelledInvoices: 0,
      },
      workflowStages: buildWorkflowTemplate(),
      logs: [],
    };
    this.runProgressById.set(runId, progress);
    this.syncRunProgress();
  }

  private currentRunProgress(): RunProgress {
    const runId = this.runtime.currentRunId;
    const progress = runId ? this.runProgressById.get(runId) : undefined;

    if (!runId || !progress) {
      throw new Error("No hay una ejecución activa para actualizar el flujo.");
    }

    return progress;
  }

  private syncRunProgress(): void {
    const runId = this.runtime.currentRunId;
    if (!runId) {
      return;
    }

    this.store.updateRunSummary(runId, this.buildRunSummaryPayload());
  }

  private buildRunSummaryPayload(): Record<string, unknown> {
    const progress = this.currentRunProgress();

    return {
      ...progress.summary,
      workflowStages: progress.workflowStages,
      logs: progress.logs,
      outputJsonPath: progress.outputJsonPath,
      outputJsonContent: progress.outputJsonContent,
    };
  }

  private appendRunLog(entry: {
    level: "info" | "error";
    stageId: string;
    stepId: string;
    message: string;
    saleExternalId?: string;
  }): void {
    const progress = this.currentRunProgress();
    progress.logs = [
      ...progress.logs.slice(-119),
      {
        at: new Date().toISOString(),
        ...entry,
      },
    ];
    this.syncRunProgress();
  }

  private advanceWorkflow(
    stageId: string,
    stepId: string,
    message: string,
    saleExternalId?: string,
  ): void {
    const progress = this.currentRunProgress();
    let reachedTarget = false;

    progress.workflowStages = progress.workflowStages.map((stage): WorkflowStage => {
      if (reachedTarget) {
        return {
          ...stage,
          status: keepFailedStatus(stage.status, "pending"),
          steps: stage.steps.map((step) => ({
            ...step,
            status: keepFailedStatus(step.status, "pending"),
          })),
        };
      }

      if (stage.id !== stageId) {
        const completedStage: WorkflowStage = {
          ...stage,
          status: keepFailedStatus(stage.status, "completed"),
          steps: stage.steps.map((step) => ({
            ...step,
            status: keepFailedStatus(step.status, "completed"),
          })),
        };
        return completedStage;
      }

      reachedTarget = true;
      let targetReachedInsideStage = false;
      const updatedStage: WorkflowStage = {
        ...stage,
        status: "active",
        steps: stage.steps.map((step) => {
          if (step.id === stepId) {
            targetReachedInsideStage = true;
            return { ...step, status: "active" };
          }

          if (!targetReachedInsideStage) {
            return { ...step, status: keepFailedStatus(step.status, "completed") };
          }

          return { ...step, status: keepFailedStatus(step.status, "pending") };
        }),
      };

      return updatedStage;
    });

    progress.currentWorkflowStageId = stageId;
    progress.currentWorkflowStepId = stepId;
    this.runtime.currentWorkflowStageId = stageId;
    this.runtime.currentWorkflowStepId = stepId;
    this.appendRunLog({
      level: "info",
      stageId,
      stepId,
      message,
      saleExternalId,
    });
    this.syncRunProgress();
  }

  private completeWorkflowStep(
    stageId: string,
    stepId: string,
    message: string,
    saleExternalId?: string,
  ): void {
    const progress = this.currentRunProgress();
    progress.workflowStages = progress.workflowStages.map((stage): WorkflowStage => {
      if (stage.id !== stageId) {
        return stage;
      }

      return {
        ...stage,
        steps: stage.steps.map((step) =>
          step.id === stepId ? { ...step, status: "completed" } : step,
        ),
      };
    });
    this.appendRunLog({
      level: "info",
      stageId,
      stepId,
      message,
      saleExternalId,
    });
    this.syncRunProgress();
  }

  private completeStage(stageId: string, outputCount?: number, outputPath?: string): void {
    const progress = this.currentRunProgress();
    progress.workflowStages = progress.workflowStages.map((stage): WorkflowStage => {
      if (stage.id !== stageId) {
        return stage;
      }

      const hasFailure =
        stage.status === "failed" || stage.steps.some((step) => step.status === "failed");
      if (hasFailure) {
        return {
          ...stage,
          outputCount: outputCount ?? stage.outputCount,
          outputPath: outputPath ?? stage.outputPath,
        };
      }

      return {
        ...stage,
        status: "completed",
        outputCount: outputCount ?? stage.outputCount,
        outputPath: outputPath ?? stage.outputPath,
        steps: stage.steps.map((step) => ({
          ...step,
          status: keepFailedStatus(step.status, "completed"),
        })),
      };
    });
    this.syncRunProgress();
  }

  private failWorkflowStep(
    stageId: string,
    stepId: string,
    message: string,
    saleExternalId?: string,
  ): void {
    const progress = this.currentRunProgress();
    progress.workflowStages = progress.workflowStages.map((stage): WorkflowStage => {
      if (stage.id !== stageId) {
        return stage;
      }

      return {
        ...stage,
        status: "failed",
        steps: stage.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed" }
            : step.status === "active"
              ? { ...step, status: "completed" }
              : step,
        ),
      };
    });
    this.appendRunLog({
      level: "error",
      stageId,
      stepId,
      message,
      saleExternalId,
    });
    this.syncRunProgress();
  }

  private failCurrentWorkflowStep(message: string): void {
    const progress = this.currentRunProgress();
    const stageId = progress.currentWorkflowStageId ?? "detectar_ventas";
    const stepId = progress.currentWorkflowStepId ?? "abrir_falabella";
    this.failWorkflowStep(stageId, stepId, message, this.runtime.currentSaleId);
  }

  private recordWorkflowStep(step: string, saleExternalId?: string): void {
    const target = this.resolveWorkflowStepTarget(step);

    if (target) {
      this.advanceWorkflow(target.stageId, target.stepId, step, saleExternalId);
      return;
    }

    const progress = this.currentRunProgress();
    const currentStage =
      progress.workflowStages.find((stage) => stage.id === progress.currentWorkflowStageId)
      ?? progress.workflowStages[0];
    const currentStep =
      currentStage?.steps.find((entry) => entry.id === progress.currentWorkflowStepId)
      ?? currentStage?.steps[0];

    this.appendRunLog({
      level: "info",
      stageId: currentStage?.id ?? "detectar_ventas",
      stepId: currentStep?.id ?? "abrir_falabella",
      message: step,
      saleExternalId,
    });
    this.syncRunProgress();
  }

  private resolveWorkflowStepTarget(step: string): { stageId: string; stepId: string } | null {
    if (!this.runtime.currentRunId) {
      return null;
    }

    const currentStageId = this.currentRunProgress().currentWorkflowStageId;

    if (
      /Falabella Seller Center|sesi[?]n del navegador para Seller|p[?]gina de ventas del seller|sitio del seller/i.test(step)
      && (!currentStageId || currentStageId === "detectar_ventas")
    ) {
      return { stageId: "detectar_ventas", stepId: "abrir_falabella" };
    }

    if (/Documentos tributarios/i.test(step)) {
      return { stageId: "detectar_ventas", stepId: "filtrar_ventas_pendientes" };
    }

    if (/Leyendo la orden|Leyendo la venta/i.test(step)) {
      return { stageId: "detectar_ventas", stepId: "leer_detalle_ventas" };
    }

    if (/portal SUNAT|Autenticando en SUNAT|Men\u00fa SUNAT:/i.test(step)) {
      return { stageId: "registrar_facturas_sunat", stepId: "abrir_sunat" };
    }

    if (/Llenando la factura SUNAT/i.test(step)) {
      return { stageId: "registrar_facturas_sunat", stepId: "cargar_factura_en_sunat" };
    }

    if (/Esperando aprobaci?n/i.test(step)) {
      return { stageId: "registrar_facturas_sunat", stepId: "esperar_revision" };
    }

    if (/Enviando factura en SUNAT/i.test(step)) {
      return { stageId: "registrar_facturas_sunat", stepId: "enviar_factura" };
    }

    return null;
  }

  private writePendingSalesOutput(runId: string, sales: Sale[]): { path: string; content: string } {
    const exportDir = path.join(this.config.dataPaths.rootDir, "falabella-extract");
    fs.mkdirSync(exportDir, { recursive: true });
    const runPath = path.join(exportDir, `${runId}.json`);
    const latestPath = path.join(exportDir, "latest.json");
    const payload = sales.map((sale) => ({
      orderNumber: sale.externalId,
      customerName: sale.customer.name,
      dni: sale.customer.documentNumber,
      total: sale.totals.total,
      productCount:
        typeof sale.raw.productCount === "number"
          ? sale.raw.productCount
          : sale.items.reduce((sum, item) => sum + item.quantity, 0),
    }));

    const content = JSON.stringify(payload, null, 2);
    fs.writeFileSync(runPath, content, "utf8");
    fs.writeFileSync(latestPath, content, "utf8");
    return { path: runPath, content };
  }
}

function buildWorkflowTemplate(): WorkflowStage[] {
  return [
    {
      id: "detectar_ventas",
      title: "Paso 1: Obtener informacion de ventas",
      description:
        "Entrar a Falabella, detectar ventas pendientes y construir el JSON con DNI, productos, precios y montos.",
      status: "pending",
      steps: [
        {
          id: "abrir_falabella",
          title: "Abrir Falabella",
          description: "Ingresar al seller y dejar lista la sesi?n.",
          status: "pending",
        },
        {
          id: "filtrar_ventas_pendientes",
          title: "Encontrar ventas pendientes",
          description: "Ir a Documentos tributarios y detectar cuales ordenes aun no tienen comprobante cargado.",
          status: "pending",
        },
        {
          id: "leer_detalle_ventas",
          title: "Leer detalle de cada venta",
          description: "Extraer DNI, cliente, productos, precios, cantidades y montos por orden.",
          status: "pending",
        },
        {
          id: "exportar_json",
          title: "Exportar salida JSON",
          description: "Guardar el resultado del paso 1 en un archivo JSON listo para usar.",
          status: "pending",
        },
      ],
    },
    {
      id: "registrar_facturas_sunat",
      title: "Paso 2: Registro de boleta electrónica",
      description:
        "Tomar las ventas detectadas, preparar cada boleta, esperar revision y registrar en SUNAT; salida en ZIP con todas las boletas.",
      status: "pending",
      steps: [
        {
          id: "abrir_sunat",
          title: "Abrir SUNAT",
          description: "Ingresar al portal de emision o al flujo configurado.",
          status: "pending",
        },
        {
          id: "cargar_factura_en_sunat",
          title: "Cargar comprobante",
          description: "Completar los datos del cliente y los items de la venta.",
          status: "pending",
        },
        {
          id: "esperar_revision",
          title: "Esperar revision",
          description: "Pausar el flujo antes del envio final para aprobacion manual.",
          status: "pending",
        },
        {
          id: "enviar_factura",
          title: "Registrar en SUNAT",
          description: "Enviar el comprobante y guardar el resultado.",
          status: "pending",
        },
      ],
    },
  ];
}

function keepFailedStatus(
  currentStatus: WorkflowStepStatus,
  nextStatus: Exclude<WorkflowStepStatus, "failed">,
): WorkflowStepStatus {
  return currentStatus === "failed" ? "failed" : nextStatus;
}
