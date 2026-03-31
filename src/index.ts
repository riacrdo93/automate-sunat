import { loadConfig } from "./config";
import { createAppContext } from "./app";

async function main(): Promise<void> {
  const config = loadConfig();
  const context = createAppContext(config);
  const server = context.app.listen(config.port, () => {
    context.coordinator.start();
    console.log(`Panel listo en ${config.appBaseUrl}`);
    console.log(`Perfil activo: ${config.profileKind}`);
  });

  const shutdown = async () => {
    await context.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
