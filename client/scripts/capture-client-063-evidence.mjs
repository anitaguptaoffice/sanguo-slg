/**
 * CLIENT-063: queue-representative three viewports — fix top border capture framing.
 * Playwright element.screenshot() omits border-image edges when overflow:auto (~24px black bar).
 * Usage: node scripts/capture-client-063-evidence.mjs
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/client-063");
const SAMPLE_PREFIX = "docs/art/samples/client-063";

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19093);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16205);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const TIP_SHA = process.env.EVIDENCE_TIP_SHA || "";

const panelLocators = {
  queue: '[data-center-panel="queue"]',
};

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

async function openPanel(page, which) {
  const map = { queue: "toggle-queue" };
  await page.locator(`[data-action="${map[which]}"]`).click();
  await page.waitForSelector(`${panelLocators[which]}:not(.hidden)`, { timeout: 8000 });
}

/**
 * Representative center-panel shot: viewport clip on border box (not element.screenshot).
 * @see CLIENT-063 — border-image + overflow:auto loses top slice in element captures.
 */
async function shotRepresentativeCenterPanel(page, which, filePath, quality = 86) {
  const panel = page.locator(panelLocators[which]);
  await panel.waitFor({ state: "visible" });
  await panel.evaluate((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
  await page.waitForTimeout(120);
  const box = await panel.boundingBox();
  if (!box) throw new Error(`panel box missing: ${which}`);
  await page.screenshot({
    path: filePath,
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
    type: "jpeg",
    quality,
  });
  const { size } = await stat(filePath);
  if (size >= 1_000_000) {
    throw new Error(`${path.basename(filePath)} is ${size} bytes (must be <1MB)`);
  }
  return size;
}

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

const shots = [
  {
    id: "queue-representative-1600-dpr1",
    panel: "queue",
    state: "representative-center-panel",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 1 },
  },
  {
    id: "queue-representative-1600-dpr2",
    panel: "queue",
    state: "representative-center-panel",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 2 },
  },
  {
    id: "queue-representative-1280",
    panel: "queue",
    state: "representative-center-panel",
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
    "# CLIENT-063 代表队列上沿证据索引",
    "",
    "仅 `queue-representative` 三视口。根因：Playwright `element.screenshot` 在 `overflow:auto` + 九宫格 `border-image` 时上沿约 24px 呈 viewport 底色；改用 `page.screenshot` 按元素 border box 裁剪。",
    "",
    `| 证据 tip SHA | \`${tipSha}\` |`,
    "|---|---|",
    "",
    "| 路径 | 字节 | SHA-256 | 视口 | 面板 | 状态 |",
    "|---|---:|---|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(
      `| \`${r.path}\` | ${r.bytes} | \`${r.sha256}\` | ${r.viewport} | ${r.panel} | ${r.state} |`,
    );
  }
  lines.push(
    "",
    "## 复现",
    "",
    "```bash",
    "cd client && npm install && npx playwright install chromium && node scripts/capture-client-063-evidence.mjs",
    "```",
    "",
  );
  await writeFile(path.join(outDir, "INVENTORY.md"), lines.join("\n"));
  await writeFile(
    path.join(outDir, "README.md"),
    `# CLIENT-063 代表队列上沿黑条修复

仅重拍队列代表九宫格三视口（1600 DPR1/DPR2、1280）。索引见 [\`INVENTORY.md\`](./INVENTORY.md)。

\`\`\`bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-063-evidence.mjs
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
      await openPanel(page, shot.panel);
      const file = `${shot.id}.jpg`;
      const filePath = path.join(outDir, file);
      const bytes = await shotRepresentativeCenterPanel(page, shot.panel, filePath);
      const sha256 = await sha256File(filePath);
      inventory.push({
        path: `${SAMPLE_PREFIX}/${file}`,
        bytes,
        sha256,
        viewport: viewportLabel(shot.viewport),
        panel: shot.panel,
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
