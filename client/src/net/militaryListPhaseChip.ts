import {
  militaryListPhaseFilterLabel,
  type MilitaryListFilterV1,
  type MilitaryListPhaseFilter,
} from "@/net/militaryListFilter";

/** 军情阶段筛选 chip 顺序（CLIENT-124 / CLIENT-109 phase 映射）。 */
export const MILITARY_LIST_PHASE_CHIP_ORDER: readonly MilitaryListPhaseFilter[] = [
  "all",
  "pending",
  "outbound",
  "stationed",
  "return",
];

export type MilitaryListPhaseChipEvent =
  | { type: "select"; phase: MilitaryListPhaseFilter }
  | { type: "restore"; filter: MilitaryListFilterV1 };

/**
 * 军情阶段 chip 纯函数状态机：再次点选当前阶段（非「全部」）回到「全部」；ETA 排序字段不变。
 */
export function militaryListPhaseChipReducer(
  state: MilitaryListFilterV1,
  event: MilitaryListPhaseChipEvent,
): MilitaryListFilterV1 {
  switch (event.type) {
    case "restore":
      return event.filter;
    case "select": {
      const clicked = event.phase;
      if (!(MILITARY_LIST_PHASE_CHIP_ORDER as readonly string[]).includes(clicked)) {
        return state;
      }
      let nextPhase: MilitaryListPhaseFilter = clicked;
      if (clicked === state.phase && clicked !== "all") {
        nextPhase = "all";
      }
      if (nextPhase === state.phase) return state;
      return { ...state, phase: nextPhase };
    }
    default:
      return state;
  }
}

export function parseMilitaryListPhaseChipPhase(
  raw: string | null | undefined,
): MilitaryListPhaseFilter | null {
  if (raw == null || raw === "") return null;
  if ((MILITARY_LIST_PHASE_CHIP_ORDER as readonly string[]).includes(raw)) {
    return raw as MilitaryListPhaseFilter;
  }
  return null;
}

export function syncMilitaryListPhaseFilterChips(
  root: ParentNode,
  activePhase: MilitaryListPhaseFilter,
): void {
  for (const btn of Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-action="march-phase-filter-chip"]'),
  )) {
    const phase = parseMilitaryListPhaseChipPhase(btn.getAttribute("data-phase"));
    if (!phase) continue;
    const selected = phase === activePhase;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

export function ensureMarchListPhaseFilterChips(container: HTMLElement): void {
  if (container.querySelector('[data-action="march-phase-filter-chip"]')) return;
  for (const phase of MILITARY_LIST_PHASE_CHIP_ORDER) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "march-list-phase-chip-btn";
    btn.setAttribute("data-ui-filter-chip", "");
    btn.setAttribute("data-action", "march-phase-filter-chip");
    btn.setAttribute("data-phase", phase);
    btn.textContent = militaryListPhaseFilterLabel(phase);
    container.appendChild(btn);
  }
}
