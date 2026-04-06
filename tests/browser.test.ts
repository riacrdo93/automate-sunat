import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  addItemButtonSelectors,
  customerContinueSelectors,
  customerDocumentSelectors,
  customerNameSelectors,
  extractSunatReceiptPrefix,
  falabellaDocumentsTextLooksEmpty,
  splitIgv,
} from "../src/browser";

describe("browser helpers", () => {
  test("splits IGV without rounding intermediate amounts", () => {
    const { baseAmount, taxAmount } = splitIgv(99.9);

    expect(baseAmount).toBeCloseTo(84.66101694915254);
    expect(taxAmount).toBeCloseTo(15.23898305084746);
    expect(baseAmount + taxAmount).toBeCloseTo(99.9);
  });

  test("prioritizes dojo add item selectors for SUNAT", () => {
    const selectors = addItemButtonSelectors();

    expect(selectors[0]).toBe('span.dijitReset.dijitInline.dijitButtonText:has-text("Adicionar")');
    expect(selectors).toContain(
      "xpath=//*[contains(concat(' ', normalize-space(@class), ' '), ' dijitButtonText ') and contains(normalize-space(.), 'Adicionar')]/ancestor::*[self::a or self::button or @role='button'][1]",
    );
    expect(selectors).toContain("text=Adicionar");
  });

  test("prioritizes the boleta continue button id", () => {
    const selectors = customerContinueSelectors("#boleta\\.botonGrabarDocumento_label");

    expect(selectors[0]).toBe("#boleta\\.botonGrabarDocumento_label");
    expect(selectors).toContain("xpath=//*[@id='boleta.botonGrabarDocumento_label']");
    expect(selectors).toContain(
      "xpath=//*[@id='boleta.botonGrabarDocumento_label']/ancestor::*[@id='boleta.botonGrabarDocumento'][1]",
    );
    expect(selectors).toContain("text=Continuar");
    expect(selectors).toContain(
      "xpath=//*[contains(concat(' ', normalize-space(@class), ' '), ' dijitButtonText ') and contains(normalize-space(.), 'Continuar')]",
    );
  });

  test("prioritizes boleta customer fields", () => {
    const documentSelectors = customerDocumentSelectors("#boleta\\.numeroDocumento");
    const nameSelectors = customerNameSelectors("#boleta\\.razonSocial");

    expect(documentSelectors[0]).toBe("#boleta\\.numeroDocumento");
    expect(documentSelectors).toContain("xpath=//*[@id='boleta.numeroDocumento']");
    expect(nameSelectors[0]).toBe("#boleta\\.razonSocial");
    expect(nameSelectors).toContain("xpath=//*[@id='boleta.razonSocial']");
  });

  test("extracts the SUNAT receipt prefix from the emitted number", () => {
    expect(extractSunatReceiptPrefix("EB01-598")).toBe("EB01");
  });

  test("detects Falabella empty states instead of waiting forever for rows", () => {
    expect(falabellaDocumentsTextLooksEmpty("No hay datos")).toBe(true);
    expect(falabellaDocumentsTextLooksEmpty("Sin resultados para los filtros aplicados")).toBe(true);
    expect(falabellaDocumentsTextLooksEmpty("No data")).toBe(true);
    expect(falabellaDocumentsTextLooksEmpty("3229988096")).toBe(false);
    expect(falabellaDocumentsTextLooksEmpty("Documento pendiente 1 de 2")).toBe(false);
  });

  test("uses the exact SUNAT ids for the final emit flow in the active profiles", () => {
    const customProfile = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/custom-profile.json"), "utf8"),
    ) as { sunat: Record<string, string> };
    const dolphinProfile = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config/dolphin-profile.json"), "utf8"),
    ) as { sunat: Record<string, string> };

    for (const profile of [customProfile, dolphinProfile]) {
      expect(profile.sunat.finalSubmitSelector).toBe("#boleta-preliminar\\.botonGrabarDocumento");
      expect(profile.sunat.confirmAcceptSelector).toBe("#dlgBtnAceptarConfirm_label");
      expect(profile.sunat.successSelector).toBe("#numeroComprobante");
      expect(profile.sunat.receiptNumberSelector).toBe("#numeroComprobante");
      expect(profile.sunat.pdfDownloadSelector).toBe("#dijit_form_Button_2_label");
    }
  });
});
