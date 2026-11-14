import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityCanonicalWinnerLocalIntentBoundaryView =
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

/** Canonical winner display follows durable head only — not journal's latest local intent (§5.2 / §10.6). */
export function resolveFirstCityCanonicalWinnerLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityCanonicalWinnerLocalIntentBoundaryView {
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

export function formatFirstCityCanonicalWinnerLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityCanonicalWinnerLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "规范胜者·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 head；" +
        "不得以 journal 草案展示为规范胜者。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "规范胜者·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 head；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `规范胜者·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState} 为 ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "规范胜者展示仅源自 durable head（reduceFirstCityKnowledge），不以 journal 最近保留 intent 为准；" +
    "§5.2 仍须保留已知本地 ID/内容，勿把未胜出 journal 草案当作规范胜者或替代 Continue/Submit。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}