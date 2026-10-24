import { describe, expect, it } from "vitest";
import {
  appendHeroPanelStateResidualSweep,
  formatHeroPanelStateResidualSweepLine,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualSweep";

describe("heroPanelStateResidualSweep (CLIENT-247)", () => {
  it("formatHeroPanelStateResidualSweepLine covers loading empty and gateway error", () => {
    const ctx = { filter: "deployable" as const, sort: "loyalty_desc" as const };
    expect(formatHeroPanelStateResidualSweepLine("loading", ctx)).toContain("可出征");
    expect(formatHeroPanelStateResidualSweepLine("empty", ctx)).toContain("忠诚↓");
    const errLine = formatHeroPanelStateResidualSweepLine("error", {
      ...ctx,
      listGatewayError: "网关超时 [10001]",
      hasGatewayRetry: true,
    });
    expect(errLine).toContain("刷新列表");
    expect(errLine).toContain("行内「重试」");
  });

  it("appendHeroPanelStateResidualSweep mounts hero-panel-state-residual-sweep class", () => {
    const host = document.createElement("li");
    appendHeroPanelStateResidualSweep(host, "loading", {
      filter: "all",
      sort: "level_desc",
    });
    const el = host.querySelector(`[data-role="${HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE}"]`);
    expect(el?.classList.contains(HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS)).toBe(true);
    expect(el?.textContent).toContain("筛选记忆");
  });
});
