import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoveryEmptyView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | { kind: "empty" };

/** Durable actor discovery EMPTY; distinct from command lookup NOT_OBSERVED and canonical winner summary. */
export function resolveFirstCityDiscoveryEmptyView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoveryEmptyView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "empty" };
  return { kind: "none" };
}

export function formatFirstCityDiscoveryEmptyPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoveryEmptyView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "actor discovery EMPTY（只读）：证据冲突或不可用，暂不展示 durable head 的空槽态；不得把 lookup NOT_OBSERVED 当作本行或自动 Submit。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "actor discovery EMPTY（只读）：证据不完整（head 未知），不等于已观测 EMPTY；须保留本地记录并显式 Discover/GetResult。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    "actor discovery EMPTY（只读）：Discover 读到 durable head 为空；不证明旧包失败，也不是按 commandId 查找的 NOT_OBSERVED。" +
    "EMPTY 不等于可自动建城、服务端已激活或已进入游戏。Submit/Continue 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
