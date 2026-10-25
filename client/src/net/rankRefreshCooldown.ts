import { parseRankLastRefreshSession } from "@/net/rankLastRefreshSession";
import { socialRankEmptyRowClass } from "@/net/socialFormat";

/** 双榜手动刷新客户端冷却（只读戳记；无新 rank RPC）。 */
export const RANK_MANUAL_REFRESH_COOLDOWN_MS = 5_000;

/** sessionStorage：双榜 **手动** 刷新成功时刻（CLIENT-214，按榜单类型分键）。 */
export const RANK_MANUAL_REFRESH_SESSION_KEY = "rank-manual-refresh-ms";

export const RANK_EMPTY_RETRY_INLINE_CLASS = "rank-empty-retry-inline";

/** CLIENT-214：刷新按钮旁冷却戳记 DOM class（`data-role` 见下）。 */
export const RANK_REFRESH_COOLDOWN_STAMP_CLASS = "rank-refresh-cooldown-stamp";

export const RANK_REFRESH_COOLDOWN_STAMP_ROLE = "rank-refresh-cooldown";

export function readRankManualLastRefreshMs(
  boardType: number,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number {
  const map = parseRankLastRefreshSession(storage?.getItem(RANK_MANUAL_REFRESH_SESSION_KEY) ?? null);
  const ms = map[boardType];
  return ms != null && ms > 0 ? ms : 0;
}

export function writeRankManualLastRefreshMs(
  boardType: number,
  atMs: number,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(atMs) || atMs <= 0 || !Number.isFinite(boardType) || boardType <= 0) return;
  try {
    const map = parseRankLastRefreshSession(storage?.getItem(RANK_MANUAL_REFRESH_SESSION_KEY) ?? null);
    map[boardType] = Math.trunc(atMs);
    storage?.setItem(RANK_MANUAL_REFRESH_SESSION_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function rankRefreshCooldownRemainingMs(
  lastManualRefreshMs: number,
  nowMs = Date.now(),
  cooldownMs = RANK_MANUAL_REFRESH_COOLDOWN_MS,
): number {
  if (!Number.isFinite(lastManualRefreshMs) || lastManualRefreshMs <= 0) return 0;
  const elapsed = nowMs - lastManualRefreshMs;
  if (elapsed >= cooldownMs) return 0;
  return cooldownMs - elapsed;
}

/** 刷新按钮旁只读冷却剩余文案；冷却结束返回空字符串。 */
export function formatRankRefreshCooldownStamp(
  lastManualRefreshMs: number,
  nowMs = Date.now(),
  cooldownMs = RANK_MANUAL_REFRESH_COOLDOWN_MS,
): string {
  const remaining = rankRefreshCooldownRemainingMs(lastManualRefreshMs, nowMs, cooldownMs);
  if (remaining <= 0) return "";
  const seconds = Math.ceil(remaining / 1000);
  return `冷却剩余：${seconds} 秒`;
}

export function appendRankEmptyRetryButton(parent: HTMLElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = RANK_EMPTY_RETRY_INLINE_CLASS;
  btn.setAttribute("data-action", "retry-refresh-rank");
  btn.textContent = "重试";
  parent.appendChild(btn);
  return btn;
}

/** 排行空榜行：文案 + 行内 `rank-empty-retry-inline`（同源 `refreshRank` handler）。 */
export function renderRankEmptyTableRow(tbody: HTMLElement, message: string): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = socialRankEmptyRowClass();
  const td = document.createElement("td");
  td.colSpan = 4;
  const text = document.createElement("span");
  text.className = "rank-empty-hint-text";
  text.textContent = message;
  td.append(text);
  td.append(document.createElement("br"));
  appendRankEmptyRetryButton(td);
  tr.appendChild(td);
  tbody.appendChild(tr);
  return tr;
}
