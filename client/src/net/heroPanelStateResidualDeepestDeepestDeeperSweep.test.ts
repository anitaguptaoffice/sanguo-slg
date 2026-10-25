import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepestDeepestDeeperSweep,
  formatHeroPanelGatewayRetryDeepestDeepestDeeperHint,
  formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeeperSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeepestDeeperSweep";

describe("heroPanelStateResidualDeepestDeepestDeeperSweep (CLIENT-327)", () => {
  it("formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine consolidates deepest-deeper sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深三层",
    );
    expect(formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine("empty", ctx)).toContain(
      "panelState巩固再加深",
    );
    const err = formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深三层");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("CLIENT-173");
    expect(err).toContain("CLIENT-311");
  });

  it("formatHeroPanelGatewayRetryDeepestDeepestDeeperHint extends deepest-deeper hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeepestDeepestDeeperHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-311");
  });

  it("appendHeroPanelStateResidualDeepestDeepestDeeperSweep mounts class after deepest-deeper sweep", () => {
    const host = document.createElement("li");
    const deepestDeeper = document.createElement("p");
    deepestDeeper.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE);
    host.appendChild(deepestDeeper);
    appendHeroPanelStateResidualDeepestDeepestDeeperSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
    );
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS)).toBe(
      true,
    );
    expect(deepestDeeper.nextElementSibling).toBe(el);
  });
});
