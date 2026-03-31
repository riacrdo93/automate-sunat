import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";
import { cx } from "./utils";
import type { StepStatus } from "./types";

export interface WorkflowProgressProps {
  steps: { status: StepStatus }[];
  className?: string;
}

export function WorkflowProgress({ steps, className }: WorkflowProgressProps) {
  const completedCount = steps.filter((step) => step.status === "completed").length;
  const runningCount = steps.filter((step) => step.status === "running").length;
  const failedCount = steps.filter((step) => step.status === "failed").length;
  const pendingCount = steps.filter((step) => step.status === "pending").length;
  const total = steps.length || 1;
  const progress = Math.round((completedCount / total) * 100 + (runningCount / total) * 50);

  return (
    <Card className={cx(className)}>
      <CardContent className="space-y-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Workflow Progress</p>
          <p className="text-sm text-slate-500">
            {runningCount > 0 ? "In Progress" : "Idle"}
          </p>
        </div>
        <div className="text-3xl font-semibold tabular-nums text-slate-950">{progress}%</div>
      </div>

      <Progress value={progress} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Completed" value={completedCount} tone="success" />
        <Metric label="Running" value={runningCount} tone="live" />
        <Metric label="Failed" value={failedCount} tone="danger" />
        <Metric label="Pending" value={pendingCount} tone="neutral" />
      </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "live" | "danger" | "neutral";
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2",
        tone === "success" && "border-emerald-200 bg-emerald-50",
        tone === "live" && "border-slate-200 bg-slate-50",
        tone === "danger" && "border-rose-200 bg-rose-50",
        tone === "neutral" && "border-slate-200 bg-white",
      )}
    >
      <div
        className={cx(
          "size-2 rounded-full",
          tone === "success" && "bg-emerald-600",
          tone === "live" && "bg-slate-900",
          tone === "danger" && "bg-rose-600",
          tone === "neutral" && "bg-slate-400",
        )}
      />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-slate-950">{value}</p>
      </div>
    </div>
  );
}
