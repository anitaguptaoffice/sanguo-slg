import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityGetEmptyHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "empty-head" };

/** When durable head is EMPTY, loopback GetResult is read-only lookup by owned commandId only. */
export function resolveFirstCityGetEmptyHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityGetEmptyHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "empty-head" };
  return { kind: "none" };
}

export function formatFirstCityGetEmptyHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityGetEmptyHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Get empty-head 边界（只读）：证据冲突或不可用，暂不说明 EMPTY head 下的 GetResult 门控；" +
        "不得以 GetResult 推断 competing INITIAL 或推进 head。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Get empty-head 边界（只读）：证据不完整，暂不说明 EMPTY head 下的 GetResult 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    "Get empty-head 边界（只读）：durable EMPTY head；本 loopback 面板仅对已保留/本地拥有的 commandId 启用显式 V2 GetResult" +
    "（只读，返回 COMMAND 或 NOT_OBSERVED，不接收、不改 head）。INITIAL 须 V2 Submit（predecessor=EMPTY）；" +
    "不得用 GetResult 代替 Submit 或 Continue（wire §5/§6；§5.2(6)）。" +
    "见 Submit/Continue empty-head 边界行；NOT_OBSERVED 只读行不替代本门控说明。GetResult 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}