import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StepStatus, WorkflowHeaderStatus } from "./types";

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function statusLabel(status: StepStatus | WorkflowHeaderStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "running":
      return "Running";
    case "failed":
      return "Failed";
    case "paused":
      return "Paused";
    case "idle":
      return "Idle";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

export function statusTone(status: StepStatus | WorkflowHeaderStatus) {
  switch (status) {
    case "completed":
      return "success";
    case "running":
      return "live";
    case "paused":
      return "warning";
    case "idle":
      return "neutral";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatCompactDuration(duration: string): string {
  return duration || "-";
}
