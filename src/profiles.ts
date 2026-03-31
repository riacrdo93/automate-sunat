import fs from "node:fs";
import { z } from "zod";
import { AppConfig } from "./config";

const loginSchema = z.object({
  loginUrl: z.string().url(),
  usernameSelector: z.string().min(1),
  passwordSelector: z.string().min(1),
  submitSelector: z.string().min(1),
  usernameSubmitSelector: z.string().min(1).optional(),
  passwordSubmitSelector: z.string().min(1).optional(),
  rucSelector: z.string().min(1).optional(),
  rucTabSelector: z.string().min(1).optional(),
  loggedInSelector: z.string().optional(),
});

const sellerSchema = z.object({
  login: loginSchema,
  salesUrl: z.string().url(),
  saleRowSelector: z.string().min(1),
  saleIdSelector: z.string().min(1),
  customerNameSelector: z.string().min(1).optional(),
  customerDocumentSelector: z.string().min(1).optional(),
  customerEmailSelector: z.string().optional(),
  issuedAtSelector: z.string().min(1).optional(),
  totalSelector: z.string().min(1).optional(),
  detailLinkSelector: z.string().min(1),
  detailPage: z.object({
    customerNameSelector: z.string().min(1).optional(),
    customerDocumentSelector: z.string().min(1).optional(),
    customerEmailSelector: z.string().min(1).optional(),
    issuedAtSelector: z.string().min(1).optional(),
    totalSelector: z.string().min(1).optional(),
    itemRowSelector: z.string().min(1),
    itemDescriptionSelector: z.string().min(1),
    itemQuantitySelector: z.string().min(1),
    itemUnitPriceSelector: z.string().min(1),
    itemTotalSelector: z.string().optional(),
  }),
});

const sunatSchema = z.object({
  login: loginSchema,
  /** Tras iniciar sesión, clic en orden (texto exacto en el menú SOL). Si está definido, no se usa `invoiceUrl` hasta completar la ruta. */
  postLoginMenuLabels: z.array(z.string().min(1)).optional(),
  invoiceUrl: z.string().url(),
  customerDocumentTypeSelector: z.string().optional(),
  customerDocumentSelector: z.string().min(1),
  customerNameSelector: z.string().min(1),
  customerContinueSelector: z.string().optional(),
  issueDateSelector: z.string().optional(),
  currencySelector: z.string().optional(),
  addItemButtonSelector: z.string().optional(),
  itemDialogSelector: z.string().optional(),
  itemAcceptSelector: z.string().optional(),
  itemCodeSelector: z.string().optional(),
  itemUnitMeasureSelector: z.string().optional(),
  itemTaxedSelector: z.string().optional(),
  itemExemptSelector: z.string().optional(),
  itemUnaffectedSelector: z.string().optional(),
  itemRowSelector: z.string().min(1),
  itemDescriptionSelector: z.string().min(1),
  itemQuantitySelector: z.string().min(1),
  itemUnitPriceSelector: z.string().min(1),
  finalSubmitSelector: z.string().min(1),
  confirmAcceptSelector: z.string().optional(),
  successSelector: z.string().min(1),
  receiptNumberSelector: z.string().optional(),
  pdfDownloadSelector: z.string().optional(),
  xmlDownloadSelector: z.string().optional(),
  closeSuccessSelector: z.string().optional(),
  validationErrorSelector: z.string().optional(),
});

const siteProfileSchema = z.object({
  seller: sellerSchema,
  sunat: sunatSchema,
});

export type SiteProfile = z.infer<typeof siteProfileSchema>;

export function loadSiteProfile(config: AppConfig): SiteProfile {
  const raw = fs.readFileSync(config.siteProfilePath, "utf8");
  return siteProfileSchema.parse(JSON.parse(raw));
}
