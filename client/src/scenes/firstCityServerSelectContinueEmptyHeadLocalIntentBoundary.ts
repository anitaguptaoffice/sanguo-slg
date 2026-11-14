import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityContinueEmptyHeadLocalIntentBoundaryView =
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

/** Continue empty-head gate follows resolveFirstCityContinueEmptyHeadBoundaryView — not journal's latest alone (§5.2(6) / §10.6 / wire §5). */
export function resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityContinueEmptyHeadLocalIntentBoundaryView {
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

export function formatFirstCityContinueEmptyHeadLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Continue empty-head·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 EMPTY head Continue 门控；" +
        "不得以 journal 保留草案替代 durable empty head 下的 V2 Continue 关闭说明或推断可 Continue。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Continue empty-head·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 EMPTY head Continue 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Continue empty-head·本地 intent 边界（只读）：durable head 为 empty；journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "V2 Continue 关闭门控说明源自 resolveFirstCityContinueEmptyHeadBoundaryView / canOfferFirstCityContinue（**durable empty head 下 Continue 不启用**；" +
    "实际 Continue 仍仅 PENDING command head；INITIAL 须 V2 Submit）：不以 journal 最近保留 intent 推断 durable head 非 empty、" +
    "不据此启用 Continue 或以 Continue 代替 competing INITIAL Submit。§5.2 仍须保留已知本地 ID/内容。" +
    "与 #2803 Continue empty-head 边界及 #2961 Continue commandId 边界互补。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}