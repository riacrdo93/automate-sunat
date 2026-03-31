import { Clock3, History, Loader2, Trash2 } from "lucide-react";
import type { DashboardRunRecord, DashboardSnapshot } from "@shared/dashboard-contract";
import {
  buildRunSummaryText,
  formatDate,
  labelForRunReason,
  labelForRunStatus,
  toneForStatus,
} from "../lib/dashboard";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";

type AutomationHistorySidebarProps = {
  snapshot: DashboardSnapshot;
  focusedRunId: string;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  deletingRunId?: string | null;
};

function resolveStatusClasses(run: DashboardRunRecord, snapshot: DashboardSnapshot) {
  const isCurrent = run.id === snapshot.runtime.currentRunId && snapshot.runtime.isRunning;
  const tone = toneForStatus(isCurrent ? "running" : run.status);

  switch (tone) {
    case "live":
      return "border-primary/20 bg-primary/12 text-primary";
    case "success":
      return "border-success/20 bg-success/15 text-success";
    case "danger":
      return "border-destructive/20 bg-destructive/15 text-destructive";
    case "warning":
      return "border-warning/20 bg-warning/15 text-warning";
    default:
      return "border-border bg-muted/60 text-muted-foreground";
  }
}

function buildRunStatusLabel(run: DashboardRunRecord, snapshot: DashboardSnapshot) {
  const isCurrent = run.id === snapshot.runtime.currentRunId && snapshot.runtime.isRunning;
  return isCurrent ? "Activa ahora" : run.endedAt ? `Cerro ${formatDate(run.endedAt)}` : "Sin cierre";
}

function buildRunMeta(run: DashboardRunRecord, snapshot: DashboardSnapshot) {
  return {
    startedAt: formatDate(run.startedAt),
    statusLabel: buildRunStatusLabel(run, snapshot),
  };
}

export function AutomationHistorySidebar({
  snapshot,
  focusedRunId,
  onSelectRun,
  onDeleteRun,
  deletingRunId = null,
}: AutomationHistorySidebarProps) {
  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex min-h-[320px] flex-col overflow-hidden rounded-2xl border shadow-sm lg:sticky lg:top-24 lg:h-[calc(100svh-7.5rem)]">
      <div className="border-sidebar-border border-b px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="text-sidebar-foreground/70 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em]">
              <History className="size-3.5" />
              Historial
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">Workflows</h2>
              <p className="text-sidebar-foreground/70 text-sm">
                Navega los workflows y abre cualquier ejecución anterior.
              </p>
            </div>
          </div>

          <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground bg-sidebar-accent/70">
            {snapshot.runs.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {snapshot.runs.map((run, index) => {
            const isSelected = run.id === focusedRunId;
            const isCurrent = run.id === snapshot.runtime.currentRunId && snapshot.runtime.isRunning;
            const isDeleting = deletingRunId === run.id;
            const meta = buildRunMeta(run, snapshot);

            return (
              <div key={run.id}>
                <div
                  className={cn(
                    "group flex items-start gap-2 rounded-xl px-1 py-1",
                    isSelected && "bg-sidebar-accent/65",
                  )}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-auto flex-1 min-w-0 justify-start rounded-xl px-3 py-3.5 text-left whitespace-normal hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                      isSelected && "bg-sidebar-accent text-sidebar-foreground",
                    )}
                    onClick={() => onSelectRun(run.id)}
                  >
                    <div className="w-full space-y-3">
                      <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold tracking-tight">
                            {labelForRunReason(run.reason)}
                          </p>
                          <p className="text-sidebar-foreground/68 line-clamp-2 text-xs leading-5">
                            {buildRunSummaryText(run)}
                          </p>
                        </div>

                        <Badge
                          variant="outline"
                          className={cn("max-w-full rounded-full text-left whitespace-normal", resolveStatusClasses(run, snapshot))}
                        >
                          {labelForRunStatus(isCurrent ? "running" : run.status)}
                        </Badge>
                      </div>

                      <div className="text-sidebar-foreground/65 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Clock3 className="size-3.5" />
                          <span className="min-w-0 break-words">{meta.startedAt}</span>
                        </span>
                        <span className="min-w-0 break-words">{meta.statusLabel}</span>
                        {isCurrent ? (
                          <span className="text-primary flex min-w-0 items-center gap-1.5 font-medium">
                            <span className="bg-primary size-2 shrink-0 rounded-full animate-pulse" />
                            <span className="break-words">Seleccion actual</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-sidebar-foreground/65 hover:text-destructive mt-3 shrink-0"
                    disabled={isCurrent || isDeleting}
                    aria-label={
                      isCurrent
                        ? "No se puede eliminar un workflow activo"
                        : `Eliminar ${labelForRunReason(run.reason)}`
                    }
                    title={isCurrent ? "No se puede eliminar un workflow activo" : "Eliminar workflow"}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Se eliminará este workflow del historial. Esta acción no se puede deshacer.",
                        )
                      ) {
                        onDeleteRun(run.id);
                      }
                    }}
                  >
                    {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>

                {index < snapshot.runs.length - 1 ? <Separator className="bg-sidebar-border/80 my-1" /> : null}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
