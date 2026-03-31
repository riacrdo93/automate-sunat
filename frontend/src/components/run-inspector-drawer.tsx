import { Alert, Button, Drawer, ScrollShadow, Tabs, cn } from "@heroui/react";
import type { DashboardRunRecord, DashboardSnapshot } from "@shared/dashboard-contract";
import {
  getRunStages,
  labelForRunReason,
  labelForRunStatus,
  resolveSelectedStageId,
  toneForStatus,
} from "../lib/dashboard";
import { useMediaQuery } from "../hooks/use-media-query";
import { ArtifactsDisclosure } from "./artifacts-disclosure";
import { AttemptAccordionList } from "./attempt-accordion-list";
import { LogsDisclosure } from "./logs-disclosure";
import { StageDetail } from "./stage-detail";
import { StatusChip } from "./status-chip";
import { WorkflowStepper } from "./workflow-stepper";

type RunInspectorDrawerProps = {
  snapshot: DashboardSnapshot;
  run: DashboardRunRecord | null;
  selectedStageId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSelectStage: (stageId: string) => void;
  onApprove: (attemptId: string) => void;
  onCancel: (attemptId: string) => void;
  onRetry: (attemptId: string) => void;
};

export function RunInspectorDrawer({
  snapshot,
  run,
  selectedStageId,
  onOpenChange,
  onSelectStage,
  onApprove,
  onCancel,
  onRetry,
}: RunInspectorDrawerProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isOpen = Boolean(run);
  const stages = run ? getRunStages(run) : [];
  const resolvedStageId = run ? resolveSelectedStageId(run, snapshot, selectedStageId) : null;
  const stage = stages.find((entry) => entry.id === resolvedStageId) ?? stages[0];
  const isCurrent = run?.id === snapshot.runtime.currentRunId && snapshot.runtime.isRunning;
  const hasPendingApprovals =
    run?.entries.some((entry) => snapshot.runtime.pendingApprovals.some((pending) => pending.attemptId === entry.attemptId)) ??
    false;

  return (
    <Drawer isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Backdrop className="bg-slate-950/30 backdrop-blur-[2px]">
        <Drawer.Content placement={isMobile ? "bottom" : "right"}>
          <Drawer.Dialog
            className={cn(
              "border-none bg-[#f5efe4] p-0",
              isMobile
                ? "min-h-[92svh] w-full rounded-t-[32px]"
                : "h-screen w-[min(760px,100vw)] rounded-none border-l border-slate-200/80 shadow-[0_30px_80px_rgba(15,23,42,0.18)]",
            )}
          >
            {run ? (
              <>
                {isMobile ? <Drawer.Handle className="mt-3" /> : null}
                <Drawer.Header className="border-b border-slate-200/80 px-6 pb-5 pt-6">
                  <div className="flex w-full items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                        Inspector de corrida
                      </p>
                      <div className="space-y-1">
                        <Drawer.Heading className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
                          {labelForRunReason(run.reason)}
                        </Drawer.Heading>
                        <p className="text-sm leading-6 text-slate-600">Flujo, ventas y evidencia en una sola vista.</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-2">
                      <StatusChip tone={toneForStatus(isCurrent ? "running" : run.status)}>
                        {isCurrent ? "En ejecucion" : labelForRunStatus(run.status)}
                      </StatusChip>
                      <Drawer.CloseTrigger className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Cerrar
                      </Drawer.CloseTrigger>
                    </div>
                  </div>
                </Drawer.Header>

                <Drawer.Body className="p-0">
                  <ScrollShadow className="h-full max-h-[calc(100svh-108px)] overflow-y-auto" hideScrollBar size={32}>
                    <div className="space-y-6 px-6 py-6">
                      {hasPendingApprovals ? (
                        <Alert status="warning">
                          <Alert.Content>
                            <Alert.Title>Revision pendiente</Alert.Title>
                            <Alert.Description>
                              Esta corrida tiene al menos una boleta esperando decision humana.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert>
                      ) : null}

                      <WorkflowStepper
                        run={run}
                        snapshot={snapshot}
                        selectedStageId={resolvedStageId}
                        onStageSelect={onSelectStage}
                        title="Etapas de la corrida"
                        description="Selecciona una etapa para reordenar el detalle."
                      />

                      <Tabs defaultSelectedKey="flow" className="gap-4">
                        <Tabs.ListContainer className="w-full overflow-x-auto">
                          <Tabs.List aria-label="Inspector tabs" className="flex min-w-max gap-2 rounded-full border border-slate-200/80 bg-white p-1">
                            <Tabs.Tab id="flow" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700">
                              Flujo
                            </Tabs.Tab>
                            <Tabs.Tab id="sales" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700">
                              Ventas
                            </Tabs.Tab>
                            <Tabs.Tab id="activity" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700">
                              Actividad
                            </Tabs.Tab>
                            <Tabs.Tab id="files" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700">
                              Archivos
                            </Tabs.Tab>
                          </Tabs.List>
                        </Tabs.ListContainer>

                        <Tabs.Panel id="flow" className="outline-none">
                          {stage ? <StageDetail run={run} snapshot={snapshot} stage={stage} /> : null}
                        </Tabs.Panel>

                        <Tabs.Panel id="sales" className="outline-none">
                          <AttemptAccordionList
                            run={run}
                            snapshot={snapshot}
                            onApprove={onApprove}
                            onCancel={onCancel}
                            onRetry={onRetry}
                          />
                        </Tabs.Panel>

                        <Tabs.Panel id="activity" className="outline-none">
                          <LogsDisclosure run={run} selectedStageId={resolvedStageId} />
                        </Tabs.Panel>

                        <Tabs.Panel id="files" className="outline-none">
                          <ArtifactsDisclosure run={run} />
                        </Tabs.Panel>
                      </Tabs>
                    </div>
                  </ScrollShadow>
                </Drawer.Body>

                <Drawer.Footer className="border-t border-slate-200/80 px-6 py-4">
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      className="rounded-full border border-slate-200 bg-white px-5 text-slate-700 shadow-none hover:border-slate-300"
                      onPress={() => onOpenChange(false)}
                    >
                      Volver a la lista
                    </Button>
                  </div>
                </Drawer.Footer>
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
