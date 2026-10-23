/**
 * CLIENT-064: queue-representative three viewports — full browser viewport evidence.
 * Stops bbox / element crops (CLIENT-063 FAIL); uses page.screenshot({ fullPage: false }).
 * Usage: node scripts/capture-client-064-evidence.mjs
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  formatGeometryForInventory,
  shotFullViewportQueueEvidence,
} from "./queueEvidenceViewport.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/client-064");
const SAMPLE_PREFIX = "docs/art/samples/client-064";

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19094);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16206);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const TIP_SHA = process.env.EVIDENCE_TIP_SHA || "";

async function waitForHttp(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function setEvidencePreset(preset) {
  const res = await fetch(`${MOCK_HTTP}/_evidence/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) throw new Error(`preset ${preset} failed: ${res.status}`);
}

async function enterMainCity(page) {
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 25000,
  });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 25000 },
  );
}

async function openQueuePanel(page) {
  await page.locator('[data-action="toggle-queue"]').click();
  await page.waitForSelector('[data-center-panel="queue"]:not(.hidden)', { timeout: 8000 });
}

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

const shots = [
  {
    id: "queue-representative-1600-dpr1",
    state: "full-viewport-queue-open",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 1 },
  },
  {
    id: "queue-representative-1600-dpr2",
    state: "full-viewport-queue-open",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 2 },
  },
  {
    id: "queue-representative-1280",
    state: "full-viewport-queue-open",
    preset: "queue-build",
    viewport: { w: 1280, h: 720, dpr: 1 },
  },
];

function viewportLabel(v) {
  return `${v.w}×${v.h} DPR${v.dpr}`;
}

async function resolveTipSha() {
  if (TIP_SHA) return TIP_SHA;
  const { execSync } = await import("node:child_process");
  return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function writeInventory(rows, tipSha) {
  const lines = [
    "# CLIENT-064 代表队列上沿证据索引",
    "",
    "仅 `queue-representative` 三视口。**完整浏览器视口**截图（`page.screenshot({ fullPage: false })`），非 `element.screenshot`、非 bbox 裁切。",
    "",
    `| 证据 tip SHA | \`${tipSha}\` |`,
    "|---|---|",
    "",
    "| 路径 | 字节 | SHA-256 | 视口 | 几何 / 滚动 | 状态 |",
    "|---|---:|---|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(
      `| \`${r.path}\` | ${r.bytes} | \`${r.sha256}\` | ${r.viewport} | ${r.geometry} | ${r.state} |`,
    );
  }
  lines.push(
    "",
    "## 复现",
    "",
    "```bash",
    "cd client && npm install && npx playwright install chromium && node scripts/capture-client-064-evidence.mjs",
    "```",
    "",
  );
  await writeFile(path.join(outDir, "INVENTORY.md"), lines.join("\n"));
  await writeFile(
    path.join(outDir, "README.md"),
    `# CLIENT-064 代表队列上沿：完整视口证据

CLIENT-063 局部裁切仍缺标题/上沿；本卡改为三视口**完整浏览器视口** JPEG。索引见 [\`INVENTORY.md\`](./INVENTORY.md)。

\`\`\`bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-064-evidence.mjs
\`\`\`
`,
  );
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "inherit",
    env: { ...process.env, MOCK_GATEWAY_PORT: String(MOCK_PORT) },
  });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws`,
      },
    },
  );
  const inventory = [];
  try {
    await new Promise((r) => setTimeout(r, 2000));
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await waitForHttp(`${MOCK_HTTP}/`);

    const browser = await chromium.launch();
    for (const shot of shots) {
      await setEvidencePreset(shot.preset);
      const context = await browser.newContext({
        viewport: { width: shot.viewport.w, height: shot.viewport.h },
        deviceScaleFactor: shot.viewport.dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page);
      await page.waitForTimeout(500);
      await openQueuePanel(page);
      const file = `${shot.id}.jpg`;
      const filePath = path.join(outDir, file);
      let quality = shot.viewport.dpr > 1 ? 72 : 86;
      let bytes;
      let geometry;
      for (let attempt = 0; attempt < 6; attempt++) {
        ({ bytes, geometry } = await shotFullViewportQueueEvidence(page, filePath, quality, stat));
        if (bytes < 1_000_000) break;
        quality -= 10;
      }
      if (bytes >= 1_000_000) {
        throw new Error(`${file} still ${bytes} bytes after quality retries`);
      }
      const sha256 = await sha256File(filePath);
      inventory.push({
        path: `${SAMPLE_PREFIX}/${file}`,
        bytes,
        sha256,
        viewport: viewportLabel(shot.viewport),
        geometry: formatGeometryForInventory(geometry),
        state: shot.state,
      });
      await context.close();
    }

    await browser.close();
    const tipSha = await resolveTipSha();
    await writeInventory(inventory, tipSha);
    console.log(`Evidence written to ${outDir} (tip ${tipSha})`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
