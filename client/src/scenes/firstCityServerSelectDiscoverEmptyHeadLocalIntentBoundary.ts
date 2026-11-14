import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoverEmptyHeadLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "retained";
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Discover empty-head gate follows resolveFirstCityDiscoverEmptyHeadBoundaryView — not journal's latest alone (§5.2(6) / §10.6 / wire §2). */
export function resolveFirstCityDiscoverEmptyHeadLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoverEmptyHeadLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "empty") return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const localProposal = local.proposal;
  return {
    kind: "retained",
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityDiscoverEmptyHeadLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoverEmptyHeadLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Discover empty-head·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 EMPTY head Discover 门控；" +
        "不得以 journal 保留草案替代 durable empty head 下的只读 Discover 说明或推断 competing lineage。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Discover empty-head·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 EMPTY head Discover 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Discover empty-head·本地 intent 边界（只读）：durable head 为 empty；journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "Discover 门控说明源自 resolveFirstCityDiscoverEmptyHeadBoundaryView（**durable EMPTY head 下 DiscoverFirstCityIntent 仅为只读权威刷新**；" +
    "不接收、不执行、不改 head）：不以 journal 最近保留 intent 推断 durable head 非 empty、" +
    "不据此用重复 Discover 代替 V2 Submit（predecessor=EMPTY）或 PENDING-only Continue。§5.2 仍须保留已知本地 ID/内容。" +
    "与 #2846 Discover empty-head 边界及 #2907 actor discovery EMPTY·本地 intent 边界互补。Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}