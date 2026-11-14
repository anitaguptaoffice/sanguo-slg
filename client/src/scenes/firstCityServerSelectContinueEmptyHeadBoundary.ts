import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityContinueEmptyHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "empty-head" };

/** When durable head is EMPTY, loopback Continue stays off; PENDING head only. */
export function resolveFirstCityContinueEmptyHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityContinueEmptyHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "empty-head" };
  return { kind: "none" };
}

export function formatFirstCityContinueEmptyHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityContinueEmptyHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Continue empty-head 边界（只读）：证据冲突或不可用，暂不说明 EMPTY head 下的 Continue 门控；" +
        "不得以 Continue 发起执行或推断 competing INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Continue empty-head 边界（只读）：证据不完整，暂不说明 EMPTY head 下的 Continue 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    "Continue empty-head 边界（只读）：durable EMPTY head；本 loopback 面板不启用 V2 Continue（Continue 仅 PENDING head）。" +
    "INITIAL 须用 V2 Submit（predecessor=EMPTY，new commandId）；不得用 Continue 代替 competing INITIAL（wire §5/§6；§5.2(6)）。" +
    "见 Submit empty-head 边界行；discovery EMPTY / canonical winner 只读行不替代本门控说明。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}