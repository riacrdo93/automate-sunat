import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowStepper } from "./workflow-stepper";
import { createActiveRun, createHistoricalRun, createSnapshot } from "../test/fixtures";

describe("WorkflowStepper", () => {
  it("renders the migrated workflow timeline and allows selecting a stage", () => {
    const snapshot = createSnapshot();
    const run = createActiveRun();
    const onStageSelect = vi.fn();

    render(
      <WorkflowStepper
        run={run}
        snapshot={snapshot}
        selectedStageId="registrar_facturas_sunat"
        onStageSelect={onStageSelect}
        title="Stepper vivo"
        description="Estado actual de la corrida"
        variant="live"
      />,
    );

    expect(screen.getAllByText("Obtencion de informacion de ventas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registro de boleta electrónica").length).toBeGreaterThan(0);
    expect(screen.getByText("Stepper vivo")).toBeInTheDocument();
    expect(screen.getByText("9m 0s")).toBeInTheDocument();

    const target = screen.getByRole("button", { name: /Obtencion de informacion de ventas/i });
    fireEvent.click(target);

    expect(onStageSelect).toHaveBeenCalledWith("detectar_ventas");
  });

  it("falls back to derived workflow stages for historical runs without workflow data", () => {
    const snapshot = createSnapshot({
      runtime: {
        isRunning: false,
        currentRunId: undefined,
        currentStep: "Sin actividad",
        currentWorkflowStageId: undefined,
        currentWorkflowStepId: undefined,
        pendingApprovals: [],
        stepTwoReady: {
          available: true,
          pendingSales: 1,
          message: "1 venta(s) guardada(s) del paso 1 listas para ejecutar solo el paso 2.",
        },
      },
    });
    const run = createHistoricalRun();

    render(
      <WorkflowStepper
        run={run}
        snapshot={snapshot}
        title="Historial"
        description="Flujo reconstruido"
      />,
    );

    expect(screen.getAllByText("Obtencion de informacion de ventas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registro de boleta electrónica").length).toBeGreaterThan(0);
    expect(screen.getByText("Historial")).toBeInTheDocument();
    expect(screen.getAllByText("18m 0s").length).toBeGreaterThan(0);
  });
});
