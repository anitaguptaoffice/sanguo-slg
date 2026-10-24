import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualDeepSweep,
  formatHeroPanelGatewayRetryDeepHint,
  formatHeroPanelStateResidualDeepSweepLine,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepSweep";
import { HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE } from "@/net/heroPanelStateResidualSweep";

describe("heroPanelStateResidualDeepSweep (CLIENT-263)", () => {
  it("formatHeroPanelStateResidualDeepSweepLine consolidates sweep and gateway hint", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualDeepSweepLine("loading", ctx)).toContain("panelState巩固");
    expect(formatHeroPanelStateResidualDeepSweepLine("empty", ctx)).toContain("当前筛选");
    const err = formatHeroPanelStateResidualDeepSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(err).toContain("panelState巩固");
    expect(err).toContain("网关重试 hint");
    expect(err).toContain("行内「重试」");
  });

  it("formatHeroPanelGatewayRetryDeepHint covers top bar and inline retry", () => {
    expect(
      formatHeroPanelGatewayRetryDeepHint({
        filter: "all",
        sort: "level_desc",
        listGatewayError: "err",
        hasGatewayRetry: true,
      }),
    ).toContain("刷新列表");
    expect(
      formatHeroPanelGatewayRetryDeepHint({
        filter: "all",
        sort: "level_desc",
        hasGatewayRetry: true,
      }),
    ).toContain("行内");
  });

  it("appendHeroPanelStateResidualDeepSweep mounts deep class after residual sweep", () => {
    const host = document.createElement("li");
    const sweep = document.createElement("p");
    sweep.setAttribute("data-role", HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE);
    host.appendChild(sweep);
    appendHeroPanelStateResidualDeepSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE}"]`);
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS)).toBe(true);
    expect(sweep.nextElementSibling).toBe(el);
  });
});
