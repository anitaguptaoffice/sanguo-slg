/**
 * Node-side helpers for hero-host Playwright capture (probes run in browser via addInitScript).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const HERO_HOST_PROBE_INIT_SCRIPT = path.resolve(__dirname, "hero-host-capture-probes.page.js");

export async function installHeroHostCaptureProbes(page) {
  await page.addInitScript({ path: HERO_HOST_PROBE_INIT_SCRIPT });
}

export async function scrollHeroDetailHeadInPage(page) {
  await page.evaluate(() => window.__heroHostCaptureProbes.scrollHeroDetailHeadForSameFrame());
}

export async function probeBustNameSameFrameInPage(page) {
  return page.evaluate(() => window.__heroHostCaptureProbes.probeBustNameSameFrame());
}

export async function probeHeroPortraitFramesInPage(page, templateCfgId) {
  return page.evaluate(
    (id) => window.__heroHostCaptureProbes.probeHeroPortraitFrames(id),
    templateCfgId,
  );
}
