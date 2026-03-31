import { Alert, Button, Card, Surface } from "@heroui/react";
import type { DashboardRunRecord, DashboardSnapshot } from "@shared/dashboard-contract";
import {
  compactStageTitle,
  findLivePendingApproval,
  findLatestLog,
  formatDate,
  getRunStages,
  getRunSummary,
  labelForRunReason,
  resolveFocusedStep,
  resolveSelectedStageId,
  resolveUpcomingAction,
} from "../lib/dashboard";
import { StatusChip } from "./status-chip";
import { WorkflowStepper } from "./workflow-stepper";

type LiveFocusProps = {
  snapshot: DashboardSnapshot;
  run: DashboardRunRecord;
  onOpenInspector: (runId: string, stageId?: string | null) => void;
  onApprove: (attemptId: string) => void;
  onCancel: (attemptId: string) => void;
};

export function LiveFocus({ snapshot, run, onOpenInspector, onApprove, onCancel }: LiveFocusProps) {
  const stages = getRunStages(run);
  const selectedStageId = resolveSelectedStageId(run, snapshot, snapshot.runtime.currentWorkflowStageId);
  const stage = stages.find((entry) => entry.id === selectedStageId) ?? stages[0];
  const focusedStep = stage ? resolveFocusedStep(run, snapshot, stage) : null;
  const pendingApproval = findLivePendingApproval(snapshot);
  const pendingEntry = pendingApproval
    ? run.entries.find((entry) => entry.attemptId === pendingApproval.attemptId)
    : run.entries.find((entry) => entry.saleExternalId === snapshot.runtime.currentSaleId) ?? run.entries[0];
  const latestLog =
    findLatestLog(run, (entry) => {
      if (!stage) {
        return true;
      }

      return entry.stageId === stage.id;
    }) ?? findLatestLog(run, () => true);
  const summary = getRunSummary(run);
  const upcomingAction = resolveUpcomingAction(run, snapshot, stage);

  return (
    <Surface className="overflow-hidden rounded-[36px] border border-white/70 bg-white/82 shadow-none backdrop-blur-sm">
      <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone="live">Corrida activa</StatusChip>
                <StatusChip tone="neutral">{labelForRunReason(run.reason)}</StatusChip>
                {stage ? <StatusChip tone="warning">{compactStageTitle(stage.title)}</StatusChip> : null}
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2rem]">
                  {focusedStep?.title ?? "Flujo en ejecucion"}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  {latestLog?.message ?? snapshot.runtime.currentStep ?? "La corrida sigue avanzando."}
                </p>
              </div>
            </div>

            <Button
              className="rounded-full border border-slate-200 bg-white px-5 text-slate-700 shadow-none hover:border-slate-300"
              onPress={() => onOpenInspector(run.id, selectedStageId)}
            >
              Abrir inspector
            </Button>
          </div>

          <WorkflowStepper
            run={run}
            snapshot={snapshot}
            selectedStageId={selectedStageId}
            onStageSelect={(stageId) => onOpenInspector(run.id, stageId)}
            title="Flujo de la corrida activa"
            description="Cada etapa se puede abrir sin salir del workspace."
            variant="live"
          />

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="rounded-[26px] border border-slate-200/80 bg-slate-50/75 shadow-none">
              <Card.Content className="space-y-1 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Venta en foco
                </p>
                <p className="text-sm font-semibold text-slate-950">
                  {snapshot.runtime.currentSaleId || pendingEntry?.saleExternalId || "Sin venta"}
                </p>
                <p className="text-sm leading-6 text-slate-600">
                  {pendingEntry
                    ? `${pendingEntry.customerName} · DNI ${pendingEntry.customerDocument}`
                    : "Esperando la siguiente orden."}
                </p>
              </Card.Content>
            </Card>

            <Card className="rounded-[26px] border border-slate-200/80 bg-slate-50/75 shadow-none">
              <Card.Content className="space-y-1 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Siguiente
                </p>
                <p className="text-sm font-semibold text-slate-950">{upcomingAction}</p>
                <p className="text-sm leading-6 text-slate-600">
                  {pendingApproval ? "El flujo espera tu decision." : "Sin bloqueo humano por ahora."}
                </p>
              </Card.Content>
            </Card>

            <Card className="rounded-[26px] border border-slate-200/80 bg-slate-50/75 shadow-none">
              <Card.Content className="space-y-1 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pulso</p>
                <p className="text-sm font-semibold text-slate-950">{formatDate(snapshot.runtime.lastCheckAt)}</p>
                <p className="text-sm leading-6 text-slate-600">
                  {(summary.queuedSales || summary.observedSales)} exportada(s) · {summary.failedInvoices + summary.cancelledInvoices} incidencia(s)
                </p>
              </Card.Content>
            </Card>
          </div>
        </div>

        <Card className="rounded-[32px] border border-slate-900/10 bg-slate-950 text-white shadow-none">
          <Card.Header className="px-5 pb-0 pt-5">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
                Decision
              </p>
              <Card.Title className="text-xl tracking-[-0.03em] text-white">
                {pendingApproval ? "Revision requerida" : "Ruta despejada"}
              </Card.Title>
            </div>
          </Card.Header>

          <Card.Content className="space-y-4 px-5 py-5">
            {pendingApproval ? (
              <>
                <Alert status="warning">
                  <Alert.Content>
                    <Alert.Title>{pendingApproval.saleExternalId}</Alert.Title>
                    <Alert.Description>La boleta quedo lista para validacion final.</Alert.Description>
                  </Alert.Content>
                </Alert>

                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-sm font-semibold text-white">
                    {pendingEntry?.customerName ?? "Cliente sin nombre"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/68">
                    DNI {pendingEntry?.customerDocument ?? "Sin dato"} · Orden {pendingApproval.saleExternalId}
                  </p>
                </div>

                <div className="grid gap-3">
                  <Button
                    className="w-full rounded-full bg-white px-5 text-slate-950 shadow-none hover:bg-white/92"
                    onPress={() => onApprove(pendingApproval.attemptId)}
                  >
                    Continuar
                  </Button>
                  <Button
                    className="w-full rounded-full border border-rose-200/40 bg-transparent px-5 text-rose-100 shadow-none hover:bg-rose-400/10"
                    onPress={() => onCancel(pendingApproval.attemptId)}
                  >
                    Detener
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Ultimo evento</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {focusedStep?.title ?? "Sin paso activo"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    {latestLog?.message ?? "La corrida sigue esperando la siguiente senal del flujo."}
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">En foco</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {pendingEntry?.saleExternalId ?? snapshot.runtime.currentSaleId ?? "Sin venta activa"}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      Siguiente paso
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{upcomingAction}</p>
                  </div>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
      </div>
    </Surface>
  );
}
