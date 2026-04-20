import {
  ConfigurableSellerSource,
  FalabellaSellerSource,
  SunatPortalEmitter,
  isFalabellaDocumentsUrl,
} from "./browser";
import { AppConfig } from "./config";
import { AutomationCoordinator } from "./coordinator";
import { loadSiteProfile } from "./profiles";
import { createServer } from "./server";
import { RunStore } from "./store";

export function createAppContext(config: AppConfig) {
  const store = new RunStore(config.dataPaths.dbPath);
  const profile = loadSiteProfile(config);
  store.ensureDefaultAccountFromEnv({
    label: "Principal",
    sellerUsername: config.sellerCredentials.username,
    sellerPassword: config.sellerCredentials.password,
    sunatRuc: config.sunatCredentials.ruc,
    sunatUsername: config.sunatCredentials.username,
    sunatPassword: config.sunatCredentials.password,
  });
  const sellerSource =
    isFalabellaDocumentsUrl(config.sellerPurchasedOrdersUrl)
      ? new FalabellaSellerSource(config)
      : new ConfigurableSellerSource(config, profile);
  const emitter = new SunatPortalEmitter(config, profile);
  const coordinator = new AutomationCoordinator(config, store, sellerSource, emitter, (accountId) => {
    if (!accountId) {
      return config;
    }
    const credentials = store.getAccountCredentials(accountId);
    if (!credentials) {
      return config;
    }
    return {
      ...config,
      sellerCredentials: credentials.sellerCredentials,
      sunatCredentials: credentials.sunatCredentials,
    };
  });
  const app = createServer(coordinator);

  return {
    app,
    coordinator,
    close: async () => {
      await coordinator.stop();
      await emitter.close();
      store.close();
    },
  };
}
