import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardWorkspace } from "./app";
import { createSnapshot } from "./test/fixtures";

function WorkspaceHarness({ isRunning = true }: { isRunning?: boolean }) {
  const snapshot = createSnapshot({
    runtime: {
      isRunning,
      currentRunId: isRunning ? "run-live" : undefined,
      currentStep: isRunning ? "Exportando JSON de ventas" : "Sin actividad",
      currentWorkflowStageId: isRunning ? "detectar_ventas" : undefined,
      currentWorkflowStepId: isRunning ? "exportar_json" : undefined,
      pendingApprovals: [],
      stepTwoReady: {
        available: true,
        pendingSales: 1,
        message: "1 venta(s) guardada(s) del paso 1 listas para ejecutar solo el paso 2.",
      },
    },
  });

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  return (
    <DashboardWorkspace
      snapshot={snapshot}
      streamState="connected"
      error={null}
      flashMessage={null}
      selectedRunId={selectedRunId}
      selectedStageId={selectedStageId}
      onStartRun={vi.fn()}
      onStopRun={vi.fn()}
      onStartStepTwo={vi.fn()}
      onSelectRun={setSelectedRunId}
      onDeleteRun={vi.fn()}
      onCloseRun={() => setSelectedRunId(null)}
      onSelectStage={setSelectedStageId}
      onApprove={vi.fn()}
      onCancel={vi.fn()}
      onRetry={vi.fn()}
      pendingAction={null}
      deletingRunId={null}
    />
  );
}

describe("DashboardWorkspace", () => {
  it("shows the copied workflow page while a run is active", () => {
    render(<WorkspaceHarness />);

    const historySidebar = screen.getByText("Workflows").closest("aside");

    expect(screen.getByRole("button", { name: "Workflow en curso" })).toBeInTheDocument();
    expect(screen.getByText("Workflows")).toBeInTheDocument();
    expect(screen.getByText("Navega los workflows y abre cualquier ejecución anterior.")).toBeInTheDocument();
    expect(historySidebar).not.toBeNull();
    expect(within(historySidebar as HTMLElement).queryByText("En curso")).not.toBeInTheDocument();
    expect(screen.getByText("Seller a SUNAT")).toBeInTheDocument();
    expect(screen.getAllByText(/Lanzamiento manual/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Obtencion de informacion de ventas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registro de boleta electrónica").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exportar salida JSON").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exportando JSON de ventas").length).toBeGreaterThan(0);
    expect(screen.getByText("Actividad en vivo")).toBeInTheDocument();
    expect(screen.getByText("Ultimos eventos")).toBeInTheDocument();
    expect(screen.getByText(/Se exporto el JSON del paso 1/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Logs/i })).toBeInTheDocument();
  });

  it("shows the launch action and latest run when there is no active run", () => {
    render(<WorkspaceHarness isRunning={false} />);

    expect(screen.getByRole("button", { name: "Lanzar workflow" })).toBeInTheDocument();
    expect(screen.getByText("Seller a SUNAT")).toBeInTheDocument();
    expect(screen.getAllByText("Obtencion de informacion de ventas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Registro de boleta electrónica").length).toBeGreaterThan(0);
  });

  it("shows the step 2 action when the SUNAT stage is selected", () => {
    render(<WorkspaceHarness isRunning={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Registro de boleta electrónica/i }));

    expect(screen.getByRole("button", { name: "Ejecutar solo paso 2" })).toBeInTheDocument();
    expect(screen.getByText(/venta\(s\) guardada\(s\) del paso 1/i)).toBeInTheDocument();
  });

  it("lets you switch the focused run from the automation history sidebar", () => {
    render(<WorkspaceHarness />);

    fireEvent.click(screen.getAllByRole("button", { name: /Reintento/i })[0]!);

    expect(within(screen.getByRole("banner")).getByText("Paused")).toBeInTheDocument();
  });

  it("shows the connection error even when there is no snapshot yet", () => {
    render(
      <DashboardWorkspace
        snapshot={null}
        streamState="error"
        error="No se pudo cargar el dashboard."
        flashMessage={null}
        selectedRunId={null}
        selectedStageId={null}
        onStartRun={vi.fn()}
        onStopRun={vi.fn()}
        onStartStepTwo={vi.fn()}
        onSelectRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onCloseRun={vi.fn()}
        onSelectStage={vi.fn()}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        pendingAction={null}
        deletingRunId={null}
      />,
    );

    expect(screen.getByText("No se pudo cargar el dashboard.")).toBeInTheDocument();
    expect(screen.getByText("No se pudo conectar con el panel")).toBeInTheDocument();
  });

  it("shows the full dashboard shell when there are no workflows yet", () => {
    render(
      <DashboardWorkspace
        snapshot={
          createSnapshot({
            runs: [],
            runtime: {
              isRunning: false,
              currentRunId: undefined,
              currentStep: "Sin actividad",
              currentWorkflowStageId: undefined,
              currentWorkflowStepId: undefined,
              pendingApprovals: [],
              stepTwoReady: {
                available: false,
                pendingSales: 0,
                message: "No hay ventas guardadas del paso 1 listas para ejecutar solo el paso 2.",
              },
            },
          })
        }
        streamState="connected"
        error={null}
        flashMessage={null}
        selectedRunId={null}
        selectedStageId={null}
        onStartRun={vi.fn()}
        onStopRun={vi.fn()}
        onStartStepTwo={vi.fn()}
        onSelectRun={vi.fn()}
        onDeleteRun={vi.fn()}
        onCloseRun={vi.fn()}
        onSelectStage={vi.fn()}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        pendingAction={null}
        deletingRunId={null}
      />,
    );

    expect(screen.getByText("Seller a SUNAT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lanzar workflow" })).toBeInTheDocument();
    expect(screen.getByText("No hay workflows todavía")).toBeInTheDocument();
    expect(screen.getByText("Workflows")).toBeInTheDocument();
  });

  it("calls delete when confirming a run removal", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDeleteRun = vi.fn();

    render(
      <DashboardWorkspace
        snapshot={
          createSnapshot({
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
          })
        }
        streamState="connected"
        error={null}
        flashMessage={null}
        selectedRunId={null}
        selectedStageId={null}
        onStartRun={vi.fn()}
        onStopRun={vi.fn()}
        onStartStepTwo={vi.fn()}
        onSelectRun={vi.fn()}
        onDeleteRun={onDeleteRun}
        onCloseRun={vi.fn()}
        onSelectStage={vi.fn()}
        onApprove={vi.fn()}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        pendingAction={null}
        deletingRunId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Eliminar Lanzamiento manual/i }));

    expect(onDeleteRun).toHaveBeenCalledWith("run-live");
    confirmSpy.mockRestore();
  });
});
