export type StepStatus = "completed" | "running" | "pending" | "failed";

export type WorkflowHeaderStatus = "running" | "completed" | "failed" | "paused" | "idle";

export interface SubStep {
  id: string;
  name: string;
  status: StepStatus;
  duration?: string;
  detail?: string;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export interface StepOutput {
  type: "text" | "json" | "code";
  content: string;
  label?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: StepStatus;
  startTime: string;
  endTime?: string;
  duration: string;
  subSteps: SubStep[];
  logs: LogEntry[];
  outputs: StepOutput[];
}

export interface TimelineStep {
  id: string;
  name: string;
  status: StepStatus;
  duration: string;
}

export interface WorkflowStepAction {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
}

export type WorkflowStatusView = StepStatus;
export type WorkflowLogView = LogEntry;
export type WorkflowOutputView = StepOutput;
export type WorkflowStepView = WorkflowStep;
export type WorkflowSubStepView = SubStep;
export type WorkflowTimelineStepView = TimelineStep;
