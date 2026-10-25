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

  it("documents tucking list/preview chrome in narrow tri-column band", () => {
    expect(indexHtml).toMatch(
      /layout-narrow[\s\S]*captive-hero-list[\s\S]*display:\s*none/,
    );
  });
});
