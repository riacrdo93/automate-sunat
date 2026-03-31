import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type { DashboardRunEntry } from "./domain";

export function writeBoletasZip(dataRoot: string, runId: string, entries: DashboardRunEntry[]): string | undefined {
  const submitted = entries.filter((entry) => entry.status === "submitted");
  if (!submitted.length) {
    return undefined;
  }

  const zip = new AdmZip();
  const manifest = {
    runId,
    generatedAt: new Date().toISOString(),
    boletas: submitted.map((entry) => ({
      saleExternalId: entry.saleExternalId,
      attemptId: entry.attemptId,
      receiptNumber: entry.receiptNumber ?? null,
      artifacts: entry.artifacts.map((a) => ({ kind: a.kind, path: a.path })),
    })),
  };

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));

  for (const entry of submitted) {
    const folder = `${entry.saleExternalId}_${entry.receiptNumber ?? entry.attemptId.slice(0, 8)}`;

    for (const artifact of entry.artifacts) {
      if (!artifact.path || !fs.existsSync(artifact.path)) {
        continue;
      }

      zip.addLocalFile(artifact.path, `${folder}/`, path.basename(artifact.path));
    }
  }

  const outDir = path.join(dataRoot, "boletas-export");
  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${runId}-boletas-electronicas.zip`);
  zip.writeZip(zipPath);
  return zipPath;
}
