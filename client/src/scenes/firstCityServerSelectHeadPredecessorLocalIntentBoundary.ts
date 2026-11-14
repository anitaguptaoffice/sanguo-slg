import type { FirstCityIntent, FirstCityPredecessor } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityHeadPredecessorLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      headCommandId: string;
      headPredecessor: FirstCityPredecessor;
      headState: "pending" | "succeeded" | "rejected";
      localCommandId: string;
      localPredecessor: FirstCityPredecessor;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

function predecessorLabel(predecessor: FirstCityPredecessor): string {
  if (predecessor.kind === "empty") return "EMPTY";
  return `rejected ${predecessor.commandId}`;
}

/** Head proposal.predecessor display follows head record — not journal's latest alone (§5 / §5.2(2) / §10.6 / wire §3). */
export function resolveFirstCityHeadPredecessorLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityHeadPredecessorLocalIntentBoundaryView {
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
    headPredecessor: headProposal.predecessor,
    headState: knowledge.head.record.state.kind,
    localCommandId: localProposal.commandId,
    localPredecessor: localProposal.predecessor,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityHeadPredecessorLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityHeadPredecessorLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "head predecessor·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 head predecessor；" +
        "不得以 journal 草案的 predecessor 定义 durable head predecessor 展示权威。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "head predecessor·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 head predecessor；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headPred = predecessorLabel(view.headPredecessor);
  const localPred = predecessorLabel(view.localPredecessor);
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `head predecessor·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState} · predecessor=${headPred}；` +
    `journal 最近保留 intent ${view.localCommandId} · predecessor=${localPred} · ${localLabel}。` +
    "predecessor 展示源自 resolveFirstCityHeadPredecessorView（durable head record 的 proposal.predecessor），" +
    "不以 journal 最近保留 intent 的 predecessor 为准；§5 INITIAL 接收臂与 exact rejected predecessor 须读 durable head，" +
    "勿把未胜出 journal 草案误当作 predecessor 权威或替代 discovery head。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}