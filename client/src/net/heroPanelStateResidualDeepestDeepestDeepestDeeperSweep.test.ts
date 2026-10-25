import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep,
  formatHeroPanelGatewayRetryDeepestDeepestDeepestDeeperHint,
  formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeeperSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeepestSweep";

describe("heroPanelStateResidualDeepestDeepestDeepestDeeperSweep (CLIENT-375)", () => {
  it("formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine consolidates deepest-deepest-deepest sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深五层",
    );
    expect(formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine("empty", ctx)).toContain(
      "panelState巩固再加深",
    );
    const err = formatHeroPanelStateResidualDeepestDeepestDeepestDeeperSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深五层");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("CLIENT-173");
    expect(err).toContain("CLIENT-375");
  });

  it("formatHeroPanelGatewayRetryDeepestDeepestDeepestDeeperHint extends deepest-deepest-deepest-deepest hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeepestDeepestDeepestDeeperHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-375");
  });

  it("appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep mounts class after deepest-deepest-deepest-deepest sweep", () => {
    const host = document.createElement("li");
    const deepestDeepestDeepestDeepest = document.createElement("p");
    deepestDeepestDeepestDeepest.setAttribute(
      "data-role",
      HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
    );
    host.appendChild(deepestDeepestDeepestDeepest);
    appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
    );
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS)).toBe(
      true,
    );
    expect(deepestDeepestDeepestDeepest.nextElementSibling).toBe(el);
  });
});
