import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanish = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value.toLowerCase() === "true";
  });

const envSchema = z.object({
  APP_PORT: z.coerce.number().int().positive().default(3030),
  APP_BASE_URL: z.string().url().optional(),
  DATA_DIR: z.string().default("./data"),
  SITE_PROFILE_PATH: z.string().default("./config/custom-profile.json"),
  SELLER_PURCHASED_ORDERS_URL: z
    .string()
    .url()
    .default("https://sellercenter.falabella.com/order/invoice#/purchased-order-list"),
  RUN_MODE: z.enum(["manual", "hourly", "both"]).default("manual"),
  CHECK_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  HEADFUL: booleanish.default(true),
  SLOW_MO_MS: z.coerce.number().int().min(0).default(250),
  SELLER_USERNAME: z.string().default(""),
  SELLER_PASSWORD: z.string().default(""),
  SUNAT_USERNAME: z.string().default(""),
  SUNAT_PASSWORD: z.string().default(""),
  SUNAT_RUC: z.string().default(""),
});

export interface AppConfig {
  port: number;
  appBaseUrl: string;
  profileKind: "custom";
  siteProfilePath: string;
  sellerPurchasedOrdersUrl: string;
  runMode: "manual" | "hourly" | "both";
  checkIntervalMinutes: number;
  headful: boolean;
  slowMoMs: number;
  sellerCredentials: {
    username: string;
    password: string;
  };
  sunatCredentials: {
    ruc: string;
    username: string;
    password: string;
  };
  dataPaths: {
    rootDir: string;
    dbPath: string;
    authDir: string;
    screenshotsDir: string;
    tracesDir: string;
  };
}

export function loadConfig(overrides: Partial<NodeJS.ProcessEnv> = {}): AppConfig {
  const parsed = envSchema.parse({
    ...process.env,
    ...overrides,
  });

  const rootDir = path.resolve(parsed.DATA_DIR);
  const appBaseUrl = parsed.APP_BASE_URL ?? `http://localhost:${parsed.APP_PORT}`;
  const siteProfilePath = parsed.SITE_PROFILE_PATH
    ? path.resolve(parsed.SITE_PROFILE_PATH)
    : undefined;

  if (!siteProfilePath) {
    throw new Error("SITE_PROFILE_PATH es obligatorio.");
  }

  const config: AppConfig = {
    port: parsed.APP_PORT,
    appBaseUrl,
    profileKind: "custom",
    siteProfilePath,
    sellerPurchasedOrdersUrl: parsed.SELLER_PURCHASED_ORDERS_URL,
    runMode: parsed.RUN_MODE,
    checkIntervalMinutes: parsed.CHECK_INTERVAL_MINUTES,
    headful: parsed.HEADFUL,
    slowMoMs: parsed.SLOW_MO_MS,
    sellerCredentials: {
      username: parsed.SELLER_USERNAME,
      password: parsed.SELLER_PASSWORD,
    },
    sunatCredentials: {
      ruc: parsed.SUNAT_RUC,
      username: parsed.SUNAT_USERNAME,
      password: parsed.SUNAT_PASSWORD,
    },
    dataPaths: {
      rootDir,
      dbPath: path.join(rootDir, "automation.db"),
      authDir: path.join(rootDir, "auth"),
      screenshotsDir: path.join(rootDir, "screenshots"),
      tracesDir: path.join(rootDir, "traces"),
    },
  };

  ensureDirectories(config);

  return config;
}

export function ensureDirectories(config: AppConfig): void {
  for (const directory of [
    config.dataPaths.rootDir,
    config.dataPaths.authDir,
    config.dataPaths.screenshotsDir,
    config.dataPaths.tracesDir,
  ]) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }
}
