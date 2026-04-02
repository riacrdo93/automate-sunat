import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { normalizeSale, saleToInvoiceDraft } from "../src/domain";
import { RunStore } from "../src/store";
import { createTempDataDir } from "./helpers";

describe("RunStore", () => {
  let dataDir = "";
  let store: RunStore;

  beforeEach(() => {
    dataDir = createTempDataDir("sunat-store");
    store = new RunStore(path.join(dataDir, "test.db"));
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test("registers new sales only once and preserves dedupe", () => {
    const sale = normalizeSale({
      externalId: "SALE-42",
      issuedAt: "2026-03-24T10:00:00-05:00",
      currency: "PEN",
      customer: {
        name: "Cliente Uno",
        documentNumber: "20123456789",
      },
      items: [{ description: "Producto", quantity: 1, unitPrice: 50, total: 50 }],
      totals: { subtotal: 50, tax: 0, total: 50 },
      raw: {},
    });

    const firstPass = store.registerObservedSales([sale]);
    const secondPass = store.registerObservedSales([sale]);

    expect(firstPass).toHaveLength(1);
    expect(secondPass).toHaveLength(0);
  });

  test("tracks attempt lifecycle", () => {
    const sale = normalizeSale({
      externalId: "SALE-77",
      issuedAt: "2026-03-24T10:00:00-05:00",
      currency: "PEN",
      customer: {
        name: "Cliente Dos",
        documentNumber: "20999999999",
      },
      items: [{ description: "Servicio", quantity: 1, unitPrice: 120, total: 120 }],
      totals: { subtotal: 120, tax: 0, total: 120 },
      raw: {},
    });

    store.registerObservedSales([sale]);
    const attemptId = store.createAttempt(sale.externalId, saleToInvoiceDraft(sale));
    store.setSaleStatus(sale.externalId, "drafted", attemptId);
    store.markAttemptReadyForReview(attemptId, []);
    store.setSaleStatus(sale.externalId, "ready_for_review", attemptId);
    store.markAttemptSubmitted(attemptId, [], "EB01-12345", "EB01");
    store.setSaleStatus(sale.externalId, "submitted", attemptId);

    const attempt = store.getAttempt(attemptId);

    expect(attempt?.status).toBe("submitted");
    expect(attempt?.receiptNumber).toBe("EB01-12345");
    expect(attempt?.receiptPrefix).toBe("EB01");
  });

  test("groups collected records inside launched automations", () => {
    const sale = normalizeSale({
      externalId: "SALE-88",
      issuedAt: "2026-03-24T14:00:00-05:00",
      currency: "PEN",
      customer: {
        name: "Cliente Tres",
        documentNumber: "20111111111",
      },
      items: [{ description: "Teclado", quantity: 1, unitPrice: 80, total: 80 }],
      totals: { subtotal: 80, tax: 0, total: 80 },
      raw: {
        documentProgress: "Detalle leído",
      },
    });

    store.registerObservedSales([sale]);
    const runId = store.createRun("manual");
    const attemptId = store.createAttempt(sale.externalId, saleToInvoiceDraft(sale), runId);
    store.setSaleStatus(sale.externalId, "drafted", attemptId);

    const dashboard = store.getDashboardData();

    expect(dashboard.runs[0]?.id).toBe(runId);
    expect(dashboard.runs[0]?.entries[0]?.attemptId).toBe(attemptId);
    expect(dashboard.runs[0]?.entries[0]?.saleExternalId).toBe(sale.externalId);
    expect(dashboard.runs[0]?.entries[0]?.documentProgress).toBe("Detalle leído");
  });

  test("keeps receipt metadata without generating ZIP exports when attempts with a run are submitted", () => {
    const sale = normalizeSale({
      externalId: "SALE-ZIP",
      issuedAt: "2026-03-24T16:00:00-05:00",
      currency: "PEN",
      customer: {
        name: "Cliente ZIP",
        documentNumber: "20998877666",
      },
      items: [{ description: "Item", quantity: 1, unitPrice: 10, total: 10 }],
      totals: { subtotal: 10, tax: 0, total: 10 },
      raw: {},
    });

    store.registerObservedSales([sale]);
    const runId = store.createRun("manual");
    const artifactPath = path.join(dataDir, "evidencia.png");
    fs.writeFileSync(artifactPath, "fake-png", "utf8");

    const attemptId = store.createAttempt(sale.externalId, saleToInvoiceDraft(sale), runId);
    store.markAttemptSubmitted(
      attemptId,
      [{ kind: "screenshot", path: artifactPath }],
      "EB01-0001",
      "EB01",
    );

    const dashboard = store.getDashboardData();
    const summary = dashboard.runs[0]?.summary;
    const runEntry = dashboard.runs[0]?.entries[0];

    expect(summary?.boletasZipPath).toBeUndefined();
    expect(summary?.boletasZipCount).toBeUndefined();
    expect(runEntry?.receiptNumber).toBe("EB01-0001");
    expect(runEntry?.receiptPrefix).toBe("EB01");
  });

  test("deletes a run, its attempts, and managed files", () => {
    const sale = normalizeSale({
      externalId: "SALE-DELETE",
      issuedAt: "2026-03-24T18:00:00-05:00",
      currency: "PEN",
      customer: {
        name: "Cliente Delete",
        documentNumber: "20887766554",
      },
      items: [{ description: "Item", quantity: 1, unitPrice: 20, total: 20 }],
      totals: { subtotal: 20, tax: 0, total: 20 },
      raw: {},
    });

    store.registerObservedSales([sale]);
    const runId = store.createRun("manual");
    const extractDir = path.join(dataDir, "falabella-extract");
    fs.mkdirSync(extractDir, { recursive: true });
    const outputJsonPath = path.join(extractDir, `${runId}.json`);
    fs.writeFileSync(
      outputJsonPath,
      JSON.stringify([{ orderNumber: sale.externalId, customerName: sale.customer.name }], null, 2),
      "utf8",
    );

    const artifactPath = path.join(dataDir, "screenshots", "delete-me.png");
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, "fake-png", "utf8");
    const boletasDownloadDir = path.join(dataDir, "boletas-descargadas", "2026-03-30_23-37-44");
    fs.mkdirSync(boletasDownloadDir, { recursive: true });
    fs.writeFileSync(path.join(boletasDownloadDir, "SALE-DELETE_EB01-20887766554.pdf"), "fake-pdf", "utf8");

    const attemptId = store.createAttempt(sale.externalId, saleToInvoiceDraft(sale), runId);
    store.setSaleStatus(sale.externalId, "drafted", attemptId);
    store.appendAttemptArtifacts(attemptId, [{ kind: "screenshot", path: artifactPath }]);
    store.finishRun(runId, "completed", {
      outputJsonPath,
      outputJsonContent: JSON.stringify([{ orderNumber: sale.externalId }], null, 2),
      boletasDownloadDir,
    });

    const result = store.deleteRun(runId);
    const dashboard = store.getDashboardData();

    expect(result.deleted).toBe(true);
    expect(dashboard.runs).toHaveLength(0);
    expect(dashboard.attempts).toHaveLength(0);
    expect(dashboard.sales).toHaveLength(0);
    expect(fs.existsSync(outputJsonPath)).toBe(false);
    expect(fs.existsSync(artifactPath)).toBe(false);
    expect(fs.existsSync(boletasDownloadDir)).toBe(false);
  });
});
