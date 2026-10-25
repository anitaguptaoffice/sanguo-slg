import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../index.html"),
  "utf8",
);

describe("hero host narrow capture sections (HERO-HOST-SCROLL-CLIP)", () => {
  it("does not half-clip tri-column captive/persuade/coming with max-height overflow hidden", () => {
    const triColumnBlock = indexHtml.match(
      /\[data-role="hero-capture-sections-row"\][\s\S]*?overflow:\s*visible/,
    )?.[0];
    expect(triColumnBlock, "narrow tri-column section rule").toBeTruthy();
    expect(indexHtml).not.toMatch(
      /hero-capture-sections-row[\s\S]*max-height:\s*4\.8em/,
    );
  });

  it("exposes lists and previews through an expandable narrow disclosure", () => {
    expect(indexHtml).toContain(".hero-capture-info[open] > .hero-capture-info-body");
    expect(indexHtml).not.toMatch(/(?:captive-hero-list|persuade-target-list|coming-hero-list)[^{]*\{[^}]*display:\s*none/);
  });
});
