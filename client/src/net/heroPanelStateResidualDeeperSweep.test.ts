import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeeperSweep,
  formatHeroPanelGatewayRetryDeeperHint,
  formatHeroPanelStateResidualDeeperSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeeperSweep";
import { HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE } from "@/net/heroPanelStateResidualDeepSweep";

describe("heroPanelStateResidualDeeperSweep (CLIENT-279)", () => {
  it("formatHeroPanelStateResidualDeeperSweepLine consolidates deep sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeeperSweepLine("loading", ctx)).toContain(
      "panelState巩固再加深",
    );
    expect(formatHeroPanelStateResidualDeeperSweepLine("empty", ctx)).toContain("panelState巩固");
    const err = formatHeroPanelStateResidualDeeperSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固再加深");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("CLIENT-173");
  });

  it("formatHeroPanelGatewayRetryDeeperHint extends deep hint", () => {
    expect(
      formatHeroPanelGatewayRetryDeeperHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("CLIENT-173");
  });

  it("appendHeroPanelStateResidualDeeperSweep mounts deeper class after deep sweep", () => {
    const host = document.createElement("li");
    const deep = document.createElement("p");
    deep.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE);
    host.appendChild(deep);
    appendHeroPanelStateResidualDeeperSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE}"]`);
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS)).toBe(true);
    expect(deep.nextElementSibling).toBe(el);
  });
});
