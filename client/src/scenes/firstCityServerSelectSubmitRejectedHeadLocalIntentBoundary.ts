import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitRejectedHeadLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "retained";
      headCommandId: string;
      headName: string;
      headX: number;
      headY: number;
      headReason: "terrain" | "coordinateOccupied";
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Submit rejected-head gate follows resolveFirstCitySubmitRejectedHeadBoundaryView — not journal's latest alone (§5.2(6)–§5.2(7) / §10.6 / wire §3/§5). */
export function resolveFirstCitySubmitRejectedHeadLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitRejectedHeadLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "command") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "rejected") return { kind: "none" };
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
    headReason: record.state.reason,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCitySubmitRejectedHeadLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitRejectedHeadLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit rejected-head·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 rejected head Submit 门控；" +
        "不得以 journal 保留草案替代 canonical rejected head 下的 Submit 说明或推断后继 predecessor。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit rejected-head·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 rejected head Submit 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY}) · ${view.headReason}`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Submit rejected-head·本地 intent 边界（只读）：durable head ${view.headCommandId} · rejected · ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "V2 Submit 门控说明源自 resolveFirstCitySubmitRejectedHeadBoundaryView / canOfferFirstCitySubmit（**rejected head 下本面板不启用 V2 Submit**；" +
    `后继显式 INITIAL 须 new commandId 且 predecessor=rejected ${view.headCommandId}；buildSubmitRequest 不读取 journal）：` +
    "不以 journal 最近保留 intent 推断 canonical rejected head、" +
    "不据此把 journal 草案当作 Submit 载荷或绕过 exact rejected predecessor。§5.2 仍须保留已知本地 ID/内容。" +
    "与 #2771 Submit rejected-head 边界及 #2861 Submit vs journal local-intent 互补。Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}