import { cn } from "../../lib/utils";
import type { WorkflowStepView } from "./types";
import { Check, Loader2, X } from "lucide-react";

interface WorkflowStepperProps {
  steps: Array<Pick<WorkflowStepView, "id" | "name" | "status" | "duration">>;
  activeStepId: string | undefined;
  onStepSelect: (stepId: string) => void;
}

function labelForStatus(status: WorkflowStepView["status"]) {
  switch (status) {
    case "completed":
      return "Completado";
    case "running":
      return "En curso";
    case "failed":
      return "Con error";
    default:
      return "Pendiente";
  }
}

export function WorkflowStepper({ steps, activeStepId, onStepSelect }: WorkflowStepperProps) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-start">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          const isCompleted = step.status === "completed";
          const isRunning = step.status === "running";
          const isFailed = step.status === "failed";
          const showConnector = index < steps.length - 1;
          const connectorIsCompleted = isCompleted;

          return (
            <div key={step.id} className="flex min-w-[9.5rem] flex-1 items-start sm:min-w-[11rem]">
              <button
                type="button"
                aria-current={isActive ? "step" : undefined}
                onClick={() => onStepSelect(step.id)}
                className={cn(
                  "group relative flex w-[9.5rem] shrink-0 flex-col items-center rounded-2xl border border-transparent px-3 py-3 text-center outline-none transition-all sm:w-[11rem] sm:px-4",
                  "focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "hover:border-border hover:bg-secondary/35",
                  isActive && "border-primary/20 bg-secondary/70 shadow-sm",
                  isFailed && !isActive && "border-destructive/15 bg-destructive/5",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity",
                    isActive && "opacity-100",
                  )}
                />
                <div
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-2xl text-[11px] font-semibold transition-all",
                    isCompleted && "border border-success/25 bg-success/15 text-success",
                    isRunning && "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
                    isFailed && "border border-destructive/20 bg-destructive/10 text-destructive",
                    !isCompleted && !isRunning && !isFailed && "border border-border bg-background text-muted-foreground",
                    isActive && !isRunning && "ring-4 ring-primary/10",
                  )}
                >
                  {isRunning ? <span className="absolute inset-0 rounded-2xl bg-primary animate-ping opacity-25" /> : null}

                  {isCompleted ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : isRunning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isFailed ? (
                    <X className="size-4" strokeWidth={2.5} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <span
                  className={cn(
                    "mt-3 text-sm font-medium leading-tight text-balance transition-colors",
                    isRunning ? "text-foreground" : isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.name}
                </span>

                <div
                  className={cn(
                    "mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]",
                    isRunning ? "text-primary" : isFailed ? "text-destructive/80" : "text-muted-foreground/70",
                  )}
                >
                  <span>{labelForStatus(step.status)}</span>
                  {step.duration ? (
                    <>
                      <span className="size-1 rounded-full bg-current/50" />
                      <span className="tabular-nums">{step.duration}</span>
                    </>
                  ) : null}
                </div>
              </button>

              {showConnector ? (
                <div
                  aria-hidden="true"
                  data-testid={`workflow-connector-${index}`}
                  className="relative mx-2 mt-5 hidden h-px min-w-8 flex-1 sm:block"
                >
                  <div className="absolute inset-0 rounded-full bg-border" />
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                      connectorIsCompleted ? "w-full bg-primary/35" : "w-0 bg-primary/35",
                    )}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
