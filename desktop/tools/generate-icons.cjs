const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const assetsDir = path.join(rootDir, "assets");
  const svgPath = path.join(assetsDir, "icon.svg");
  const outDir = path.join(assetsDir, "icons");

  if (!fs.existsSync(svgPath)) {
    console.error(`Missing icon svg at ${svgPath}`);
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath, "utf8");

  ensureDir(outDir);

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  for (const size of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: size,
      },
    });
    const pngBuffer = resvg.render().asPng();
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), pngBuffer);
  }

  // electron-builder "icon" can point to a PNG (linux) or ICNS (mac) or ICO (win).
  // We'll use the largest png as a reasonable default for linux AppImage builds.
  fs.writeFileSync(path.join(outDir, "icon.png"), fs.readFileSync(path.join(outDir, "icon-1024.png")));
}

main();

