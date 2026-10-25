import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");

describe("hero host capture section buttons layout (1280 narrow)", () => {
  it("does not max-height clip tri-column captive/persuade/coming sections", () => {
    expect(indexHtml).not.toContain("max-height: 4.8em");
    expect(indexHtml).toMatch(
      /layout-narrow[\s\S]*captive-hero-section[\s\S]*overflow:\s*visible/,
    );
  });

  it("hides list/preview chrome in narrow tri-column row so buttons fit", () => {
    expect(indexHtml).toContain(
      "layout-narrow .content-panel[data-center-panel=\"hero\"] > .captive-hero-section .captive-hero-list",
    );
    expect(indexHtml).toContain(
      "layout-narrow .content-panel[data-center-panel=\"hero\"] > .persuade-section .persuade-target-list",
    );
    expect(indexHtml).toContain(
      "layout-narrow .content-panel[data-center-panel=\"hero\"] > .coming-hero-section .coming-hero-list",
    );
  });
});
