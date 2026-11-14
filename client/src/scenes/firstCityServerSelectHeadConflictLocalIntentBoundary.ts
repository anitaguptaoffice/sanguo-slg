import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityHeadConflictLocalIntentBoundaryView =
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

/** HEAD_CONFLICT intake follows retained observations — not journal's latest alone (§5 / §10.6 / wire §5). */
export function resolveFirstCityHeadConflictLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityHeadConflictLocalIntentBoundaryView {
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

export function formatFirstCityHeadConflictLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityHeadConflictLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "HEAD_CONFLICT·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 head；" +
        "不得以 journal 草案定义 HEAD_CONFLICT 摄入展示权威。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "HEAD_CONFLICT·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 head；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `HEAD_CONFLICT·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState} 为 ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "HEAD_CONFLICT 摄入源自 retained Submit/Continue 的 headConflict observations（collectHeadConflicts），" +
    "展示各请求的 actual durable head，不以 journal 最近保留 intent 为准；§5.2 仍须保留已知本地 ID/内容，" +
    "勿把未胜出 journal 草案误当作 HEAD_CONFLICT 摄入权威或替代 discovery head。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}