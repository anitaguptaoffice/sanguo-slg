import type { QuestRow } from "@/net/contentFormat";
import { formatQuestLine, questStateLabel } from "@/net/contentFormat";

/** DATA-002 `march_ration` → item_cfg_id（catalog.json）。 */
export const MARCH_RATION_ITEM_CFG_ID = 2020;

export type DailyObjectiveKind =
  | "collect_resource"
  | "recruit_hero"
  | "train_troops"
  | "build_level"
  | "use_item"
  | "unknown";

const OBJECTIVE_LABEL: Record<DailyObjectiveKind, string> = {
  collect_resource: "采集",
  recruit_hero: "招募",
  train_troops: "练兵",
  build_level: "建造",
  use_item: "使用道具",
  unknown: "日常",
};

/** chain 400 日常 code → QUEST-003 objective type（无服务端 objective 字段时的客户端真源）。 */
const QUEST_CODE_TO_KIND: Record<string, DailyObjectiveKind> = {
  daily_food_1: "collect_resource",
  daily_wood_1: "collect_resource",
  daily_iron_1: "collect_resource",
  daily_silver_1: "collect_resource",
  daily_recruit_1: "recruit_hero",
  daily_train_1: "train_troops",
  daily_build_1: "build_level",
  daily_march_1: "use_item",
};

/** cfg_quest.quest_cfg_id 回退（与 DATA-002 generated 一致）。 */
const QUEST_CFG_TO_KIND: Record<number, DailyObjectiveKind> = {
  1012: "collect_resource",
  1013: "collect_resource",
  1030: "collect_resource",
  1031: "collect_resource",
  1015: "recruit_hero",
  1014: "train_troops",
  1032: "build_level",
  1033: "use_item",
};

export type DailyQuestNavAction =
  | { kind: "train_troops" }
  | { kind: "build_level" }
  | { kind: "use_item"; itemCfgId: number }
  | { kind: "recruit_hero" }
  | { kind: "collect_resource" };

export function dailyObjectiveKindForQuest(q: {
  quest_code?: string;
  quest_cfg_id?: number;
}): DailyObjectiveKind {
  const code = q.quest_code?.trim();
  if (code && QUEST_CODE_TO_KIND[code]) return QUEST_CODE_TO_KIND[code];
  const id = q.quest_cfg_id ?? 0;
  if (id && QUEST_CFG_TO_KIND[id]) return QUEST_CFG_TO_KIND[id];
  if (code?.startsWith("daily_")) return "unknown";
  return "unknown";
}

export function dailyObjectiveLabel(kind: DailyObjectiveKind): string {
  return OBJECTIVE_LABEL[kind] ?? OBJECTIVE_LABEL.unknown;
}

/** chain 400 行内展示标签（可与 objective kind 不同，如 daily_march_1 → 战备）。 */
const QUEST_CODE_TO_ROW_LABEL: Record<string, string> = {
  daily_march_1: "战备",
};

export function dailyObjectiveLabelForQuest(q: {
  quest_code?: string;
  quest_cfg_id?: number;
}): string {
  const code = q.quest_code?.trim();
  if (code && QUEST_CODE_TO_ROW_LABEL[code]) return QUEST_CODE_TO_ROW_LABEL[code];
  if ((q.quest_cfg_id ?? 0) === 1033) return "战备";
  return dailyObjectiveLabel(dailyObjectiveKindForQuest(q));
}

export function formatDailyQuestLineWithObjective(q: QuestRow): string {
  const tag = dailyObjectiveLabelForQuest(q);
  return `[${tag}] ${formatQuestLine(q)}`;
}

/** 可接或进行中：仍需玩家完成目标（非可领/已完成）。 */
export function dailyQuestNeedsNextStep(q: QuestRow | null | undefined): boolean {
  if (!q) return false;
  const s = q.state ?? 0;
  return s === 1 || s === 2;
}

export function resolveDailyQuestNavAction(q: QuestRow): DailyQuestNavAction | null {
  if (!dailyQuestNeedsNextStep(q)) return null;
  const kind = dailyObjectiveKindForQuest(q);
  switch (kind) {
    case "train_troops":
      return { kind: "train_troops" };
    case "build_level":
      return { kind: "build_level" };
    case "use_item":
      return { kind: "use_item", itemCfgId: MARCH_RATION_ITEM_CFG_ID };
    case "recruit_hero":
      return { kind: "recruit_hero" };
    case "collect_resource":
      return { kind: "collect_resource" };
    default:
      return null;
  }
}

export function formatDailyQuestNextStepHint(action: DailyQuestNavAction): string {
  switch (action.kind) {
    case "train_troops":
      return "下一步：打开「队列」查看募兵进度，或在「军事」面板募兵（QUEST-003 自动累计练兵进度）。";
    case "build_level":
      return "下一步：打开「队列」进行内政升级，或点选主城建筑发起升级（建造完成后自动推进日常）。";
    case "use_item":
      return `下一步：打开「背包」，使用远征干粮（item_cfg_id=${action.itemCfgId}）推进战备日常。`;
    case "recruit_hero":
      return "下一步：打开「将领」完成招募（进度由服务端自动累计）。";
    case "collect_resource":
      return "下一步：通过内政收粮/伐木等累积资源，进度由服务端自动挂钩。";
    default:
      return "";
  }
}

export function formatDailyQuestDetailWithGuidance(q: QuestRow | null): string {
  if (!q) return "（未选中）";
  const id = q.quest_cfg_id ?? "?";
  const code = q.quest_code ?? "—";
  const tag = dailyObjectiveLabelForQuest(q);
  const prog =
    q.progress_target && q.progress_target > 0
      ? `${q.progress_current ?? 0} / ${q.progress_target}`
      : String(q.progress_current ?? 0);
  const lines = [
    `[${tag}] #${id} · ${code}`,
    `状态：${questStateLabel(q.state)}`,
    `进度：${prog}`,
  ];
  const nav = resolveDailyQuestNavAction(q);
  if (nav) lines.push(formatDailyQuestNextStepHint(nav));
  return lines.join("\n");
}
