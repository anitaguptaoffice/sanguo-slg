/** 核心子集道具展示名（与 internal/content/seed/catalog.json / DATA-001 对齐，非 legacy 文案）。 */
const ITEM_LABEL: Record<number, string> = {
  2001: "谷袋·初备",
  2002: "木料捆·初备",
  2003: "急工符·五刻",
  2004: "贤士名册",
  2005: "步卒教范牌",
  2006: "骑营调令",
};

const QUEST_STATE_LABEL: Record<number, string> = {
  0: "—",
  1: "可接",
  2: "进行中",
  3: "可领奖",
  4: "已完成",
};

export function itemLabel(itemCfgId: number | undefined): string {
  if (!itemCfgId) return "?";
  return ITEM_LABEL[itemCfgId] ?? `道具#${itemCfgId}`;
}

export function questStateLabel(state: number | undefined): string {
  return QUEST_STATE_LABEL[state ?? 0] ?? `状态${state}`;
}

export function formatWalletPrice(w: {
  food?: number;
  wood?: number;
  iron?: number;
  stone?: number;
  gold?: number;
}): string {
  const parts: string[] = [];
  if (w.food) parts.push(`粮${w.food}`);
  if (w.wood) parts.push(`木${w.wood}`);
  if (w.iron) parts.push(`铁${w.iron}`);
  if (w.stone) parts.push(`石${w.stone}`);
  if (w.gold) parts.push(`币${w.gold}`);
  return parts.length ? parts.join(" ") : "免费";
}

export type QuestRow = {
  quest_cfg_id?: number;
  quest_code?: string;
  state?: number;
  progress_current?: number;
  progress_target?: number;
};

export function formatQuestLine(q: QuestRow): string {
  const id = q.quest_cfg_id ?? "?";
  const code = q.quest_code ?? "";
  const prog =
    q.progress_target && q.progress_target > 0
      ? `${q.progress_current ?? 0}/${q.progress_target}`
      : `${q.progress_current ?? 0}`;
  return `#${id} ${code} · ${questStateLabel(q.state)} · 进度 ${prog}`;
}
