import type { DailyQuestRow } from "@/net/dailyQuestState";
import { DAILY_QUEST_CHAIN_ID } from "@/net/dailyQuestState";
import { dailyQuestClaimableBadgeCount } from "@/net/dailyQuestFilterUi";

/** sessionStorage：日常 chain 类型 tab（CLIENT-169）。 */
export const DAILY_CHAIN_TAB_SESSION_KEY = "daily-chain-tab-v1";

export type DailyQuestChainTabDef = { chainId: number; label: string };

/** 既有日常链（quest_type=2）；`pickDailyChainTabs` 对空链隐藏 tab。 */
export const DAILY_QUEST_CHAIN_TAB_CATALOG: DailyQuestChainTabDef[] = [
  { chainId: 400, label: "主线" },
  { chainId: 401, label: "支线" },
];

const CATALOG_CHAIN_IDS = new Set(DAILY_QUEST_CHAIN_TAB_CATALOG.map((t) => t.chainId));

export function parseDailyChainTabSessionValue(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const id = Math.floor(n);
  return CATALOG_CHAIN_IDS.has(id) ? id : null;
}

export function readDailyChainTabSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number {
  try {
    return (
      parseDailyChainTabSessionValue(storage?.getItem(DAILY_CHAIN_TAB_SESSION_KEY) ?? null) ??
      DAILY_QUEST_CHAIN_ID
    );
  } catch {
    return DAILY_QUEST_CHAIN_ID;
  }
}

export function writeDailyChainTabSession(
  chainId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(DAILY_CHAIN_TAB_SESSION_KEY, String(chainId));
  } catch {
    /* quota / private mode */
  }
}

export function dailyQuestChainTabLabel(chainId: number): string {
  const tab = DAILY_QUEST_CHAIN_TAB_CATALOG.find((t) => t.chainId === chainId);
  return tab?.label ?? `链 ${chainId}`;
}

/** 仅保留 catalog 中的日常链行（ListPlayerQuests 全链快照裁剪）。 */
export function filterDailyQuestRowsToCatalogChains(rows: DailyQuestRow[]): DailyQuestRow[] {
  return rows.filter((q) => CATALOG_CHAIN_IDS.has(q.chain_id ?? DAILY_QUEST_CHAIN_ID));
}

export function groupDailyQuestRowsByChain(rows: DailyQuestRow[]): Map<number, DailyQuestRow[]> {
  const map = new Map<number, DailyQuestRow[]>();
  for (const q of rows) {
    const cid = q.chain_id ?? DAILY_QUEST_CHAIN_ID;
    const list = map.get(cid) ?? [];
    list.push(q);
    map.set(cid, list);
  }
  return map;
}

/** 基于快照动态隐藏空链 tab（catalog 顺序）。 */
export function pickDailyChainTabs(
  rows: DailyQuestRow[],
  catalog: readonly DailyQuestChainTabDef[] = DAILY_QUEST_CHAIN_TAB_CATALOG,
): DailyQuestChainTabDef[] {
  const grouped = groupDailyQuestRowsByChain(rows);
  return catalog.filter((tab) => (grouped.get(tab.chainId)?.length ?? 0) > 0);
}

export function resolveActiveDailyChainTab(
  rows: DailyQuestRow[],
  preferredChainId: number,
  catalog: readonly DailyQuestChainTabDef[] = DAILY_QUEST_CHAIN_TAB_CATALOG,
): number {
  const tabs = pickDailyChainTabs(rows, catalog);
  if (!tabs.length) return DAILY_QUEST_CHAIN_ID;
  if (tabs.some((t) => t.chainId === preferredChainId)) return preferredChainId;
  if (tabs.some((t) => t.chainId === DAILY_QUEST_CHAIN_ID)) return DAILY_QUEST_CHAIN_ID;
  return tabs[0].chainId;
}

export function dailyQuestRowsForChain(rows: DailyQuestRow[], chainId: number): DailyQuestRow[] {
  return rows.filter((q) => (q.chain_id ?? DAILY_QUEST_CHAIN_ID) === chainId);
}

export function isDailyQuestInProgressByProgress(q: DailyQuestRow): boolean {
  const target = q.progress_target ?? 0;
  if (target <= 0) return false;
  const cur = q.progress_current ?? 0;
  return cur < target;
}

/** 展示列表中首条 `progress_current < progress_target` 的索引；-1 表示无。 */
export function findFirstInProgressQuestIndex(rows: DailyQuestRow[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (isDailyQuestInProgressByProgress(rows[i])) return i;
  }
  return -1;
}

export function pickFirstInProgressDailyQuestCfgId(rows: DailyQuestRow[]): number {
  const idx = findFirstInProgressQuestIndex(rows);
  if (idx < 0) return 0;
  const id = rows[idx]?.quest_cfg_id ?? 0;
  return id > 0 ? id : 0;
}

/** chain 400 tab 内可领 chip 与 HUD `dailyToolbarBadgeCount` 对齐（CLIENT-162）。 */
export function dailyChainTabClaimableMatchesHud(
  catalogRows: DailyQuestRow[],
  activeChainId: number,
  hudDailyClaimable: number,
): boolean {
  if (activeChainId !== DAILY_QUEST_CHAIN_ID) return true;
  const chain400 = dailyQuestRowsForChain(catalogRows, DAILY_QUEST_CHAIN_ID);
  return dailyQuestClaimableBadgeCount(chain400) === hudDailyClaimable;
}
