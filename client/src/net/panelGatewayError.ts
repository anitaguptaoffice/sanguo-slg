import type { AssetLoader } from "@/engine/AssetLoader";
import { applyPanelStateChrome, renderPanelStateListRow } from "@/engine/panelStateChrome";
import type { BagClientCategory } from "@/net/bagCategory";
import { bagCategoryListEmptyMessage } from "@/net/bagCategory";
import {
  formatPanelGatewayError,
  formatPanelGatewayErrorFromUnknown,
  type PanelGatewayDomain,
} from "@/net/contentFormValidation";
import { shopEmptyListMessage } from "@/net/panelDensity";

/** 列表首屏拉取失败重试钮（CLIENT-067 + CLIENT-173）。 */
export const PANEL_GATEWAY_RETRY_CLASS = "panel-gateway-retry";

const LIST_DOMAIN_PREFIX: Partial<Record<PanelGatewayDomain, string>> = {
  bag: "背包",
  shop: "商城",
  rank: "排行",
  guild: "军团",
  buildQueue: "建造队列",
};

export type PanelGatewayListContextOptions = {
  /** 为 true 时在文案前加域前缀（背包/商城/排行…），仅列表拉取错误使用。 */
  listContext?: boolean;
};

export function formatPanelGatewayListError(
  domain: PanelGatewayDomain,
  code: number | undefined,
  msg: string,
): string {
  const core = formatPanelGatewayError(domain, code, msg);
  const prefix = LIST_DOMAIN_PREFIX[domain];
  if (!prefix) return core;
  return `${prefix}：${core}`;
}

export function formatPanelGatewayErrorFromUnknownForList(
  domain: PanelGatewayDomain,
  err: unknown,
): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: number }).code;
    return formatPanelGatewayListError(domain, code, err.message);
  }
  return formatPanelGatewayListError(domain, undefined, String(err));
}

export type PanelEmptyHintInput =
  | { panel: "bag"; category: BagClientCategory; hasAnyStacks: boolean }
  | { panel: "shop"; hasAnyOffers: boolean };

/** 筛选 chip / 分类 tab 空结果文案（empty 态，与 error 不混用）。 */
export function formatPanelEmptyHint(input: PanelEmptyHintInput): string {
  if (input.panel === "bag") {
    return bagCategoryListEmptyMessage(input.category, input.hasAnyStacks);
  }
  if (input.hasAnyOffers) {
    return "（当前分类暂无商品）";
  }
  return shopEmptyListMessage();
}

export type PanelGatewayErrorRowOptions = {
  legacyClass?: string;
  assets?: AssetLoader;
  /** `data-action` 值，由面板 click 委托触发重试 RPC。 */
  retryAction: string;
};

function appendPanelGatewayRetryButton(li: HTMLElement, retryAction: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = PANEL_GATEWAY_RETRY_CLASS;
  btn.setAttribute("data-action", retryAction);
  btn.textContent = "重试";
  li.appendChild(btn);
  return btn;
}

/** `data-panel-state=error` + CLIENT-129 chrome + 行内 `panel-gateway-retry`。 */
export function renderPanelGatewayErrorListRow(
  ul: HTMLElement,
  message: string,
  options: PanelGatewayErrorRowOptions,
): HTMLLIElement {
  const li = renderPanelStateListRow(ul, "error", message, {
    legacyClass: options.legacyClass,
    assets: options.assets,
  });
  appendPanelGatewayRetryButton(li, options.retryAction);
  return li;
}

/** 排行表格 tbody 网关错误行（与 panelStateChrome 并存）。 */
export function renderPanelGatewayErrorTableRow(
  tbody: HTMLElement,
  message: string,
  options: PanelGatewayErrorRowOptions & { colSpan?: number },
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = options.legacyClass ?? "rank-gateway-error-row";
  const td = document.createElement("td");
  td.colSpan = options.colSpan ?? 4;
  const wrap = document.createElement("div");
  wrap.className = "panel-gateway-error-cell";
  wrap.textContent = message;
  appendPanelGatewayRetryButton(wrap, options.retryAction);
  td.appendChild(wrap);
  tr.appendChild(td);
  tbody.appendChild(tr);
  applyPanelStateChrome(wrap, "error", options.assets);
  return tr;
}

/** 单测与集成：模拟点击重试钮并断言 `data-action`。 */
export function dispatchPanelGatewayRetryClick(
  root: ParentNode,
  retryAction: string,
): boolean {
  const btn = root.querySelector<HTMLButtonElement>(
    `button.${PANEL_GATEWAY_RETRY_CLASS}[data-action="${retryAction}"]`,
  );
  if (!btn) return false;
  btn.click();
  return true;
}
