import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoverEmptyHeadBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "empty-head" };

/** When durable head is EMPTY, loopback Discover remains read-only actor refresh only. */
export function resolveFirstCityDiscoverEmptyHeadBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoverEmptyHeadBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "empty-head" };
  return { kind: "none" };
}

export function formatFirstCityDiscoverEmptyHeadBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoverEmptyHeadBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Discover empty-head 边界（只读）：证据冲突或不可用，暂不说明 EMPTY head 下的 Discover 门控；" +
        "不得以重复 Discover 代替 INITIAL Submit 或推断 competing lineage。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Discover empty-head 边界（只读）：证据不完整，暂不说明 EMPTY head 下的 Discover 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    "Discover empty-head 边界（只读）：durable EMPTY head；本 loopback 面板 DiscoverFirstCityIntent 仅为只读权威刷新" +
    "（返回 scope/head 视图，不接收、不执行、不改 head）。" +
    "不得用重复 Discover 代替 V2 Submit（predecessor=EMPTY，new commandId）或 PENDING-only Continue（wire §5/§6；§5.2(6)）。" +
    "见 Submit/Continue/Get empty-head 边界行；actor discovery EMPTY 观测行不替代本门控说明。Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}