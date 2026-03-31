const targetUrl = process.env.DEV_SERVER_HEALTHCHECK_URL ?? "http://127.0.0.1:3030/api/state";
const timeoutMs = Number(process.env.DEV_SERVER_WAIT_TIMEOUT_MS ?? 30_000);
const pollIntervalMs = 500;

const startedAt = Date.now();

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const response = await fetch(targetUrl, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

while (Date.now() - startedAt < timeoutMs) {
  if (await isServerReady()) {
    process.exit(0);
  }

  await sleep(pollIntervalMs);
}

console.error(`No se pudo conectar a ${targetUrl} dentro de ${timeoutMs}ms.`);
process.exit(1);
