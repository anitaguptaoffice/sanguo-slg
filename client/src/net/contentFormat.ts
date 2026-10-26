/** 核心子集道具展示名（与 internal/content/seed/catalog.json / DATA-001 对齐，非 legacy 文案）。 */
const ITEM_LABEL: Record<number, string> = {
  2001: "谷袋·初备",
  2002: "木料捆·初备",
  2003: "急工符·五刻",
  2004: "贤士名册",
  2017: "将魂碎晶",
  2005: "步卒教范牌",
  2006: "骑营调令",
  2020: "远征干粮",
  2050: "赏赐礼·伍",
  2051: "赏赐礼·拾",
  2052: "赏赐礼·拾伍",
  2053: "赏赐礼·廿",
  2054: "赏赐礼·廿伍",
  2055: "赏赐礼·叁拾",
  2056: "赏赐礼·肆拾",
  2057: "赏赐礼·伍拾",
  2058: "赏赐礼·陆拾",
};

/** Readonly DATA-002 name fallback; established UI labels above remain stable.
 * Mirrors internal/content/seed/catalog.json, with drift coverage in contentFormat.test.ts. */
const CATALOG_ITEM_LABEL: Readonly<Record<number, string>> = Object.freeze({
  2007: "常备粮垛",
  2008: "常备木料",
  2009: "粗炼铁箱",
  2010: "薄银袋",
  2011: "中程工符",
  2012: "锦绣访贤帖",
  2013: "弓队集训牌",
  2014: "攻城组件箱",
  2015: "青纹补给匣",
  2016: "蓝纹军需匣",
  2018: "城防条石包",
  2019: "庆功席帖",
  2021: "赋税凭条",
  2022: "操典摘抄",
  2023: "使节礼单",
  2024: "锻炉炭束",
  2025: "伤兵药囊",
  2026: "舆图残卷",
  2027: "军旗纹章",
  2028: "盟约抄件",
  2029: "功勋铜章",
  2030: "祈福灯盏",
  2031: "粮栈转运袋",
  2032: "梁木货箱",
  2033: "矿砂货箱",
  2034: "银铤卷",
  2035: "长程工符",
  2036: "整日工符",
  2037: "广纳贤帖",
  2038: "步阵大教令",
  2039: "骑队大调符",
  2040: "弓队大集训牌",
  2041: "重型攻城组件",
  2042: "野战粮包",
  2043: "楔木加固包",
  2044: "铁锭捆",
  2045: "井渠修缮包",
  2046: "道桥碎石",
  2047: "烽烟信号弹",
  2048: "盾胚料",
  2049: "弩车缆绳",
});

const QUEST_STATE_LABEL: Record<number, string> = {
  0: "—",
  1: "可接",
  2: "进行中",
  3: "可领奖",
  4: "已完成",
};

export function itemLabel(itemCfgId: number | undefined): string {
  if (!itemCfgId) return "?";
  return ITEM_LABEL[itemCfgId] ?? CATALOG_ITEM_LABEL[itemCfgId] ?? `道具#${itemCfgId}`;
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
