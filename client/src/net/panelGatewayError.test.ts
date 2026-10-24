import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { PANEL_STATE_CHROME_CLASS } from "@/engine/panelStateChrome";
import {
  dispatchPanelGatewayRetryClick,
  formatPanelEmptyHint,
  formatPanelGatewayErrorFromUnknownForList,
  formatPanelGatewayListError,
  PANEL_GATEWAY_RETRY_CLASS,
  renderPanelGatewayErrorListRow,
  renderPanelGatewayErrorTableRow,
} from "@/net/panelGatewayError";

describe("formatPanelGatewayListError domain prefix", () => {
  it("prefixes bag/shop/rank/guild/buildQueue list errors", () => {
    expect(formatPanelGatewayListError("bag", 99999, "自定义错误")).toBe(
      "背包：自定义错误 [99999]",
    );
    expect(formatPanelGatewayListError("shop", 64003, "余额不足")).toBe(
      "商城：余额不足 [64003]",
    );
    expect(formatPanelGatewayListError("rank", 62001, "排行榜不存在")).toBe(
      "排行：排行榜不存在 [62001]",
    );
    expect(formatPanelGatewayListError("guild", 60001, "军团不存在")).toBe(
      "军团：军团不存在 [60001]",
    );
    expect(formatPanelGatewayListError("buildQueue", 40003, "建筑槽位无效")).toBe(
      "建造队列：建筑槽位无效 [40003]",
    );
  });

  it("leaves recruit/march form domains unprefixed", () => {
    expect(formatPanelGatewayListError("recruit", 10001, "道具不足")).toBe("道具不足 [10001]");
    expect(formatPanelGatewayListError("march", 50006, "城内兵力不足")).toBe(
      "城内兵力不足 [50006]",
    );
  });

  it("formats from Error with code", () => {
    const err = Object.assign(new Error("余额不足"), { code: 64003 });
    expect(formatPanelGatewayErrorFromUnknownForList("shop", err)).toBe(
      "商城：余额不足 [64003]",
    );
  });
});

describe("formatPanelEmptyHint", () => {
  it("uses category empty copy for bag filter chips", () => {
    expect(
      formatPanelEmptyHint({ panel: "bag", category: "cultivation", hasAnyStacks: true }),
    ).toContain("养成");
    expect(formatPanelEmptyHint({ panel: "bag", category: "all", hasAnyStacks: false })).toContain(
      "背包为空",
    );
  });

  it("distinguishes shop shelf empty vs category filter empty", () => {
    expect(formatPanelEmptyHint({ panel: "shop", hasAnyOffers: false })).toContain("货架");
    expect(formatPanelEmptyHint({ panel: "shop", hasAnyOffers: true })).toContain("分类");
  });
});

describe("panel-gateway-retry wiring", () => {
  it("renders list error row with data-panel-state=error and retry button", () => {
    const ul = document.createElement("ul");
    const onRetry = vi.fn();
    ul.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest("button");
      if (btn?.getAttribute("data-action") === "retry-refresh-bag") onRetry();
    });
    renderPanelGatewayErrorListRow(ul, "背包：操作失败 [1]", {
      retryAction: "retry-refresh-bag",
    });
    const li = ul.querySelector("li");
    expect(li?.getAttribute("data-panel-state")).toBe("error");
    expect(li?.classList.contains(PANEL_STATE_CHROME_CLASS)).toBe(true);
    const retry = ul.querySelector(`.${PANEL_GATEWAY_RETRY_CLASS}`);
    expect(retry?.getAttribute("data-action")).toBe("retry-refresh-bag");
    expect(dispatchPanelGatewayRetryClick(ul, "retry-refresh-bag")).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders table error row with retry and keeps text when data-art-skin=off", () => {
    const wrap = document.createElement("div");
    wrap.dataset.artSkin = "off";
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    document.body.appendChild(wrap);
    const assets = {
      getImageForAsset: vi.fn(() => ({ img: document.createElement("img"), scale: 1 })),
      getArtMeta: vi.fn(() => ({ nine_slice: { top: 8, right: 8, bottom: 8, left: 8 } })),
    } as unknown as AssetLoader;
    renderPanelGatewayErrorTableRow(tbody, "排行：操作失败 [2]", {
      retryAction: "retry-refresh-rank",
      assets,
    });
    const cell = tbody.querySelector(".panel-gateway-error-cell");
    expect(cell?.getAttribute("data-panel-state")).toBe("error");
    expect(cell?.classList.contains("panel-state-chrome--skinned")).toBe(false);
    expect(cell?.textContent).toContain("排行：操作失败");
    expect(tbody.querySelector(`.${PANEL_GATEWAY_RETRY_CLASS}`)).toBeTruthy();
    wrap.remove();
  });
});
