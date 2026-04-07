import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  XCircle,
  Terminal,
  FileOutput,
  Layers,
  Loader2,
  Clock,
  Play,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { HighlightedJson } from "../json-highlight";
import { cn } from "../../lib/utils";
import { useStickToBottomScroll } from "../../hooks/use-stick-to-bottom-scroll";
import type {
  WorkflowStepView,
  WorkflowStatusView,
  WorkflowLogView,
  WorkflowSubStepView,
  WorkflowOutputView,
  WorkflowStepAction,
} from "./types";

interface StepDetailsProps {
  step: WorkflowStepView;
  stepNumber: number;
  action?: WorkflowStepAction;
  onAction?: () => void;
}

function StatusIcon({ status, size = "md" }: { status: WorkflowStatusView; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "size-3" : "size-4";
  switch (status) {
    case "completed":
      return <CheckCircle2 className={cn(sizeClass, "text-muted-foreground")} />;
    case "running":
      return <Loader2 className={cn(sizeClass, "text-primary animate-spin")} />;
    case "failed":
      return <XCircle className={cn(sizeClass, "text-destructive")} />;
    default:
      return <Circle className={cn(sizeClass, "text-muted-foreground/30")} />;
  }
}

function StatusBadge({ status }: { status: WorkflowStatusView }) {
  const variants: Record<WorkflowStatusView, { className: string; label: string }> = {
    completed: { className: "bg-muted text-muted-foreground border-border", label: "Completed" },
    running: { className: "bg-primary/15 text-primary border-primary/30", label: "Running" },
    failed: { className: "bg-destructive/10 text-destructive border-destructive/20", label: "Failed" },
    pending: { className: "bg-muted text-muted-foreground border-border", label: "Pending" },
  };

  const variant = variants[status];

  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", variant.className)}>
      {variant.label}
    </Badge>
  );
}

function SubStepsList({ subSteps }: { subSteps: WorkflowSubStepView[] }) {
  return (
    <div className="space-y-0.5">
      {subSteps.map((subStep, index) => (
        <div
          key={subStep.id}
          className={cn(
            "flex items-center justify-between rounded py-1.5 px-2 text-sm transition-all",
            subStep.status === "running" && "bg-primary/5",
          )}
        >
          <div className="min-w-0 flex items-start gap-2">
            <span className="mt-0.5 w-4 text-[10px] tabular-nums text-muted-foreground/50">
              {String(index + 1).padStart(2, "0")}
            </span>
            <StatusIcon status={subStep.status} size="sm" />
            <div className="min-w-0">
              <div className={cn("text-xs", subStep.status === "pending" && "text-muted-foreground")}>
                {subStep.name}
              </div>
              {subStep.detail ? (
                <div
                  className={cn(
                    "mt-0.5 line-clamp-2 text-[10px] leading-snug",
                    subStep.status === "failed" ? "text-destructive/90" : "text-muted-foreground/70",
                  )}
                >
                  {subStep.detail}
                </div>
              ) : null}
            </div>
          </div>
          {subStep.duration && <span className="text-[10px] tabular-nums text-muted-foreground/60">{subStep.duration}</span>}
        </div>
      ))}
    </div>
  );
}

