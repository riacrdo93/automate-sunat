import path from "node:path";
import { app, BrowserWindow, shell } from "electron";

const DEV_SERVER_URL = process.env.DESKTOP_DEV_URL ?? "http://127.0.0.1:5173";
const PROD_SERVER_URL = process.env.DESKTOP_PROD_URL ?? "http://127.0.0.1:3030";

function isDev(): boolean {
  return process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "1";
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#0b0b0d",
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.on("ready-to-show", () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const allowed = [DEV_SERVER_URL, PROD_SERVER_URL].some((origin) => url.startsWith(origin));
    if (allowed) {
      return;
    }
    event.preventDefault();
    void shell.openExternal(url);
  });

  return window;
}

async function loadApp(window: BrowserWindow): Promise<void> {
  const url = isDev() ? DEV_SERVER_URL : PROD_SERVER_URL;
  await window.loadURL(url);
}

async function main(): Promise<void> {
  await app.whenReady();

  const window = createMainWindow();
  await loadApp(window);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void main();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void main().catch((error) => {
  console.error(error);
  app.exit(1);
});

