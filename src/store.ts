import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";
import { writeBoletasZip } from "./boletas-zip";
import {
  Artifact,
  DashboardRunEntry,
  DashboardRunRecord,
  InvoiceAttemptRecord,
  InvoiceDraft,
  RunRecordSummary,
  Sale,
  SaleRecordSummary,
  SaleStatus,
  WorkflowLogEntry,
  WorkflowStage,
} from "./domain";

type SaleRow = {
  external_id: string;
  status: SaleStatus;
  fingerprint: string;
  sale_json: string;
  attempt_id: string | null;
  updated_at: string;
};

type AttemptRow = {
  id: string;
  sale_external_id: string;
  run_id: string | null;
  status: InvoiceAttemptRecord["status"];
  draft_json: string;
  artifacts_json: string;
  error: string | null;
  receipt_number: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

type AttemptWithSaleRow = AttemptRow & {
  sale_json: string | null;
};

type RunRow = {
  id: string;
  reason: string;
  status: RunRecordSummary["status"];
  summary_json: string;
  started_at: string;
  ended_at: string | null;
};

export class RunStore {
  private readonly db: Database.Database;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  registerObservedSales(sales: Sale[]): Sale[] {
    const now = new Date().toISOString();
    const selectSale = this.db.prepare("SELECT * FROM sales WHERE external_id = ?");
    const insertSale = this.db.prepare(`
      INSERT INTO sales (external_id, status, fingerprint, sale_json, attempt_id, first_seen_at, last_seen_at, updated_at)
      VALUES (@external_id, @status, @fingerprint, @sale_json, @attempt_id, @first_seen_at, @last_seen_at, @updated_at)
    `);
    const updateSale = this.db.prepare(`
      UPDATE sales
      SET fingerprint = @fingerprint,
          sale_json = @sale_json,
          last_seen_at = @last_seen_at,
          updated_at = @updated_at
      WHERE external_id = @external_id
    `);

    const transaction = this.db.transaction((incomingSales: Sale[]) => {
      const created: Sale[] = [];

      for (const sale of incomingSales) {
        const existing = selectSale.get(sale.externalId) as SaleRow | undefined;

        if (!existing) {
          insertSale.run({
            external_id: sale.externalId,
            status: "new",
            fingerprint: sale.fingerprint,
            sale_json: JSON.stringify(sale),
            attempt_id: null,
            first_seen_at: now,
            last_seen_at: now,
            updated_at: now,
          });
          created.push(sale);
          continue;
        }

        updateSale.run({
          external_id: sale.externalId,
          fingerprint: sale.fingerprint,
          sale_json: JSON.stringify(sale),
          last_seen_at: now,
          updated_at: now,
        });
      }

      return created;
    });

    return transaction(sales);
  }

  setSaleStatus(externalId: string, status: SaleStatus, attemptId?: string): void {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE sales
        SET status = @status,
            attempt_id = @attempt_id,
            updated_at = @updated_at
        WHERE external_id = @external_id
      `,
      )
      .run({
        external_id: externalId,
        status,
        attempt_id: attemptId ?? null,
        updated_at: updatedAt,
      });
  }

  createAttempt(saleExternalId: string, draft: InvoiceDraft, runId?: string): string {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO invoice_attempts (id, sale_external_id, run_id, status, draft_json, artifacts_json, error, receipt_number, created_at, updated_at, submitted_at)
        VALUES (@id, @sale_external_id, @run_id, @status, @draft_json, @artifacts_json, @error, @receipt_number, @created_at, @updated_at, @submitted_at)
      `,
      )
      .run({
        id,
        sale_external_id: saleExternalId,
        run_id: runId ?? null,
        status: "drafted",
        draft_json: JSON.stringify(draft),
        artifacts_json: JSON.stringify([]),
        error: null,
        receipt_number: null,
        created_at: now,
        updated_at: now,
        submitted_at: null,
      });

    return id;
  }

  appendAttemptArtifacts(attemptId: string, artifacts: Artifact[]): void {
    if (!artifacts.length) {
      return;
    }

    const row = this.getAttemptRow(attemptId);
    const merged = [...JSON.parse(row.artifacts_json) as Artifact[], ...artifacts];

    this.db
      .prepare(
        `
        UPDATE invoice_attempts
        SET artifacts_json = @artifacts_json,
            updated_at = @updated_at
        WHERE id = @id
      `,
      )
      .run({
        id: attemptId,
        artifacts_json: JSON.stringify(merged),
        updated_at: new Date().toISOString(),
      });
  }

  markAttemptReadyForReview(attemptId: string, artifacts: Artifact[] = []): void {
    this.appendAttemptArtifacts(attemptId, artifacts);
    this.setAttemptStatus(attemptId, "ready_for_review");
  }

  markAttemptSubmitted(
    attemptId: string,
    artifacts: Artifact[] = [],
    receiptNumber?: string,
  ): void {
    const row = this.getAttemptRow(attemptId);
    const merged = [...JSON.parse(row.artifacts_json) as Artifact[], ...artifacts];
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        UPDATE invoice_attempts
        SET status = @status,
            artifacts_json = @artifacts_json,
            receipt_number = @receipt_number,
            submitted_at = @submitted_at,
            updated_at = @updated_at
        WHERE id = @id
      `,
      )
      .run({
        id: attemptId,
        status: "submitted",
        artifacts_json: JSON.stringify(merged),
        receipt_number: receiptNumber ?? null,
        submitted_at: now,
        updated_at: now,
      });

    const runId = row.run_id;
    if (runId) {
      this.refreshBoletasExportZip(runId);
    }
  }

  markAttemptFailed(attemptId: string, error: string, artifacts: Artifact[] = []): void {
    const row = this.getAttemptRow(attemptId);
    const merged = [...JSON.parse(row.artifacts_json) as Artifact[], ...artifacts];

    this.db
      .prepare(
        `
        UPDATE invoice_attempts
        SET status = @status,
            artifacts_json = @artifacts_json,
            error = @error,
            updated_at = @updated_at
        WHERE id = @id
      `,
      )
      .run({
        id: attemptId,
        status: "failed",
        artifacts_json: JSON.stringify(merged),
        error,
        updated_at: new Date().toISOString(),
      });
  }

  getAttempt(attemptId: string): InvoiceAttemptRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM invoice_attempts WHERE id = ?")
      .get(attemptId) as AttemptRow | undefined;

    return row ? this.deserializeAttempt(row) : undefined;
  }

  getSaleForAttempt(attemptId: string): Sale | undefined {
    const row = this.db
      .prepare(
        `
        SELECT sales.sale_json
        FROM invoice_attempts
        JOIN sales ON sales.external_id = invoice_attempts.sale_external_id
        WHERE invoice_attempts.id = ?
      `,
      )
      .get(attemptId) as { sale_json: string } | undefined;

    return row ? this.deserializeSale(row.sale_json) : undefined;
  }

  getSalesForRegistration(externalIds: string[]): Sale[] {
    const uniqueExternalIds = [...new Set(externalIds)].filter(Boolean);

    if (!uniqueExternalIds.length) {
      return [];
    }

    const placeholders = uniqueExternalIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
        SELECT sale_json
        FROM sales
        WHERE external_id IN (${placeholders})
          AND status IN ('new', 'drafted', 'failed')
        ORDER BY updated_at ASC
      `,
      )
      .all(...uniqueExternalIds) as Array<{ sale_json: string }>;

    return rows.map((row) => this.deserializeSale(row.sale_json));
  }

  getPendingSalesForRegistration(): Sale[] {
    const rows = this.db
      .prepare(
        `
        SELECT sale_json
        FROM sales
        WHERE status IN ('new', 'drafted', 'failed')
        ORDER BY updated_at ASC
      `,
      )
      .all() as Array<{ sale_json: string }>;

    return rows.map((row) => this.deserializeSale(row.sale_json));
  }

  createRun(reason: string): string {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO runs (id, reason, status, summary_json, started_at, ended_at)
        VALUES (@id, @reason, @status, @summary_json, @started_at, @ended_at)
      `,
      )
      .run({
        id,
        reason,
        status: "running",
        summary_json: JSON.stringify({}),
        started_at: now,
        ended_at: null,
      });

    return id;
  }

  finishRun(
    runId: string,
    status: RunRecordSummary["status"],
    summary: Record<string, unknown>,
  ): void {
    this.db
      .prepare(
        `
        UPDATE runs
        SET status = @status,
            summary_json = @summary_json,
            ended_at = @ended_at
        WHERE id = @id
      `,
      )
      .run({
        id: runId,
        status,
        summary_json: JSON.stringify(summary),
        ended_at: new Date().toISOString(),
      });
  }

  deleteRun(runId: string): { deleted: boolean; message: string } {
    const runRow = this.db
      .prepare(
        `
        SELECT id, summary_json
        FROM runs
        WHERE id = ?
      `,
      )
      .get(runId) as { id: string; summary_json: string } | undefined;

    if (!runRow) {
      return { deleted: false, message: "El workflow ya no existe." };
    }

    const attemptsForRun = this.db
      .prepare(
        `
        SELECT id, sale_external_id, artifacts_json
        FROM invoice_attempts
        WHERE run_id = ?
      `,
      )
      .all(runId) as Array<{ id: string; sale_external_id: string; artifacts_json: string }>;

    const summary = JSON.parse(runRow.summary_json || "{}") as Record<string, unknown>;
    const affectedSaleIds = new Set<string>([
      ...attemptsForRun.map((attempt) => attempt.sale_external_id),
      ...this.parseRunOutputSaleIds(summary.outputJsonContent),
    ]);
    const deleteAttempts = this.db.prepare(`
      DELETE FROM invoice_attempts
      WHERE run_id = @run_id
    `);
    const deleteRun = this.db.prepare(`
      DELETE FROM runs
      WHERE id = @id
    `);
    const deleteSale = this.db.prepare(`
      DELETE FROM sales
      WHERE external_id = @external_id
    `);
    const updateSale = this.db.prepare(`
      UPDATE sales
      SET status = @status,
          attempt_id = @attempt_id,
          updated_at = @updated_at
      WHERE external_id = @external_id
    `);
    const latestAttemptForSale = this.db.prepare(
      `
      SELECT id, status
      FROM invoice_attempts
      WHERE sale_external_id = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    );
    const updatedAt = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      deleteAttempts.run({ run_id: runId });
      deleteRun.run({ id: runId });

      for (const saleExternalId of affectedSaleIds) {
        const latestAttempt = latestAttemptForSale.get(saleExternalId) as
          | { id: string; status: SaleStatus }
          | undefined;

        if (latestAttempt) {
          updateSale.run({
            external_id: saleExternalId,
            status: latestAttempt.status,
            attempt_id: latestAttempt.id,
            updated_at: updatedAt,
          });
          continue;
        }

        deleteSale.run({ external_id: saleExternalId });
      }
    });

    transaction();

    const artifactPaths = attemptsForRun.flatMap((attempt) => {
      try {
        return (JSON.parse(attempt.artifacts_json) as Artifact[]).map((artifact) => artifact.path);
      } catch {
        return [];
      }
    });
    const dataRoot = path.dirname(this.dbPath);
    const managedFiles = [
      ...artifactPaths,
      typeof summary.outputJsonPath === "string" ? summary.outputJsonPath : undefined,
      typeof summary.boletasZipPath === "string" ? summary.boletasZipPath : undefined,
    ].filter((value): value is string => Boolean(value));

    for (const filePath of managedFiles) {
      this.deleteManagedFile(filePath, dataRoot);
    }

    return { deleted: true, message: "Workflow eliminado del historial." };
  }

  updateRunSummary(runId: string, summary: Record<string, unknown>): void {
    this.db
      .prepare(
        `
        UPDATE runs
        SET summary_json = @summary_json
        WHERE id = @id
      `,
      )
      .run({
        id: runId,
        summary_json: JSON.stringify(summary),
      });
  }

  getDashboardData(limit = 25): {
    sales: SaleRecordSummary[];
    attempts: InvoiceAttemptRecord[];
    runs: DashboardRunRecord[];
  } {
    const sales = this.db
      .prepare(
        `
        SELECT external_id, status, fingerprint, sale_json, attempt_id, updated_at
        FROM sales
        ORDER BY updated_at DESC
        LIMIT ?
      `,
      )
      .all(limit)
      .map((row) => {
        const typedRow = row as SaleRow;
        const sale = this.deserializeSale(typedRow.sale_json);
        return {
          externalId: typedRow.external_id,
          status: typedRow.status,
          issuedAt: sale.issuedAt,
          customerName: sale.customer.name,
          customerDocument: sale.customer.documentNumber,
          subtotal: sale.totals.subtotal,
          tax: sale.totals.tax,
          total: sale.totals.total,
          documentProgress:
            typeof sale.raw.documentProgress === "string" ? sale.raw.documentProgress : undefined,
          detailUrl: typeof sale.raw.detailUrl === "string" ? sale.raw.detailUrl : undefined,
          items: sale.items.map((item) => ({ ...item })),
          attemptId: typedRow.attempt_id ?? undefined,
          updatedAt: typedRow.updated_at,
        };
      });

    const attempts = this.db
      .prepare(
        `
        SELECT *
        FROM invoice_attempts
        ORDER BY updated_at DESC
        LIMIT ?
      `,
      )
      .all(limit)
      .map((row) => this.deserializeAttempt(row as AttemptRow));

    const entriesByRunId = new Map<string, DashboardRunEntry[]>();
    const attemptRows = this.db
      .prepare(
        `
        SELECT invoice_attempts.*, sales.sale_json
        FROM invoice_attempts
        LEFT JOIN sales ON sales.external_id = invoice_attempts.sale_external_id
        ORDER BY invoice_attempts.updated_at DESC
        LIMIT ?
      `,
      )
      .all(limit) as AttemptWithSaleRow[];

    for (const row of attemptRows) {
      if (!row.run_id) {
        continue;
      }

      const list = entriesByRunId.get(row.run_id) ?? [];
      list.push(this.deserializeRunEntry(row));
      entriesByRunId.set(row.run_id, list);
    }

    const runs = this.db
      .prepare(
        `
        SELECT *
        FROM runs
        ORDER BY started_at DESC
        LIMIT ?
      `,
      )
      .all(limit)
      .map((row) => {
        const typedRow = row as RunRow;
        const summary = JSON.parse(typedRow.summary_json) as Record<string, unknown>;
        return {
          id: typedRow.id,
          reason: typedRow.reason,
          status: typedRow.status,
          startedAt: typedRow.started_at,
          endedAt: typedRow.ended_at ?? undefined,
          summary,
          entries: entriesByRunId.get(typedRow.id) ?? [],
          workflowStages: this.deserializeWorkflowStages(summary.workflowStages),
          logs: this.deserializeWorkflowLogs(summary.logs),
          outputJsonPath:
            typeof summary.outputJsonPath === "string" ? summary.outputJsonPath : undefined,
          outputJsonContent:
            typeof summary.outputJsonContent === "string" ? summary.outputJsonContent : undefined,
        };
      });

    return { sales, attempts, runs };
  }

  private getRunEntriesForRun(runId: string): DashboardRunEntry[] {
    const rows = this.db
      .prepare(
        `
        SELECT invoice_attempts.*, sales.sale_json
        FROM invoice_attempts
        LEFT JOIN sales ON sales.external_id = invoice_attempts.sale_external_id
        WHERE invoice_attempts.run_id = ?
        ORDER BY invoice_attempts.updated_at ASC
      `,
      )
      .all(runId) as AttemptWithSaleRow[];

    return rows.map((row) => this.deserializeRunEntry(row));
  }

  private mergeRunSummaryBoletasZip(runId: string, zipPath: string, submittedCount: number): void {
    const row = this.db
      .prepare("SELECT summary_json FROM runs WHERE id = ?")
      .get(runId) as { summary_json: string } | undefined;

    if (!row) {
      return;
    }

    const summary = JSON.parse(row.summary_json || "{}") as Record<string, unknown>;
    summary.boletasZipPath = zipPath;
    summary.boletasZipCount = submittedCount;

    const stages = summary.workflowStages;
    if (Array.isArray(stages)) {
      summary.workflowStages = stages.map((stage) => {
        const typed = stage as WorkflowStage;
        if (typed.id === "registrar_facturas_sunat") {
          return {
            ...typed,
            outputPath: zipPath,
            outputCount: submittedCount,
          };
        }
        return typed;
      });
    }

    this.db
      .prepare(
        `
        UPDATE runs
        SET summary_json = @summary_json
        WHERE id = @id
      `,
      )
      .run({
        id: runId,
        summary_json: JSON.stringify(summary),
      });
  }

  private refreshBoletasExportZip(runId: string): void {
    const entries = this.getRunEntriesForRun(runId);
    const submittedCount = entries.filter((entry) => entry.status === "submitted").length;

    if (!submittedCount) {
      return;
    }

    const dataRoot = path.dirname(this.dbPath);
    const zipPath = writeBoletasZip(dataRoot, runId, entries);

    if (!zipPath) {
      return;
    }

    this.mergeRunSummaryBoletasZip(runId, zipPath, submittedCount);
  }

  private setAttemptStatus(attemptId: string, status: InvoiceAttemptRecord["status"]): void {
    this.db
      .prepare(
        `
        UPDATE invoice_attempts
        SET status = @status,
            updated_at = @updated_at
        WHERE id = @id
      `,
      )
      .run({
        id: attemptId,
        status,
        updated_at: new Date().toISOString(),
      });
  }

  private getAttemptRow(attemptId: string): AttemptRow {
    const row = this.db
      .prepare("SELECT * FROM invoice_attempts WHERE id = ?")
      .get(attemptId) as AttemptRow | undefined;

    if (!row) {
      throw new Error(`Attempt ${attemptId} was not found.`);
    }

    return row;
  }

  private deserializeSale(raw: string): Sale {
    return JSON.parse(raw) as Sale;
  }

  private deserializeAttempt(row: AttemptRow): InvoiceAttemptRecord {
    return {
      id: row.id,
      saleExternalId: row.sale_external_id,
      status: row.status,
      draft: JSON.parse(row.draft_json) as InvoiceDraft,
      artifacts: JSON.parse(row.artifacts_json) as Artifact[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at ?? undefined,
      receiptNumber: row.receipt_number ?? undefined,
      error: row.error ?? undefined,
    };
  }

  private deserializeRunEntry(row: AttemptWithSaleRow): DashboardRunEntry {
    const attempt = this.deserializeAttempt(row);
    const sale = row.sale_json ? this.deserializeSale(row.sale_json) : undefined;

    return {
      attemptId: attempt.id,
      saleExternalId: attempt.saleExternalId,
      status: attempt.status,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      issuedAt: sale?.issuedAt ?? attempt.draft.issueDate,
      customerName: sale?.customer.name ?? attempt.draft.customer.name,
      customerDocument: sale?.customer.documentNumber ?? attempt.draft.customer.documentNumber,
      subtotal: sale?.totals.subtotal ?? attempt.draft.totals.subtotal,
      tax: sale?.totals.tax ?? attempt.draft.totals.tax,
      total: sale?.totals.total ?? attempt.draft.totals.total,
      items: sale?.items.map((item) => ({ ...item })) ?? attempt.draft.items.map((item) => ({ ...item })),
      artifacts: attempt.artifacts,
      documentProgress:
        sale && typeof sale.raw.documentProgress === "string" ? sale.raw.documentProgress : undefined,
      receiptNumber: attempt.receiptNumber,
      error: attempt.error,
    };
  }

  private deserializeWorkflowStages(raw: unknown): WorkflowStage[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw as WorkflowStage[];
  }

  private deserializeWorkflowLogs(raw: unknown): WorkflowLogEntry[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw as WorkflowLogEntry[];
  }

  private parseRunOutputSaleIds(raw: unknown): string[] {
    if (typeof raw !== "string" || !raw.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.flatMap((entry) => {
        if (
          entry &&
          typeof entry === "object" &&
          "orderNumber" in entry &&
          typeof entry.orderNumber === "string"
        ) {
          return [entry.orderNumber];
        }

        return [];
      });
    } catch {
      return [];
    }
  }

  private deleteManagedFile(filePath: string, dataRoot: string): void {
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(dataRoot) + path.sep;

    if (!resolvedPath.startsWith(resolvedRoot)) {
      return;
    }

    if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      return;
    }

    fs.rmSync(resolvedPath, { force: true });
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        external_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        sale_json TEXT NOT NULL,
        attempt_id TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoice_attempts (
        id TEXT PRIMARY KEY,
        sale_external_id TEXT NOT NULL,
        run_id TEXT,
        status TEXT NOT NULL,
        draft_json TEXT NOT NULL,
        artifacts_json TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        receipt_number TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        status TEXT NOT NULL,
        summary_json TEXT NOT NULL DEFAULT '{}',
        started_at TEXT NOT NULL,
        ended_at TEXT
      );
    `);

    this.ensureColumn("invoice_attempts", "run_id", "TEXT");
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_invoice_attempts_run_id ON invoice_attempts (run_id);`);
    this.backfillAttemptRunIds();
    this.finalizeInterruptedRuns();
  }

  private ensureColumn(tableName: string, columnName: string, columnDefinition: string): void {
    const columns = this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;

    if (columns.some((column) => column.name === columnName)) {
      return;
    }

    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }

  private backfillAttemptRunIds(): void {
    const runs = this.db
      .prepare(
        `
        SELECT id, started_at, ended_at
        FROM runs
        ORDER BY started_at ASC
      `,
      )
      .all() as Array<{ id: string; started_at: string; ended_at: string | null }>;

    if (!runs.length) {
      return;
    }

    const attempts = this.db
      .prepare(
        `
        SELECT id, created_at
        FROM invoice_attempts
        WHERE run_id IS NULL
        ORDER BY created_at ASC
      `,
      )
      .all() as Array<{ id: string; created_at: string }>;

    if (!attempts.length) {
      return;
    }

    const updateRunId = this.db.prepare(`
      UPDATE invoice_attempts
      SET run_id = @run_id
      WHERE id = @id
    `);

    const transaction = this.db.transaction(() => {
      for (const attempt of attempts) {
        let matchedRunId: string | undefined;

        for (let index = runs.length - 1; index >= 0; index -= 1) {
          const run = runs[index];
          const startedBeforeAttempt = run.started_at <= attempt.created_at;
          const endedAfterAttempt = !run.ended_at || run.ended_at >= attempt.created_at;

          if (startedBeforeAttempt && endedAfterAttempt) {
            matchedRunId = run.id;
            break;
          }
        }

        if (matchedRunId) {
          updateRunId.run({ id: attempt.id, run_id: matchedRunId });
        }
      }
    });

    transaction();
  }

  private finalizeInterruptedRuns(): void {
    const runningRuns = this.db
      .prepare(
        `
        SELECT id, summary_json
        FROM runs
        WHERE status = 'running'
      `,
      )
      .all() as Array<{ id: string; summary_json: string }>;

    if (!runningRuns.length) {
      return;
    }

    const now = new Date().toISOString();
    const updateRun = this.db.prepare(`
      UPDATE runs
      SET status = @status,
          summary_json = @summary_json,
          ended_at = @ended_at
      WHERE id = @id
    `);

    const transaction = this.db.transaction(() => {
      for (const run of runningRuns) {
        const summary = JSON.parse(run.summary_json || "{}") as Record<string, unknown>;
        if (typeof summary.error !== "string") {
          summary.error = "La automatización se interrumpió antes de terminar.";
        }
        summary.interrupted = true;

        updateRun.run({
          id: run.id,
          status: "failed",
          summary_json: JSON.stringify(summary),
          ended_at: now,
        });
      }
    });

    transaction();
  }
}
