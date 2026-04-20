import { Card, Kbd, ScrollShadow } from "@heroui/react";
import { useMemo } from "react";
import type { DashboardRunRecord } from "@shared/dashboard-contract";
import { describeLogContext, formatLogTime, labelForLogLevel, toneForStatus } from "../lib/dashboard";
import { StatusChip } from "./status-chip";
import { ExpandableLogMessage } from "./expandable-log-message";
import { useStickToBottomScroll } from "../hooks/use-stick-to-bottom-scroll";

type LogsDisclosureProps = {
  run: DashboardRunRecord;
  selectedStageId?: string | null;
};

export function LogsDisclosure({ run, selectedStageId }: LogsDisclosureProps) {
  const filteredLogs = useMemo(() => {
    const stageLogs = selectedStageId ? run.logs.filter((entry) => entry.stageId === selectedStageId) : run.logs;

    return stageLogs.length ? stageLogs : run.logs;
  }, [run.logs, selectedStageId]);

  const { ref: scrollRef, onScroll } = useStickToBottomScroll<HTMLDivElement>([filteredLogs], {
    resetStickToBottomWhen: [selectedStageId ?? ""],
  });

  return (
    <Card>
      <Card.Header className="flex flex-col gap-3 px-5 pb-0 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <Card.Title className="text-xl tracking-tight text-default-900">Log en vivo</Card.Title>
          <Card.Description className="text-sm leading-6 text-default-600">
            {filteredLogs.length
              ? `${filteredLogs.length} evento(s) capturados en tiempo real`
              : "Todavia no hay eventos para esta corrida."}
          </Card.Description>
        </div>

        <StatusChip tone={toneForStatus(run.status === "running" ? "active" : run.status)}>
          {run.status === "running" ? "Stream activo" : "Ultima corrida"}
        </StatusChip>
      </Card.Header>

      <Card.Content className="p-0">
        <ScrollShadow ref={scrollRef} onScroll={onScroll} className="max-h-[460px]" hideScrollBar size={32} visibility="both">
          <div className="space-y-3 px-5 py-5 font-mono text-[12px] leading-6 sm:px-6">
            {filteredLogs.length ? (
              filteredLogs.map((log, index) => {
                const context = describeLogContext(run, log);

                return (
                  <Card key={`${log.at}-${index}`} className="font-mono">
                    <Card.Content className="flex flex-col gap-3 px-4 py-4 font-mono">
                      <div className="flex flex-wrap items-center gap-2">
                        <Kbd className="font-mono">
                          {formatLogTime(log.at)}
                        </Kbd>
                        <StatusChip
                          className="font-mono"
                          tone={
                            log.level === "error" ? "danger" : log.level === "debug" ? "neutral" : "success"
                          }
                        >
                          {labelForLogLevel(log.level)}
                        </StatusChip>
                        <StatusChip className="font-mono" tone="neutral">{context.stageLabel}</StatusChip>
                        <StatusChip className="font-mono" tone="neutral">{context.stepLabel}</StatusChip>
                        {log.saleExternalId ? <StatusChip className="font-mono" tone="neutral">{log.saleExternalId}</StatusChip> : null}
                      </div>

                      <ExpandableLogMessage
                        text={log.message}
                        preWrap={log.level === "debug"}
                        className={
                          log.level === "debug"
                            ? "break-words font-mono text-sm leading-6 text-sky-800 dark:text-sky-300"
                            : "break-words font-mono text-sm leading-6 text-default-700"
                        }
                      />
                    </Card.Content>
                  </Card>
                );
              })
            ) : (
              <Card>
                <Card.Content className="space-y-2 px-4 py-4 font-mono text-sm text-default-600">
                  <p>[idle] esperando una nueva automatizacion</p>
                  <p>[hint] aqui vas a ver cada evento del flujo en tiempo real</p>
                </Card.Content>
              </Card>
            )}
          </div>
        </ScrollShadow>
      </Card.Content>
    </Card>
  );
}
