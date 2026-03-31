import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDashboardSelection } from "./use-dashboard-selection";
import { createSnapshot } from "../test/fixtures";

function SelectionHarness() {
  const selection = useDashboardSelection(createSnapshot());

  return (
    <div>
      <span data-testid="run-id">{selection.selectedRunId}</span>
      <span data-testid="stage-id">{selection.selectedStageId}</span>
    </div>
  );
}

describe("useDashboardSelection", () => {
  it("honors query params for the selected run and stage", () => {
    window.history.replaceState({}, "", "/?run=run-live&stage=registrar_facturas_sunat");

    render(<SelectionHarness />);

    expect(screen.getByTestId("run-id")).toHaveTextContent("run-live");
    expect(screen.getByTestId("stage-id")).toHaveTextContent("registrar_facturas_sunat");
  });
});
