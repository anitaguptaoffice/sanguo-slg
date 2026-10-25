import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepestDeeperSweep,
  formatHeroPanelGatewayRetryDeepestDeeperHint,
  formatHeroPanelStateResidualDeepestDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeeperSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeepestSweep";

describe("heroPanelStateResidualDeepestDeeperSweep (CLIENT-311)", () => {
  it("formatHeroPanelStateResidualDeepestDeeperSweepLine consolidates deepest sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepestDeeperSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深二层",
    );
    expect(formatHeroPanelStateResidualDeepestDeeperSweepLine("empty", ctx)).toContain(
      "panelState巩固再加深",
    );
    const err = formatHeroPanelStateResidualDeepestDeeperSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深二层");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("CLIENT-173");
    expect(err).toContain("CLIENT-295");
  });

  it("formatHeroPanelGatewayRetryDeepestDeeperHint extends deepest hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeepestDeeperHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-295");
  });

  it("appendHeroPanelStateResidualDeepestDeeperSweep mounts deepest-deeper class after deepest sweep", () => {
    const host = document.createElement("li");
    const deepest = document.createElement("p");
    deepest.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE);
    host.appendChild(deepest);
    appendHeroPanelStateResidualDeepestDeeperSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
    );
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS)).toBe(true);
    expect(deepest.nextElementSibling).toBe(el);
  });
});
