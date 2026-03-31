const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

function readEnvFile(filePath) {
  return Object.fromEntries(
    fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.trim().startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
}

async function loginIfNeeded(page, profile, env) {
  await page.goto(profile.sunat.login.loginUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  const loggedIn = await page
    .locator(profile.sunat.login.loggedInSelector)
    .first()
    .isVisible()
    .catch(() => false);

  if (loggedIn) {
    return;
  }

  const rucTab = page.locator(profile.sunat.login.rucTabSelector).first();
  if (await rucTab.isVisible().catch(() => false)) {
    await rucTab.click();
  }

  await page.locator(profile.sunat.login.rucSelector).first().fill(env.SUNAT_RUC);
  await page.locator(profile.sunat.login.usernameSelector).first().fill(env.SUNAT_USERNAME);
  await page.locator(profile.sunat.login.passwordSelector).first().fill(env.SUNAT_PASSWORD);
  await page.locator(profile.sunat.login.submitSelector).first().click();
  await page.locator(profile.sunat.login.loggedInSelector).first().waitFor({
    state: "visible",
    timeout: 120_000,
  });
}

async function inspectFrame(frame) {
  const bodyText = await frame.locator("body").textContent().catch(() => "");
  const inputs = await frame
    .locator("input, textarea, select")
    .evaluateAll((elements) =>
      elements.map((element, index) => ({
        index,
        tag: element.tagName,
        id: element.id,
        name: element.getAttribute("name"),
        type: element.getAttribute("type"),
        value: element.getAttribute("value"),
        placeholder: element.getAttribute("placeholder"),
        title: element.getAttribute("title"),
        className: element.getAttribute("class"),
        visible: Boolean(
          element.offsetWidth || element.offsetHeight || element.getClientRects().length,
        ),
        text: (element.textContent || "").replace(/\s+/g, " ").trim(),
        outerHTML: element.outerHTML.slice(0, 400),
      })),
    )
    .catch((error) => [{ error: String(error) }]);

  const actions = await frame
    .locator("input[type='button'], input[type='submit'], button, a")
    .evaluateAll((elements) =>
      elements.slice(0, 80).map((element, index) => ({
        index,
        tag: element.tagName,
        id: element.id,
        name: element.getAttribute("name"),
        value: element.getAttribute("value"),
        className: element.getAttribute("class"),
        text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
        outerHTML: element.outerHTML.slice(0, 300),
      })),
    )
    .catch((error) => [{ error: String(error) }]);

  return {
    url: frame.url(),
    bodyText: String(bodyText).replace(/\s+/g, " ").trim().slice(0, 1_200),
    inputs,
    actions,
  };
}

async function main() {
  const root = process.cwd();
  const profile = JSON.parse(fs.readFileSync(path.join(root, "config/custom-profile.json"), "utf8"));
  const env = readEnvFile(path.join(root, ".env"));
  const storagePath = path.join(root, "data/auth/sunat.json");

  const browser = await chromium.launch({ headless: true });
  const context = fs.existsSync(storagePath)
    ? await browser.newContext({ storageState: storagePath })
    : await browser.newContext();
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    console.log("DIALOG", dialog.type(), JSON.stringify(dialog.message()));
    await dialog.dismiss().catch(() => undefined);
  });

  await loginIfNeeded(page, profile, env);
  console.log("LOGGED_IN_URL", page.url());

  for (const label of profile.sunat.postLoginMenuLabels) {
    console.log("MENU", label);
    const target = page.getByText(label, { exact: true }).first();
    await target.waitFor({ state: "visible", timeout: 60_000 });
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await target.click();
    await page.waitForTimeout(1_000);
    console.log(
      "AFTER_MENU",
      label,
      JSON.stringify({
        pageUrl: page.url(),
        frameUrls: page.frames().map((frame) => frame.url()),
      }),
    );
  }

  await page.waitForTimeout(5_000);
  await page.screenshot({ path: "/tmp/sunat-live-inspect.png", fullPage: true }).catch(() => undefined);

  const frames = [];
  for (const frame of page.frames()) {
    frames.push(await inspectFrame(frame));
  }

  console.log(JSON.stringify({ pageUrl: page.url(), frames }, null, 2));

  await context.storageState({ path: storagePath }).catch(() => undefined);
  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
