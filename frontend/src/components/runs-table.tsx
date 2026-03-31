import { Button, Card, Table } from "@heroui/react";
import type { DashboardRunRecord, DashboardSnapshot } from "@shared/dashboard-contract";
import {
  buildRunSummaryText,
  formatDate,
  getIncidentCount,
  getRunSummary,
  labelForRunReason,
  labelForRunStatus,
  toneForStatus,
} from "../lib/dashboard";
import { StatusChip } from "./status-chip";

type RunsTableProps = {
  snapshot: DashboardSnapshot;
  selectedRunId?: string | null;
  onSelectRun: (runId: string) => void;
};

function renderStatus(run: DashboardRunRecord, snapshot: DashboardSnapshot) {
  const isCurrent = run.id === snapshot.runtime.currentRunId && snapshot.runtime.isRunning;
  const status = isCurrent ? "running" : run.status;
  const label = isCurrent ? "En ejecucion" : labelForRunStatus(run.status);

  return <StatusChip tone={toneForStatus(status)}>{label}</StatusChip>;
}

export function RunsTable({ snapshot, selectedRunId, onSelectRun }: RunsTableProps) {
  if (!snapshot.runs.length) {
    return (
      <Card className="rounded-[32px] border border-dashed border-slate-300 bg-white/75 shadow-none">
        <Card.Content className="space-y-3 px-6 py-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Corridas</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Todavia no hay historial</h2>
          <p className="text-sm leading-6 text-slate-600">La primera automatizacion aparecera aqui.</p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card className="rounded-[32px] border border-white/70 bg-white/82 shadow-none backdrop-blur-sm">
      <Card.Header className="flex flex-col gap-3 px-6 pb-0 pt-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Corridas</p>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <Card.Title className="text-2xl tracking-[-0.04em] text-slate-950">Historial operativo</Card.Title>
              <Card.Description className="text-sm leading-6 text-slate-600">
                Selecciona una fila para abrir el inspector lateral.
              </Card.Description>
            </div>
            <p className="text-sm leading-6 text-slate-500">{snapshot.runs.length} corrida(s)</p>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="px-0 pb-2 pt-5">
        <Table className="rounded-none border-none bg-transparent">
          <Table.ScrollContainer className="overflow-x-auto">
            <Table.Content aria-label="Historial operativo" className="min-w-[940px]">
              <Table.Header>
                <Table.Column isRowHeader>Corrida</Table.Column>
                <Table.Column>Estado</Table.Column>
                <Table.Column>Tiempo</Table.Column>
                <Table.Column>Volumen</Table.Column>
                <Table.Column className="text-right">Accion</Table.Column>
              </Table.Header>
              <Table.Body>
                {snapshot.runs.map((run) => {
                  const summary = getRunSummary(run);
                  const isSelected = selectedRunId === run.id;
                  const isCurrent = run.id === snapshot.runtime.currentRunId && snapshot.runtime.isRunning;

                  return (
                    <Table.Row
                      id={run.id}
                      key={run.id}
                      className={
                        isSelected ? "bg-slate-50/90" : isCurrent ? "bg-amber-50/60" : "bg-transparent"
                      }
                    >
                      <Table.Cell className="min-w-[260px] py-5">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold tracking-[-0.01em] text-slate-950">
                              {labelForRunReason(run.reason)}
                            </p>
                            {isCurrent ? <StatusChip tone="live">Activa</StatusChip> : null}
                          </div>
                          <p className="text-sm leading-6 text-slate-600">{buildRunSummaryText(run)}</p>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="py-5">{renderStatus(run, snapshot)}</Table.Cell>
                      <Table.Cell className="py-5">
                        <div className="space-y-1 text-sm leading-6 text-slate-600">
                          <p>Inicio {formatDate(run.startedAt)}</p>
                          <p>{run.endedAt ? `Cierre ${formatDate(run.endedAt)}` : "Sigue activa"}</p>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="py-5">
                        <div className="space-y-1 text-sm leading-6 text-slate-600">
                          <p>{summary.queuedSales || summary.observedSales || run.entries.length} venta(s) exportadas</p>
                          <p>{getIncidentCount(run)} incidencia(s)</p>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="py-5">
                        <div className="flex justify-end">
                          <Button
                            className="rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-none hover:border-slate-300"
                            onPress={() => onSelectRun(run.id)}
                          >
                            Ver detalle
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
}
