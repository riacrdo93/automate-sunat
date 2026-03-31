import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import type { TimelineStep } from "./types";
import { cx, formatCompactDuration, statusLabel } from "./utils";

export interface WorkflowTimelineProps {
  steps: TimelineStep[];
  activeStepId?: string;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

function stepSymbol(status: TimelineStep["status"], index: number) {
  switch (status) {
    case "completed":
      return "✓";
    case "running":
      return "↻";
    case "failed":
      return "×";
    default:
      return String(index + 1);
  }
}

export function WorkflowTimeline({ steps, activeStepId, onStepClick, className }: WorkflowTimelineProps) {
  return (
    <Card className={cx("gap-0 overflow-hidden p-0", className)}>
      <CardContent className="overflow-x-auto px-4 py-4 sm:px-5">
        <div className="flex min-w-max items-center gap-3">
          {steps.map((step, index) => {
            const isActive = step.id === activeStepId;
            const next = steps[index + 1];

            return (
              <div key={step.id} className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  className={cx(
                    "flex h-auto min-w-[120px] flex-col items-center gap-2 rounded-xl px-4 py-3",
                    isActive && "bg-slate-100 text-slate-950",
                  )}
                  onClick={() => onStepClick?.(step.id)}
                >
                  <span
                    className={cx(
                      "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                      step.status === "completed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                      step.status === "running" && "border-slate-950 bg-slate-950 text-white",
                      step.status === "failed" && "border-rose-200 bg-rose-50 text-rose-700",
                      step.status === "pending" && "border-slate-200 bg-white text-slate-500",
                    )}
                  >
                    {stepSymbol(step.status, index)}
                  </span>

                  <div className="text-center">
                    <p
                      className={cx(
                        "text-sm font-medium text-slate-950",
                        step.status === "pending" && "text-slate-500",
                      )}
                    >
                      {step.name}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500">{formatCompactDuration(step.duration)}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{statusLabel(step.status)}</p>
                  </div>
                </Button>

                {index < steps.length - 1 ? (
                  <div
                    className={cx(
                      "mx-2 h-px w-10 shrink-0",
                      next?.status === "pending" ? "bg-slate-200" : "bg-emerald-300",
                    )}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
