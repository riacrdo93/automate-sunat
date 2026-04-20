import { z } from "zod";

const envSchema = z.object({
  DESKTOP_DEV_URL: z.string().url().optional(),
  DESKTOP_BACKEND_URL: z.string().url().optional(),
});

export interface ElectronEnv {
  desktopDevUrl?: string;
  desktopBackendUrl?: string;
}

export function loadElectronEnv(processEnv: NodeJS.ProcessEnv = process.env): ElectronEnv {
  const parsed = envSchema.parse(processEnv);
  return {
    desktopDevUrl: parsed.DESKTOP_DEV_URL,
    desktopBackendUrl: parsed.DESKTOP_BACKEND_URL,
  };
}

