import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCitySubmitFormLocalIdLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      headCommandId: string;
      headName: string;
      headX: number;
      headY: number;
      headState: "pending" | "succeeded" | "rejected";
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Submit new commandId boundary display follows EMPTY-head field-match rule — not journal's latest alone (§5.2–§5.3 / §10.6 / wire §5). */
export function resolveFirstCitySubmitFormLocalIdLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCitySubmitFormLocalIdLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "command") return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const headProposal = knowledge.head.record.intent.proposal;
  const localProposal = local.proposal;
  if (localProposal.commandId === headProposal.commandId) return { kind: "none" };
  return {
    kind: "mismatch",
    headCommandId: headProposal.commandId,
    headName: headProposal.name,
    headX: headProposal.x,
    headY: headProposal.y,
    headState: knowledge.head.record.state.kind,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCitySubmitFormLocalIdLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitFormLocalIdLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit commandId·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 Submit 新 commandId 边界；" +
        "不得以 journal 保留 commandId 替代 durable head 下的 Submit 身份说明。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit commandId·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 Submit commandId 边界；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Submit commandId·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState} 为 ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "Submit 新 commandId 边界展示源自 resolveFirstCitySubmitFormLocalIdBoundaryView（**仅在 durable head=empty 且 fc-name/x/y 与 journal 字段一致** 时说明仍生成新 commandId；" +
    "当前 head 为 command，基行不展示）：不以 journal 最近保留 intent 推断 command head 下的 commandId 边界或 V2 Submit 身份权威；" +
    "勿把未胜出 journal 草案 commandId 误当作 Submit 载荷身份。EMPTY head 下 V2 Submit 仍生成新 commandId。Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}