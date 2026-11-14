import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitPendingHeadLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "retained";
      headCommandId: string;
      headName: string;
      headX: number;
      headY: number;
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Submit pending-head gate follows resolveFirstCitySubmitPendingHeadBoundaryView — not journal's latest alone (§5.2(6) / §10.6 / wire §5). */
export function resolveFirstCitySubmitPendingHeadLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitPendingHeadLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "command") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "pending") return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const headProposal = record.intent.proposal;
  const localProposal = local.proposal;
  return {
    kind: "retained",
    headCommandId: headProposal.commandId,
    headName: headProposal.name,
    headX: headProposal.x,
    headY: headProposal.y,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCitySubmitPendingHeadLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitPendingHeadLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit pending-head·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 PENDING head Submit 门控；" +
        "不得以 journal 保留草案替代 canonical pending head 下的 Submit 说明或推断 INITIAL 载荷。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit pending-head·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 PENDING head Submit 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Submit pending-head·本地 intent 边界（只读）：durable head ${view.headCommandId} · pending · ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "V2 Submit 门控说明源自 resolveFirstCitySubmitPendingHeadBoundaryView / canOfferFirstCitySubmit（**仅 durable EMPTY head 启用 INITIAL Submit**；" +
    "PENDING head 下不得 competing EMPTY INITIAL；buildSubmitRequest 不读取 journal）：" +
    "不以 journal 最近保留 intent 推断 canonical pending head、" +
    "不据此把 journal 草案当作 Submit 载荷或代替 V2 Continue。§5.2 仍须保留已知本地 ID/内容。" +
    "与 #2781 Submit pending-head 边界及 #2861 Submit vs journal local-intent 互补。Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}