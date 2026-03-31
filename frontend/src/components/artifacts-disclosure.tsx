import { Card, Tooltip } from "@heroui/react";
import type { DashboardRunRecord } from "@shared/dashboard-contract";

type ArtifactsDisclosureProps = {
  run: DashboardRunRecord;
};

export function ArtifactsDisclosure({ run }: ArtifactsDisclosureProps) {
  const artifacts = run.entries.flatMap((entry) =>
    entry.artifacts.map((artifact, index) => ({
      id: `${entry.attemptId}-${artifact.kind}-${index}`,
      saleExternalId: entry.saleExternalId,
      ...artifact,
    })),
  );

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Archivos</p>
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
          {artifacts.length ? `${artifacts.length} artefacto(s)` : "Sin artefactos"}
        </h3>
      </div>

      {artifacts.length ? (
        <div className="grid gap-3">
          {artifacts.map((artifact) => (
            <Card
              key={artifact.id}
              className="rounded-[24px] border border-slate-200/80 bg-white/76 shadow-none"
            >
              <Card.Content className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-950">{artifact.saleExternalId}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {artifact.kind}
                  </p>
                </div>
                <Tooltip>
                  <Tooltip.Trigger className="block">
                    <p className="truncate text-sm leading-6 text-slate-600">{artifact.path}</p>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-sm rounded-[16px] bg-slate-950 px-3 py-2 text-xs text-white">
                    {artifact.path}
                  </Tooltip.Content>
                </Tooltip>
              </Card.Content>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
          <Card.Content className="px-4 py-4">
            <p className="text-sm leading-6 text-slate-600">Esta corrida todavia no tiene artefactos asociados.</p>
          </Card.Content>
        </Card>
      )}
    </section>
  );
}
