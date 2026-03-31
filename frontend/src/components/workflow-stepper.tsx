import type { DashboardRunRecord, DashboardSnapshot } from "@shared/dashboard-contract";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
  buildWorkflowTimelineSteps,
  resolveWorkflowActiveStepId,
} from "../lib/workflow-view-model";
import { WorkflowStepper as ShadcnWorkflowStepper } from "./workflow/workflow-stepper";

type WorkflowStepperProps = {
  run: DashboardRunRecord;
  snapshot: DashboardSnapshot;
  selectedStageId?: string | null;
  onStageSelect?: (stageId: string) => void;
  title: string;
  description: string;
  variant?: "live" | "inspector";
};

export function WorkflowStepper({
  run,
  snapshot,
  selectedStageId,
  onStageSelect,
  title,
  description,
}: WorkflowStepperProps) {
  const steps = buildWorkflowTimelineSteps(run, snapshot);
  const activeStepId = resolveWorkflowActiveStepId(run, snapshot, selectedStageId);

  return (
    <Card>
      <CardHeader className="border-b border-border pb-5">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 py-2 sm:px-3">
        <ShadcnWorkflowStepper
          steps={steps}
          activeStepId={activeStepId}
          onStepSelect={onStageSelect ?? (() => undefined)}
        />
      </CardContent>
    </Card>
  );
}
