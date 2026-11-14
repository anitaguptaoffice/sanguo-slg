import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityGetCommandIdLocalIntentBoundaryView =
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

/** GetResult fc-command-id suggestion follows suggestFirstCityResultCommandId — not journal's latest alone (§5.2–§5.6 / §10.6 / wire §5). */
export function resolveFirstCityGetCommandIdLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityGetCommandIdLocalIntentBoundaryView {
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

export function formatFirstCityGetCommandIdLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityGetCommandIdLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Get commandId·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 fc-command-id 建议；" +
        "不得以 journal 保留 commandId 替代 durable head 下的默认查找 ID。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Get commandId·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 fc-command-id 建议；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Get commandId·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState} 为 ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "fc-command-id 建议/预填源自 suggestFirstCityResultCommandId（**durable head=command 时仅取 head commandId**；" +
    "head 非 command 时才回退 journal 最近 intent 或 records）：不以 journal 最近保留 intent 推断 command head 下的默认查找 ID 或 V2 GetResult 身份权威；" +
    "勿把未胜出 journal 草案 commandId 误当作 head 下预填目标。GetResult 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}