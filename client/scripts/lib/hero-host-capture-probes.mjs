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

export async function prepareHeroHostEvidenceChromeInPage(page) {
  await page.evaluate(() => window.__heroHostCaptureProbes.prepareHeroHostEvidenceChrome());
}

export async function scrollHeroDetailHeadInPage(page) {
  await page.evaluate(() => window.__heroHostCaptureProbes.scrollHeroDetailHeadForSameFrame());
}

export async function scrollHeroDetailFooterInPage(page) {
  await page.evaluate(() => window.__heroHostCaptureProbes.scrollHeroDetailFooterIntoView());
}

export async function scrollHeroListRowForPortraitInPage(page, templateCfgId) {
  await page.evaluate(
    (id) => window.__heroHostCaptureProbes.scrollHeroListRowForPortraitViewport(id),
    templateCfgId,
  );
}

export async function probeBustNameSameFrameInPage(page) {
  return page.evaluate(() => window.__heroHostCaptureProbes.probeBustNameSameFrame());
}

export async function probeHeroPortraitFramesInPage(page, templateCfgId, options = {}) {
  return page.evaluate(
    ({ id, opts }) => window.__heroHostCaptureProbes.probeHeroPortraitFrames(id, opts),
    { id: templateCfgId, opts: options },
  );
}
