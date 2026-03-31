import { Accordion, Button, Card, Tooltip } from "@heroui/react";
import type { DashboardRunRecord, DashboardSnapshot } from "@shared/dashboard-contract";
import {
  buildEntrySummary,
  findPendingApproval,
  formatDate,
  labelForAttemptStatus,
  moneyFormatter,
  toneForStatus,
} from "../lib/dashboard";
import { StatusChip } from "./status-chip";

type AttemptAccordionListProps = {
  run: DashboardRunRecord;
  snapshot: DashboardSnapshot;
  onApprove: (attemptId: string) => void;
  onCancel: (attemptId: string) => void;
  onRetry: (attemptId: string) => void;
};

export function AttemptAccordionList({
  run,
  snapshot,
  onApprove,
  onCancel,
  onRetry,
}: AttemptAccordionListProps) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ventas</p>
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
          {run.entries.length ? `${run.entries.length} venta(s)` : "Sin ventas asociadas"}
        </h3>
      </div>

      {run.entries.length ? (
        <Accordion allowsMultipleExpanded hideSeparator className="space-y-3">
          {run.entries.map((entry) => {
            const pending = findPendingApproval(snapshot, entry.attemptId);
            const isLivePending = pending?.live === true;
            const note = isLivePending
              ? "Esperando tu aprobacion final."
              : !pending && entry.status === "ready_for_review"
                ? "Quedo pendiente de una revision anterior."
                : entry.error;

            return (
              <Accordion.Item
                id={entry.attemptId}
                key={entry.attemptId}
                className="rounded-[24px] border border-slate-200/80 bg-white/76"
              >
                <Accordion.Heading className="m-0">
                  <Accordion.Trigger className="w-full px-4 py-4 text-left">
                    <div className="flex w-full items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold tracking-[-0.01em] text-slate-950">
                            Orden {entry.saleExternalId}
                          </p>
                          <p className="text-sm leading-6 text-slate-600">
                            {entry.customerName} · {entry.customerDocument}
                          </p>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{buildEntrySummary(entry)}</p>
                      </div>
                      <StatusChip tone={toneForStatus(isLivePending ? "ready_for_review" : entry.status)}>
                        {isLivePending ? "Esperando revision" : labelForAttemptStatus(entry.status)}
                      </StatusChip>
                    </div>
                  </Accordion.Trigger>
                </Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="space-y-5 px-4 pb-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Card className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                        <Card.Content className="space-y-1 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Emitida
                          </p>
                          <p className="text-sm font-medium text-slate-900">{formatDate(entry.issuedAt)}</p>
                        </Card.Content>
                      </Card>
                      <Card className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                        <Card.Content className="space-y-1 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Actualizada
                          </p>
                          <p className="text-sm font-medium text-slate-900">{formatDate(entry.updatedAt)}</p>
                        </Card.Content>
                      </Card>
                      <Card className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                        <Card.Content className="space-y-1 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Comprobante
                          </p>
                          <p className="text-sm font-medium text-slate-900">
                            {entry.receiptNumber || "Todavia sin numero"}
                          </p>
                        </Card.Content>
                      </Card>
                    </div>

                    {note ? (
                      <Card className="rounded-[22px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                        <Card.Content className="px-4 py-4">
                          <p className="text-sm leading-6 text-slate-600">{note}</p>
                        </Card.Content>
                      </Card>
                    ) : null}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {isLivePending ? (
                        <>
                          <Button
                            className="rounded-full bg-slate-950 px-5 text-white shadow-none hover:bg-slate-800"
                            onPress={() => onApprove(entry.attemptId)}
                          >
                            Continuar
                          </Button>
                          <Button
                            className="rounded-full border border-rose-200 bg-white px-5 text-rose-700 shadow-none hover:border-rose-300 hover:bg-rose-50"
                            onPress={() => onCancel(entry.attemptId)}
                          >
                            Detener
                          </Button>
                        </>
                      ) : entry.status !== "submitted" ? (
                        <Button
                          className="rounded-full border border-slate-200 bg-white px-5 text-slate-700 shadow-none hover:border-slate-300"
                          onPress={() => onRetry(entry.attemptId)}
                        >
                          Relanzar
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                        <Card.Content className="space-y-3 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Productos
                          </p>
                          <div className="space-y-2">
                            {entry.items.map((item, index) => (
                              <div key={`${entry.attemptId}-${index}`} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                                <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  Cantidad {item.quantity} · Precio {moneyFormatter.format(item.unitPrice)} · Total{" "}
                                  {moneyFormatter.format(item.total)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </Card.Content>
                      </Card>

                      <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                        <Card.Content className="space-y-3 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Artefactos
                          </p>
                          {entry.artifacts.length ? (
                            <div className="space-y-2">
                              {entry.artifacts.map((artifact, index) => (
                                <div
                                  key={`${entry.attemptId}-${artifact.kind}-${index}`}
                                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3"
                                >
                                  <p className="text-sm font-medium text-slate-900">{artifact.kind.toUpperCase()}</p>
                                  <Tooltip>
                                    <Tooltip.Trigger className="mt-1 block">
                                      <p className="truncate text-sm leading-6 text-slate-600">{artifact.path}</p>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content className="max-w-sm rounded-[16px] bg-slate-950 px-3 py-2 text-xs text-white">
                                      {artifact.path}
                                    </Tooltip.Content>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm leading-6 text-slate-500">
                              Todavia no hay artefactos guardados para esta venta.
                            </p>
                          )}
                        </Card.Content>
                      </Card>
                    </div>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      ) : (
        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
          <Card.Content className="px-4 py-4">
            <p className="text-sm leading-6 text-slate-600">Esta corrida todavia no tiene ventas nuevas.</p>
          </Card.Content>
        </Card>
      )}
    </section>
  );
}
