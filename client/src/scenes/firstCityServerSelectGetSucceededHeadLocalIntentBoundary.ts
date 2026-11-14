import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityGetSucceededHeadLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "retained";
      headCommandId: string;
      headName: string;
      headX: number;
      headY: number;
      headCityId: bigint;
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Get succeeded-head gate follows resolveFirstCityGetSucceededHeadBoundaryView — not journal's latest alone (§5.2(6)–§5.2(7) / §10.6 / wire §5). */
export function resolveFirstCityGetSucceededHeadLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityGetSucceededHeadLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "command") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "succeeded") return { kind: "none" };
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
    headCityId: record.state.cityId,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityGetSucceededHeadLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityGetSucceededHeadLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Get succeeded-head·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 succeeded head GetResult 门控；" +
        "不得以 journal 保留草案替代 canonical succeeded head 下的只读 GetResult 说明或推断 competing INITIAL Submit。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Get succeeded-head·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 succeeded head GetResult 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY}) · cityId ${view.headCityId}`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Get succeeded-head·本地 intent 边界（只读）：durable head ${view.headCommandId} · succeeded · ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "V2 GetResult 只读 lookup 门控说明源自 resolveFirstCityGetSucceededHeadBoundaryView / canOfferFirstCityResult（**succeeded head 下仅对已拥有 commandId 启用显式 lookup**；" +
    "不接收、不改 head；buildGetResultRequest 不读取 journal）：不以 journal 最近保留 intent 推断 canonical succeeded head、" +
    "不据此用 GetResult 代替对 succeeded head 的 competing INITIAL Submit 或 Continue 执行。§5.2(7) 仍须保留已知本地 ID/内容。" +
    "与 #2826 Get succeeded-head 边界及 #2852 Get vs journal local-intent 互补。GetResult 须显式点击。" +
    "历史 receipt 只读，进入主城须独立 owner 校验；不宣称可玩首城或生产验收已完成。"
  );
}