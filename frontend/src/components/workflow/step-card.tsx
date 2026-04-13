import { HighlightedJson } from "../json-highlight";
import { Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "./primitives";
import type { StepOutput, StepStatus, SubStep, WorkflowStepView } from "./types";
import { cx, statusLabel, statusTone } from "./utils";
import { ExpandableLogMessage } from "../expandable-log-message";

export interface StepCardProps {
  step: WorkflowStepView;
  stepNumber: number;
  className?: string;
}

function statusGlyph(status: StepStatus) {
  switch (status) {
    case "completed":
      return "✓";
    case "running":
      return "↻";
    case "failed":
      return "×";
    default:
      return "○";
  }
}

function StatusBadge({ status }: { status: StepStatus }) {
  const tone = statusTone(status);
  return (
    <Badge
      variant="outline"
      className={cx(
        "font-mono text-[10px] uppercase tracking-[0.18em]",
        tone === "live" && "border-slate-950 bg-slate-950 text-white",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "neutral" && "border-slate-200 bg-white text-slate-600",
      )}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function SubStepsList({ subSteps }: { subSteps: SubStep[] }) {
  return (
    <div className="space-y-1">
      {subSteps.map((subStep, index) => (
        <div
          key={subStep.id}
          className={cx(
            "flex items-center justify-between rounded-md px-3 py-2 transition-colors",
            subStep.status === "running" && "bg-slate-50",
            subStep.status === "completed" && "bg-emerald-50/50",
            subStep.status === "failed" && "bg-rose-50/50",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-slate-400">{String(index + 1).padStart(2, "0")}</span>
            <span
              className={cx(
                "inline-flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                subStep.status === "completed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                subStep.status === "running" && "border-slate-950 bg-slate-950 text-white",
                subStep.status === "failed" && "border-rose-200 bg-rose-50 text-rose-700",
                subStep.status === "pending" && "border-slate-200 bg-white text-slate-500",
              )}
            >
              {statusGlyph(subStep.status)}
            </span>
            <div className="min-w-0">
              <span className={cx("text-sm", subStep.status === "pending" && "text-slate-500")}>
                {subStep.name}
              </span>
              {subStep.detail ? (
                <p
                  className={cx(
                    "mt-0.5 line-clamp-2 text-xs leading-snug",
                    subStep.status === "failed" ? "text-rose-700" : "text-slate-500",
                  )}
                >
                  {subStep.detail}
                </p>
              ) : null}
            </div>
          </div>
          {subStep.duration ? <span className="font-mono text-xs text-slate-500">{subStep.duration}</span> : null}
        </div>
      ))}
    </div>
  );
}

function LogsList({ logs }: { logs: WorkflowStepView["logs"] }) {
  if (!logs.length) {
    return <EmptyMessage label="No logs available" />;
  }

  const levelStyles: Record<WorkflowStepView["logs"][number]["level"], string> = {
    info: "text-slate-700",
    warn: "text-amber-700",
    error: "text-rose-700",
    debug: "text-sky-600/90 dark:text-sky-400/80",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-[12px] font-mono text-white">
      <div className="max-h-72 overflow-y-auto">
        {logs.map((log, index) => (
          <div
            key={`${log.timestamp}-${index}`}
            className={cx("flex items-start gap-3 border-b border-white/5 px-3 py-2 last:border-b-0", index % 2 === 1 && "bg-white/[0.02]")}
          >
            <span className="shrink-0 text-white/45">{log.timestamp}</span>
            <span className={cx("shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]", levelStyles[log.level], "bg-white/5")}>
              {log.level === "debug" ? "dbg" : log.level}
            </span>
            <ExpandableLogMessage
              text={log.message}
              preWrap={log.level === "debug"}
              expandTone="invert"
              className={cx(
                "break-words font-mono text-white/80",
                log.level === "debug" && "text-sky-200/90",
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputsList({ outputs }: { outputs: StepOutput[] }) {
  if (!outputs.length) {
    return <EmptyMessage label="No output available" />;
  }

  return (
    <div className="space-y-4">
      {outputs.map((output, index) => (
        <div key={`${output.type}-${index}`} className="space-y-2">
          {output.label ? <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{output.label}</p> : null}
          <pre
            className={cx(
              "overflow-x-auto rounded-xl border p-4 font-mono text-sm leading-relaxed",
              output.type === "code" && "border-slate-200 bg-slate-950 text-white",
              output.type === "json" && "border-slate-200 bg-slate-50 text-slate-900",
              output.type === "text" && "border-slate-200 bg-white text-slate-700",
            )}
          >
            {output.type === "json" ? (
              <HighlightedJson source={output.content} theme="light" />
            ) : (
              output.content
            )}
          </pre>
        </div>
      ))}
    </div>
  );
}

function EmptyMessage({ label }: { label: string }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function StepCard({ step, stepNumber, className }: StepCardProps) {
  const progress = step.subSteps.length
    ? Math.round((step.subSteps.filter((subStep) => subStep.status === "completed").length / step.subSteps.length) * 100)
    : 0;

  return (
    <Card className={cx("overflow-hidden", className)}>
      <CardHeader className={cx("border-b border-slate-200 pb-6", step.status === "running" && "bg-slate-50")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={cx(
                "flex size-10 items-center justify-center rounded-xl border text-sm font-semibold",
                step.status === "completed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                step.status === "running" && "border-slate-950 bg-slate-950 text-white",
                step.status === "failed" && "border-rose-200 bg-rose-50 text-rose-700",
                step.status === "pending" && "border-slate-200 bg-white text-slate-500",
              )}
            >
              {stepNumber}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{step.name}</CardTitle>
                <StatusBadge status={step.status} />
              </div>
              <p className="text-sm leading-6 text-slate-600">{step.description}</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-xs text-slate-500">{step.duration}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-950" style={{ width: `${progress}%` }} />
              </div>
              <span className="font-mono text-[10px] text-slate-500">{progress}%</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-4">
        <Tabs defaultValue="substeps">
          <TabsList className="w-fit">
            <TabsTrigger value="substeps">Sub-steps ({step.subSteps.length})</TabsTrigger>
            <TabsTrigger value="logs">Logs ({step.logs.length})</TabsTrigger>
            <TabsTrigger value="output">Output ({step.outputs.length})</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="substeps">
              <SubStepsList subSteps={step.subSteps} />
            </TabsContent>
            <TabsContent value="logs">
              <LogsList logs={step.logs} />
            </TabsContent>
            <TabsContent value="output">
              <OutputsList outputs={step.outputs} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
