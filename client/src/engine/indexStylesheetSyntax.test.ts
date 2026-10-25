import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import postcss from "postcss";

describe("production index stylesheet", () => {
  it("parses without unclosed blocks or accidental nested selectors", () => {
    const html = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
    expect(css).toBeTruthy();
    const root = postcss.parse(css!);
    const nested: string[] = [];
    root.walkRules((rule) => {
      if (rule.parent?.type === "rule") nested.push(rule.selector);
    });
    expect(nested).toEqual([]);
  });
});
