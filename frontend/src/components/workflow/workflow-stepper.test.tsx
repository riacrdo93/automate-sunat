import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowStepper } from "./workflow-stepper";

describe("WorkflowStepper visual", () => {
  it("renders connectors only between steps", () => {
    render(
      <WorkflowStepper
        steps={[
          { id: "step-1", name: "Paso 1", status: "completed", duration: "10s" },
          { id: "step-2", name: "Paso 2", status: "running", duration: "20s" },
          { id: "step-3", name: "Paso 3", status: "pending", duration: "30s" },
        ]}
        activeStepId="step-2"
        onStepSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId("workflow-connector-0")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-connector-1")).toBeInTheDocument();
    expect(screen.queryByTestId("workflow-connector-2")).not.toBeInTheDocument();
  });
});
