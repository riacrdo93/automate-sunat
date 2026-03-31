import { describe, expect, test } from "vitest";
import { normalizeSale, saleToInvoiceDraft } from "../src/domain";

describe("domain helpers", () => {
  test("builds an invoice draft from a normalized sale", () => {
    const sale = normalizeSale({
      externalId: "SALE-1",
      issuedAt: "2026-03-24T10:00:00-05:00",
      currency: "PEN",
      customer: {
        name: "Acme SAC",
        documentNumber: "20111111111",
      },
      items: [
        {
          description: "Item A",
          quantity: 2,
          unitPrice: 10,
          total: 20,
          documentType: "Boleta",
        },
      ],
      totals: {
        subtotal: 20,
        tax: 0,
        total: 20,
      },
      raw: {},
    });

    const draft = saleToInvoiceDraft(sale);

    expect(draft.saleExternalId).toBe("SALE-1");
    expect(draft.customer.documentNumber).toBe("20111111111");
    expect(draft.items[0].description).toBe("Item A");
    expect(draft.items[0].documentType).toBe("Boleta");
    expect(draft.totals.total).toBe(20);
  });
});
