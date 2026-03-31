import { createHash, randomUUID } from "node:crypto";
import type { InvoiceDraft, Sale } from "../shared/dashboard-contract";

export type {
  Artifact,
  AttemptStatus,
  CustomerData,
  DashboardRunEntry,
  DashboardRunRecord,
  DashboardSnapshot,
  InvoiceAttemptRecord,
  InvoiceDraft,
  RunRecordSummary,
  Sale,
  SaleItem,
  SaleRecordSummary,
  SaleStatus,
  WorkflowLogEntry,
  WorkflowStage,
  WorkflowStep,
  WorkflowStepStatus,
} from "../shared/dashboard-contract";

export function buildSaleFingerprint(sale: Omit<Sale, "fingerprint"> | Sale): string {
  const payload = "fingerprint" in sale ? { ...sale, fingerprint: undefined } : sale;

  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
}

export function saleToInvoiceDraft(sale: Sale): InvoiceDraft {
  return {
    id: randomUUID(),
    saleExternalId: sale.externalId,
    issueDate: sale.issuedAt.slice(0, 10),
    currency: sale.currency,
    customer: sale.customer,
    items: sale.items.map((item) => ({ ...item })),
    totals: { ...sale.totals },
  };
}

export function parseAmount(raw: string): number {
  const candidate = raw
    .replace(/\s+/g, " ")
    .trim()
    .match(/-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/)?.[0];

  if (!candidate) {
    return 0;
  }

  const cleaned = candidate.replace(/[^\d,.-]/g, "").trim();

  if (!cleaned) {
    return 0;
  }

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");

    return Number(normalized);
  }

  if (cleaned.includes(",")) {
    return Number(cleaned.replace(",", "."));
  }

  return Number(cleaned);
}

export function normalizeSale(input: Omit<Sale, "fingerprint">): Sale {
  return {
    ...input,
    fingerprint: buildSaleFingerprint(input),
  };
}
