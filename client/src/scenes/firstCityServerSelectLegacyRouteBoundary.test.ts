import { expect, it } from "vitest";
import {
  formatFirstCityLegacyRouteBoundaryPanel,
  resolveFirstCityLegacyRouteBoundaryView,
} from "./firstCityServerSelectLegacyRouteBoundary";

it("hides the notice when the probe is not visible", () => {
  expect(resolveFirstCityLegacyRouteBoundaryView(false)).toEqual({ kind: "hidden" });
  expect(formatFirstCityLegacyRouteBoundaryPanel(false)).toBe("");
});

it("shows world.v1 versus v2 separation when the probe is visible", () => {
  expect(resolveFirstCityLegacyRouteBoundaryView(true)).toEqual({ kind: "notice" });
  const panel = formatFirstCityLegacyRouteBoundaryPanel(true);
  expect(panel).toMatch(/legacy 路由边界/);
  expect(panel).toMatch(/world\.v1 CreateCity/);
  expect(panel).toMatch(/不得回落 v1/);
  expect(panel).not.toMatch(/进入主城/);
});
