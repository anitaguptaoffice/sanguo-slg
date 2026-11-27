/** 大地图格点详情：将服务端 {@link worldTileActions} 文案映射为可点击主次操作。 */

export type WorldMapTileActionKind =
  | "march-attack"
  | "march-scout"
  | "march-loot"
  | "march-occupy"
  | "open-world-gather"
  | "open-world-panel"
  | "enter-home";

export type WorldMapTileActionSpec = {
  kind: WorldMapTileActionKind;
  label: string;
  /** 出征表单 `march-purpose` 选项值；仅 march-* 使用。 */
  marchPurpose?: number;
  variant: "primary" | "secondary";
};

const MARCH_PURPOSE_ATTACK = 1;
const MARCH_PURPOSE_SCOUT = 2;
const MARCH_PURPOSE_LOOT = 3;
const MARCH_PURPOSE_OCCUPY = 4;

const ACTION_LABEL_TO_KIND: Record<string, WorldMapTileActionKind> = {
  讨伐掠夺: "march-attack",
  掠夺: "march-loot",
  占领: "march-occupy",
  采集寻宝: "open-world-gather",
  放弃野地: "open-world-panel",
  派遣驻军: "march-occupy",
  进入主城: "enter-home",
};

const KIND_DEFAULT_LABEL: Record<WorldMapTileActionKind, string> = {
  "march-attack": "出征讨伐",
  "march-scout": "侦察此格",
  "march-loot": "出征掠夺",
  "march-occupy": "出征占领",
  "open-world-gather": "采集宝物",
  "open-world-panel": "野地管理",
  "enter-home": "返回主城",
};

const KIND_MARCH_PURPOSE: Partial<Record<WorldMapTileActionKind, number>> = {
  "march-attack": MARCH_PURPOSE_ATTACK,
  "march-scout": MARCH_PURPOSE_SCOUT,
  "march-loot": MARCH_PURPOSE_LOOT,
  "march-occupy": MARCH_PURPOSE_OCCUPY,
};

const PRIMARY_PRIORITY: WorldMapTileActionKind[] = [
  "march-attack",
  "march-occupy",
  "march-loot",
  "enter-home",
  "open-world-gather",
];

function kindForLabel(label: string): WorldMapTileActionKind | null {
  const trimmed = label.trim();
  return ACTION_LABEL_TO_KIND[trimmed] ?? null;
}

function specForKind(kind: WorldMapTileActionKind, variant: "primary" | "secondary"): WorldMapTileActionSpec {
  return {
    kind,
    label: KIND_DEFAULT_LABEL[kind],
    marchPurpose: KIND_MARCH_PURPOSE[kind],
    variant,
  };
}

/** 从后端 actions 列表推导主 CTA 与次级操作（不含纯展示项「查看详情」）。 */
export function buildWorldMapTileActionSpecs(
  actions: string[],
  opts?: { ownCity?: boolean; npcHuangjin?: boolean },
): { primary: WorldMapTileActionSpec; secondary: WorldMapTileActionSpec[] } {
  const kinds = new Set<WorldMapTileActionKind>();
  for (const raw of actions ?? []) {
    if (raw.trim() === "查看详情") continue;
    const kind = kindForLabel(raw);
    if (kind) kinds.add(kind);
  }

  let primaryKind: WorldMapTileActionKind = "march-attack";
  for (const candidate of PRIMARY_PRIORITY) {
    if (kinds.has(candidate)) {
      primaryKind = candidate;
      break;
    }
  }
  if (opts?.ownCity && kinds.has("enter-home")) primaryKind = "enter-home";
  if (!kinds.size && !opts?.ownCity) {
    primaryKind = opts?.npcHuangjin ? "march-attack" : "march-occupy";
  }

  const secondary: WorldMapTileActionSpec[] = [];
  const addSecondary = (kind: WorldMapTileActionKind) => {
    if (kind === primaryKind) return;
    if (secondary.some((s) => s.kind === kind)) return;
    secondary.push(specForKind(kind, "secondary"));
  };

  if (primaryKind.startsWith("march-") && primaryKind !== "march-scout") {
    addSecondary("march-scout");
  }
  for (const kind of kinds) addSecondary(kind);
  if (!opts?.ownCity && !secondary.some((s) => s.kind === "march-scout") && primaryKind !== "march-scout") {
    addSecondary("march-scout");
  }

  return {
    primary: specForKind(primaryKind, "primary"),
    secondary: secondary.slice(0, 4),
  };
}

export function worldMapActionDataAction(kind: WorldMapTileActionKind): string {
  switch (kind) {
    case "march-attack":
    case "march-loot":
    case "march-occupy":
    case "march-scout":
      return "world-map-march";
    case "open-world-gather":
    case "open-world-panel":
      return "world-map-open-world";
    case "enter-home":
      return "world-map-home";
    default:
      return "world-map-march";
  }
}