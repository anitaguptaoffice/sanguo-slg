import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitCommandIdLocalIntentBoundaryView =
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

/** Submit payload commandId follows buildSubmitRequest — not journal's latest alone (§5.2–§5.3 / §10.6 / wire §3). */
export function resolveFirstCitySubmitCommandIdLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitCommandIdLocalIntentBoundaryView {
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

export function formatFirstCitySubmitCommandIdLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitCommandIdLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit commandId·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 Submit 载荷 commandId；" +
        "不得以 journal 保留 commandId 替代 durable empty head 下的 V2 Submit 身份。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit commandId·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 Submit 载荷 commandId；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Submit commandId·本地 intent 边界（只读）：durable head 为 empty；journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "V2 Submit 载荷 commandId 源自 buildSubmitRequest（**canOfferFirstCitySubmit 仅在 empty head；每次 Submit 生成新 commandId**；" +
    "wire §3 须使用加密 RNG，不复用 journal 或不确定 ID）：不以 journal 最近保留 intent 的 commandId 推断 Submit 载荷身份或复用该 ID；" +
    "§5.2 仍须保留已知本地 ID/内容。与 #2765 表单字段一致边界互补。Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}