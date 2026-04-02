import { describe, expect, it } from "vitest";
import type { DashboardRunRecord } from "@shared/dashboard-contract";
import { resolveSelectedStageId } from "./dashboard";
import {
  buildWorkflowHeader,
  buildWorkflowSteps,
  resolveWorkflowActiveStepId,
} from "./workflow-view-model";
import { createActiveRun, createSnapshot } from "../test/fixtures";

describe("buildWorkflowSteps", () => {
  it("surfaces the live substep detail and exported JSON output", () => {
    const snapshot = createSnapshot();
    const run = createActiveRun();

    const steps = buildWorkflowSteps(run, snapshot);
    expect(steps).toHaveLength(2);

    const dataStep = steps.find((step) => step.id === "detectar_ventas");
    const registrationStep = steps.find((step) => step.id === "registrar_facturas_sunat");

    const resumen = dataStep?.outputs.find((output) => output.label === "Resumen de extraccion");
    expect(resumen?.type).toBe("json");
    expect(resumen?.content).toContain("ORDER-1001");
    expect(resumen?.content).toContain('"resultado"');
    expect(dataStep?.subSteps.find((step) => step.id === "exportar_json")?.detail).toBe("Exportando JSON de ventas");
    expect(registrationStep?.status).toBe("pending");
    expect(registrationStep?.name).toBe("Registro de boleta electrónica");
  });
});

describe("failed / ended runs", () => {
  it("no marca pasos como en curso cuando la corrida ya termino con error", () => {
    const registrationStage = {
      id: "registrar_facturas_sunat",
      title: "Paso 2: Registro de boleta electrónica",
      description: "SUNAT",
      status: "active" as const,
      steps: [
        {
          id: "abrir_sunat",
          title: "Abrir SUNAT",
          description: "",
          status: "completed" as const,
        },
        {
          id: "cargar_factura_en_sunat",
          title: "Cargar comprobante",
          description: "",
          status: "active" as const,
        },
        {
          id: "esperar_revision",
          title: "Validación automática",
          description: "",
          status: "pending" as const,
        },
        {
          id: "enviar_factura",
          title: "Registrar en SUNAT",
          description: "",
          status: "pending" as const,
        },
      ],
    };

    const run: DashboardRunRecord = {
      id: "run-failed",
      reason: "manual",
      status: "failed",
      startedAt: "2026-03-30T12:00:00.000Z",
      endedAt: "2026-03-30T12:07:00.000Z",
      summary: {
        observedSales: 1,
        queuedSales: 1,
        submittedInvoices: 0,
        failedInvoices: 1,
        cancelledInvoices: 0,
      },
      entries: [],
      workflowStages: [
        {
          id: "detectar_ventas",
          title: "Paso 1",
          description: "",
          status: "completed",
          steps: [
            {
              id: "exportar_json",
              title: "Exportar",
              description: "",
              status: "completed",
            },
          ],
        },
        registrationStage,
      ],
      logs: [
        {
          at: "2026-03-30T12:06:00.000Z",
          level: "info",
          stageId: "registrar_facturas_sunat",
          stepId: "abrir_sunat",
          message: "Abriendo el portal SUNAT para 3230016047",
        },
        {
          at: "2026-03-30T12:06:52.000Z",
          level: "error",
          stageId: "registrar_facturas_sunat",
          stepId: "cargar_factura_en_sunat",
          message: "locator.waitFor: Target page, context or browser has been closed",
        },
      ],
    };

    const snapshot = createSnapshot({
      runtime: {
        isRunning: false,
        currentRunId: undefined,
        currentSaleId: undefined,
        currentStep: "En espera",
        lastCheckAt: "2026-03-30T12:07:00.000Z",
        nextCheckAt: undefined,
        currentWorkflowStageId: undefined,
        currentWorkflowStepId: undefined,
        pendingApprovals: [],
        stepTwoReady: {
          available: false,
          pendingSales: 0,
          message: "No hay ventas guardadas del paso 1 listas para ejecutar solo el paso 2.",
        },
      },
      runs: [run],
    });

    const steps = buildWorkflowSteps(run, snapshot);
    const registration = steps.find((s) => s.id === "registrar_facturas_sunat");

    expect(registration?.status).toBe("failed");
    expect(registration?.subSteps.find((s) => s.id === "cargar_factura_en_sunat")?.status).toBe("failed");
    expect(registration?.subSteps.every((s) => s.status !== "running")).toBe(true);
    expect(buildWorkflowHeader(run, snapshot).status).toBe("failed");
  });
});

describe("workflow stage focus", () => {
  it("moves focus to paso 2 when paso 1 is already completed", () => {
    const run = createActiveRun();
    run.status = "completed";
    run.endedAt = "2026-03-28T15:12:00.000Z";
    run.workflowStages[0].status = "completed";
    run.workflowStages[0].steps = run.workflowStages[0].steps.map((step) => ({
      ...step,
      status: "completed",
    }));

    const snapshot = createSnapshot({
      runtime: {
        isRunning: false,
        currentRunId: undefined,
        currentSaleId: undefined,
        currentStep: "En espera",
        currentWorkflowStageId: undefined,
        currentWorkflowStepId: undefined,
        pendingApprovals: [],
        stepTwoReady: {
          available: true,
          pendingSales: 2,
          message: "2 venta(s) guardada(s) del paso 1 listas para ejecutar solo el paso 2.",
        },
      },
      runs: [run],
    });

    expect(resolveWorkflowActiveStepId(run, snapshot)).toBe("registrar_facturas_sunat");
    expect(resolveSelectedStageId(run, snapshot)).toBe("registrar_facturas_sunat");
    expect(buildWorkflowHeader(run, snapshot).status).toBe("paused");
    const registrationStep = buildWorkflowSteps(run, snapshot).find(
      (step) => step.id === "registrar_facturas_sunat",
    );
    expect(registrationStep?.logs[0]?.message).toContain("Paso 2 listo para abrir SUNAT");
    expect(registrationStep?.outputs.some((output) => output.label === "Preparacion SUNAT")).toBe(
      true,
    );
  });

  it("shows the boletas PDF folder instead of a ZIP output", () => {
    const snapshot = createSnapshot();
    const run = createActiveRun();
    run.workflowStages[1].outputCount = 2;
    run.workflowStages[1].outputPath =
      "/tmp/boletas-descargadas/2026-04-01_09-15-00";
    run.summary.boletasDownloadDir =
      "/tmp/boletas-descargadas/2026-04-01_09-15-00";

    const registrationStep = buildWorkflowSteps(run, snapshot).find(
      (step) => step.id === "registrar_facturas_sunat",
    );
    const folderOutput = registrationStep?.outputs.find(
      (output) => output.label === "Carpeta de boletas electrónicas",
    );

    expect(folderOutput?.content).toContain("/tmp/boletas-descargadas/2026-04-01_09-15-00");
    expect(folderOutput?.content).toContain("(2 boleta(s))");
    expect(registrationStep?.outputs.some((output) => output.label === "ZIP de boletas electrónicas")).toBe(
      false,
    );
  });
});
