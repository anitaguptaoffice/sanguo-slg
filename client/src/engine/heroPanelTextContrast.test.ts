import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLIENT_188_HERO_PANEL_CONTRAST_MARKER,
  HERO_PANEL_CONTRAST_SCOPE_SELECTOR,
  HERO_PANEL_INK_BODY_COLOR,
  HERO_PANEL_INK_DEFICIT_COLOR,
  HERO_PANEL_INK_MUTED_COLOR,
  HERO_PANEL_PAPER_MUTED_COLOR,
  HERO_PANEL_PAPER_OWNED_COLOR,
  HERO_PANEL_PAPER_SECONDARY_COLOR,
} from "@/engine/heroPanelTextContrast";

const repoRoot = join(import.meta.dirname, "../..");

describe("heroPanelTextContrast (CLIENT-188)", () => {
  it("index.html scopes paper vs ink contrast under hero center panel", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(CLIENT_188_HERO_PANEL_CONTRAST_MARKER);
    expect(html).toContain(HERO_PANEL_CONTRAST_SCOPE_SELECTOR.slice(1));
    expect(html).toContain(HERO_PANEL_PAPER_MUTED_COLOR);
    expect(html).toContain(HERO_PANEL_PAPER_SECONDARY_COLOR);
    expect(html).toContain(HERO_PANEL_INK_BODY_COLOR);
    expect(html).toContain(HERO_PANEL_INK_MUTED_COLOR);
    expect(html).toContain(HERO_PANEL_INK_DEFICIT_COLOR);
    expect(html).toMatch(/hero-cultivation-disabled-reason[\s\S]*#f0a8a0/);
    expect(html).toContain(HERO_PANEL_PAPER_OWNED_COLOR);
    expect(html).toMatch(/CLIENT-188[\s\S]*recruit-cost-preview[\s\S]*#4a3828/);
    expect(html).toMatch(/CLIENT-188[\s\S]*\.hero-detail[\s\S]*#e8dcc8/);
  });
});
