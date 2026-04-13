import { Play, Square, GitBranch, Clock, Zap, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface WorkflowHeaderProps {
  workflowName: string;
  status: "running" | "completed" | "failed" | "paused" | "idle";
  branch: string;
  totalDuration: string;
  completedSteps: number;
  totalSteps: number;
  startLabel?: string;
  runningLabel?: string;
  /** Vacío: en Falabella no se abre el filtro de fechas (se usa el rango ya mostrado en la bandeja). */
  falabellaDocumentsSearchFrom?: string;
  onFalabellaDocumentsSearchFromChange?: (value: string) => void;
  onStartRun?: () => void;
  onStopRun?: () => void;
  isRunning?: boolean;
  isStopping?: boolean;
}

export function WorkflowHeader({
  workflowName,
  status,
  branch,
  totalDuration,
  completedSteps,
  totalSteps,
  startLabel = "Ejecutar workflow",
  runningLabel = "Workflow en curso",
  falabellaDocumentsSearchFrom = "",
  onFalabellaDocumentsSearchFromChange,
  onStartRun,
  onStopRun,
  isRunning = false,
  isStopping = false,
}: WorkflowHeaderProps) {
  const statusConfig = {
    running: {
      className: "bg-primary/15 text-primary border-primary/25",
      label: "Running",
      icon: <div className="size-1.5 rounded-full bg-primary animate-pulse" />,
    },
    completed: {
      className: "bg-success/15 text-success border-success/25",
      label: "Completed",
      icon: <div className="size-1.5 rounded-full bg-success" />,
    },
    failed: {
      className: "bg-destructive/15 text-destructive border-destructive/25",
      label: "Failed",
      icon: <div className="size-1.5 rounded-full bg-destructive" />,
    },
    paused: {
      className: "bg-warning/15 text-warning border-warning/25",
      label: "Paused",
      icon: <div className="size-1.5 rounded-full bg-warning" />,
    },
    idle: {
      className: "bg-muted text-muted-foreground border-border",
      label: "Idle",
      icon: <div className="size-1.5 rounded-full bg-muted-foreground/70" />,
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={cn(
                "shrink-0 size-10 rounded-xl flex items-center justify-center",
                status === "running" && "bg-primary/15",
                status === "completed" && "bg-success/15",
                status === "failed" && "bg-destructive/15",
                status === "paused" && "bg-warning/15",
                status === "idle" && "bg-muted",
              )}
            >
              <Zap
                className={cn(
                  "size-5",
                  status === "running" && "text-primary",
                  status === "completed" && "text-success",
                  status === "failed" && "text-destructive",
                  status === "paused" && "text-warning",
                  status === "idle" && "text-muted-foreground",
                )}
              />
            </div>

            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-3">
                <h1 className="truncate text-lg font-semibold">{workflowName}</h1>
                <Badge variant="outline" className={cn("shrink-0 gap-1.5 font-medium", currentStatus.className)}>
                  {currentStatus.icon}
                  {currentStatus.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="size-3.5" />
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">{branch}</span>
                </div>
                <div className="size-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span className="text-xs tabular-nums">{totalDuration}</span>
                </div>
                <div className="size-1 rounded-full bg-border" />
                <span className="text-xs">
                  Step <span className="font-semibold text-foreground">{completedSteps}</span> of {totalSteps}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {onFalabellaDocumentsSearchFromChange ? (
              <label className="flex max-w-full items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden whitespace-nowrap sm:inline">Buscar desde</span>
                <input
                  type="date"
                  className="h-8 min-w-0 max-w-[11rem] rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm disabled:opacity-50"
                  value={falabellaDocumentsSearchFrom}
                  onChange={(event) => onFalabellaDocumentsSearchFromChange(event.target.value)}
                  disabled={isRunning}
                  title="Falabella: vacío = no cambiar fechas. Con fecha = barrido desde ese día hasta hoy."
                />
              </label>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onStopRun}
              disabled={!isRunning || isStopping || !onStopRun}
            >
              {isStopping ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3" />}
              <span className="hidden sm:inline">Stop</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={onStartRun} disabled={isRunning}>
              {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
              <span className="hidden sm:inline">{isRunning ? runningLabel : startLabel}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
