import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitEmptyHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "empty-head" };

/** When durable head is EMPTY, loopback Submit is offered; mint fresh commandId with EMPTY predecessor only. */
export function resolveFirstCitySubmitEmptyHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitEmptyHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "empty-head" };
  return { kind: "none" };
}

export function formatFirstCitySubmitEmptyHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitEmptyHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit empty-head 边界（只读）：证据冲突或不可用，暂不说明 EMPTY head 下的 Submit 门控；" +
        "不得以表单自动 Submit 或推断 competing INITIAL。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit empty-head 边界（只读）：证据不完整，暂不说明 EMPTY head 下的 Submit 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    "Submit empty-head 边界（只读）：durable EMPTY head；本 loopback 面板在此启用 V2 Submit（predecessor=EMPTY，" +
    "new commandId）。Continue 仍仅 PENDING head；不得用 Continue 代替 INITIAL Submit（wire §5/§6；§5.2(6)）。" +
    "Discovery EMPTY / canonical winner 只读行不替代本门控说明。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}