function LogConsole({
  logs,
  maxHeightClass = "max-h-48",
  emptyMessage = "No hay logs todavia",
}: {
  logs: WorkflowLogView[];
  maxHeightClass?: string;
  emptyMessage?: string;
}) {
  const { ref: scrollRef, onScroll } = useStickToBottomScroll<HTMLDivElement>([logs]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground">
        <Terminal className="size-4 text-muted-foreground/40" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  const levelStyles: Record<WorkflowLogView["level"], string> = {
    info: "text-foreground/60",
    warn: "text-warning",
    error: "text-destructive",
    debug: "text-muted-foreground/50",
  };

  return (
    <div className="overflow-hidden rounded-md border border-border/30 bg-[#0a0a0a] font-mono text-[11px] leading-snug">
      <div ref={scrollRef} onScroll={onScroll} className={cn("overflow-y-auto overflow-x-hidden", maxHeightClass)}>
        {logs.map((log, index) => (
          <div key={index} className="flex items-start gap-2 border-b border-border/5 px-2 py-1 last:border-b-0">
            <span className="shrink-0 text-muted-foreground/30">{log.timestamp}</span>
            <span className={cn("w-8 shrink-0 font-mono font-medium uppercase", levelStyles[log.level] || levelStyles.info)}>
              {log.level}
            </span>
            <span className="break-all font-mono text-foreground/60">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveActivityPanel({ step }: { step: WorkflowStepView }) {
  const liveSubStep = step.subSteps.find((subStep) => subStep.status === "running");
  const latestLog = step.logs[step.logs.length - 1];
  const currentMessage =
    liveSubStep?.detail ?? latestLog?.message ?? "Esperando el siguiente evento de esta etapa.";
  const currentLabel = liveSubStep ? "Accion actual" : latestLog ? "Ultimo evento" : "Estado";
  const shouldRender = step.status === "running" || step.logs.length > 0 || Boolean(liveSubStep?.detail);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="mb-3 rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Actividad en vivo</p>
          <p className="text-[11px] text-muted-foreground">
            {step.status === "running"
              ? "El panel se actualiza solo mientras avanza la automatizacion."
              : "Resumen rapido de los ultimos movimientos registrados en esta etapa."}
          </p>
        </div>
        <StatusBadge status={step.status} />
      </div>

      <div className="mt-3 space-y-3">
        <div className="rounded-md border border-border/60 bg-background/80 px-3 py-2">
          <div className="flex items-start gap-2">
            {step.status === "running" ? (
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {currentLabel}
              </p>
              <p className="text-sm leading-5 text-foreground">{currentMessage}</p>
              {liveSubStep?.name ? (
                <p className="text-[11px] leading-5 text-muted-foreground">{liveSubStep.name}</p>
              ) : null}
              <p className="mt-2 text-[10px] text-muted-foreground">
                El listado completo está en el tab <span className="font-medium text-foreground/80">Logs</span> ({step.logs.length})
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogsList({ logs }: { logs: WorkflowLogView[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Registro de eventos
        </p>
        <span className="text-[10px] text-muted-foreground">{logs.length} total</span>
      </div>
      <LogConsole
        logs={logs}
        maxHeightClass="max-h-[min(70vh,640px)] min-h-[240px]"
        emptyMessage="Esperando los primeros eventos de esta etapa"
      />
    </div>
  );
}

function OutputsList({ outputs }: { outputs: WorkflowOutputView[] }) {
  if (outputs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground">
        <FileOutput className="size-4 text-muted-foreground/40" />
        <span>No hay output todavia</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {outputs.map((output, index) => (
        <div key={index} className="space-y-1">
          {output.label && (
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{output.label}</span>
          )}
          <div className="overflow-x-auto rounded-md border border-border/30 bg-[#0a0a0a] p-2 font-mono text-[10px] leading-relaxed">
            {output.type === "json" ? (
              <HighlightedJson source={output.content} theme="dark" />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-foreground/60">{output.content}</pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StepDetails({ step, stepNumber, action, onAction }: StepDetailsProps) {
  const [activeTab, setActiveTab] = useState("logs");

  const completedSubSteps = step.subSteps.filter((s) => s.status === "completed").length;
  const totalSubSteps = step.subSteps.length;
  const progress = totalSubSteps > 0 ? (completedSubSteps / totalSubSteps) * 100 : 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        step.status === "running" && "border-primary/40",
        step.status !== "running" && "border-border",
      )}
    >
      <div className="border-b border-border/50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded text-xs font-semibold",
                step.status === "running" && "bg-primary/15 text-primary",
                step.status !== "running" && "bg-muted text-muted-foreground",
              )}
            >
              {stepNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">{step.name}</h2>
                <StatusBadge status={step.status} />
              </div>
              <p className="text-[10px] text-muted-foreground">{step.description}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {step.status !== "pending" && (
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-12 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-muted-foreground/40 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {completedSubSteps}/{totalSubSteps}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
              <Clock className="size-3" />
              {step.duration}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3">
        {action ? (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Accion disponible para esta etapa</p>
                {action.hint ? <p className="text-[11px] text-muted-foreground">{action.hint}</p> : null}
              </div>
              <Button size="sm" className="gap-2" onClick={onAction} disabled={action.disabled || action.loading}>
                {action.loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                <span>{action.label}</span>
              </Button>
            </div>
          </div>
        ) : null}

        <LiveActivityPanel step={step} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto w-full justify-start gap-0.5 rounded-md bg-muted/50 p-0.5">
            <TabsTrigger
              value="substeps"
              className="gap-1 rounded px-2 py-1 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Layers className="size-3" />
              <span>Sub-steps</span>
              <span className="ml-0.5 text-muted-foreground">{totalSubSteps}</span>
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="gap-1 rounded px-2 py-1 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Terminal className="size-3" />
              <span>Logs</span>
              <span className="ml-0.5 text-muted-foreground">{step.logs.length}</span>
            </TabsTrigger>
            <TabsTrigger
              value="output"
              className="gap-1 rounded px-2 py-1 text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <FileOutput className="size-3" />
              <span>Output</span>
              <span className="ml-0.5 text-muted-foreground">{step.outputs.length}</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-2">
            <TabsContent value="substeps" className="m-0">
              <SubStepsList subSteps={step.subSteps} />
            </TabsContent>
            <TabsContent value="logs" className="m-0">
              <LogsList logs={step.logs} />
            </TabsContent>
            <TabsContent value="output" className="m-0">
              <OutputsList outputs={step.outputs} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
