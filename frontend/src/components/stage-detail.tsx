import { Accordion, Card } from "@heroui/react";
import type { DashboardRunRecord, DashboardSnapshot, WorkflowStage } from "@shared/dashboard-contract";
import {
  compactStageTitle,
  findLatestLog,
  formatDate,
  labelForStepStatus,
  resolveFocusedStep,
  toneForStatus,
} from "../lib/dashboard";
import { StatusChip } from "./status-chip";

type StageDetailProps = {
  run: DashboardRunRecord;
  snapshot: DashboardSnapshot;
  stage: WorkflowStage;
};

export function StageDetail({ run, snapshot, stage }: StageDetailProps) {
  const focusedStep = resolveFocusedStep(run, snapshot, stage);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Etapa seleccionada
          </p>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
            {compactStageTitle(stage.title)}
          </h3>
        </div>
        <StatusChip tone={toneForStatus(stage.status)}>{labelForStepStatus(stage.status)}</StatusChip>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
          <Card.Content className="space-y-2 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen</p>
            <p className="text-sm leading-6 text-slate-600">{stage.description}</p>
          </Card.Content>
        </Card>

        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
          <Card.Content className="space-y-1 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subpasos</p>
            <p className="text-base font-semibold text-slate-950">{stage.steps.length}</p>
            <p className="text-sm leading-6 text-slate-600">
              {focusedStep ? `En foco: ${focusedStep.title}` : "Sin subpaso activo"}
            </p>
          </Card.Content>
        </Card>

        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
          <Card.Content className="space-y-1 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Salida</p>
            <p className="break-all text-sm leading-6 text-slate-600">
              {stage.outputPath
                ? `${stage.outputPath}${stage.outputCount ? ` · ${stage.outputCount} venta(s)` : ""}`
                : "Sin artefacto de salida"}
            </p>
          </Card.Content>
        </Card>
      </div>

      <Accordion
        allowsMultipleExpanded
        defaultExpandedKeys={focusedStep ? [focusedStep.id] : []}
        hideSeparator
        className="space-y-3"
      >
        {stage.steps.map((step) => {
          const latestLog = findLatestLog(
            run,
            (entry) => entry.stageId === stage.id && entry.stepId === step.id,
          );
          const isFocused = focusedStep?.id === step.id;

          return (
            <Accordion.Item
              id={step.id}
              key={step.id}
              className="rounded-[24px] border border-slate-200/80 bg-white/76"
            >
              <Accordion.Heading className="m-0">
                <Accordion.Trigger className="w-full px-4 py-4 text-left">
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold tracking-[-0.01em] text-slate-950">{step.title}</p>
                      <p className="text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                    <StatusChip tone={toneForStatus(step.status)}>
                      {isFocused ? "Ahora" : labelForStepStatus(step.status)}
                    </StatusChip>
                  </div>
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="space-y-3 px-4 pb-4">
                  {latestLog ? (
                    <Card className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 shadow-none">
                      <Card.Content className="space-y-2 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Ultimo evento
                        </p>
                        <p className="text-sm leading-6 text-slate-700">{latestLog.message}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          {formatDate(latestLog.at)}
                          {latestLog.saleExternalId ? ` · ${latestLog.saleExternalId}` : ""}
                        </p>
                      </Card.Content>
                    </Card>
                  ) : (
                    <p className="text-sm leading-6 text-slate-500">Este subpaso todavia no tiene logs.</p>
                  )}
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </section>
  );
}
