import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
const psql = (sql) => execFileSync("psql", ["-h","127.0.0.1","-U","sanguo","-d","sanguo_r25e2e","-tAc",sql], { env: { ...process.env, PGPASSWORD: "sanguo" }, encoding: "utf8" }).trim();
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("http://127.0.0.1:4185", { waitUntil: "domcontentloaded" });
await p.waitForSelector("#hud");
await p.locator(".server-list li").first().click();
await p.locator('[data-action="enter-game"]').click();
await p.waitForSelector('[data-action="open-world-map"]', { timeout: 45000 });
await p.locator('[data-action="toggle-military"]').click();
await p.waitForSelector('[data-field="unit"]', { state: "visible" });
console.log("options", await p.locator('[data-field="unit"] option').count());
await p.selectOption('[data-field="unit"]', "5");
await p.fill('[data-field="recruit-count"]', "2");
await p.locator('[data-action="recruit"]').click();
for (let i = 0; i < 70; i++) {
  await p.waitForTimeout(1000);
  if (psql("SELECT count FROM city_troop WHERE unit_cfg_id=5") !== "0") break;
}
const count = psql("SELECT count FROM city_troop WHERE unit_cfg_id=5");
console.log("unit5", count, "status", await p.locator('[data-role="prepared-recruit-status"]').innerText().catch(()=>"?"));
if (Number(count) < 2) throw new Error("recruit failed");
await p.screenshot({ path: "/tmp/opencode/r25-recruit.png" });
console.log("PASS");
await b.close();
