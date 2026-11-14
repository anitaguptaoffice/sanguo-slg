import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityPredecessor } from "@/net/firstCityCanonical";

export type FirstCityHeadPredecessorView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "predecessor";
      commandId: string;
      predecessor: FirstCityPredecessor;
      state: "pending" | "succeeded" | "rejected";
    }>;

function predecessorLabel(predecessor: FirstCityPredecessor): string {
  if (predecessor.kind === "empty") return "EMPTY";
  return `rejected ${predecessor.commandId}`;
}

/** Durable head proposal.predecessor; distinct from actor discovery EMPTY and lookup NOT_OBSERVED. */
export function resolveFirstCityHeadPredecessorView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityHeadPredecessorView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const record = knowledge.head.record;
  return {
    kind: "predecessor",
    commandId: record.intent.proposal.commandId,
    predecessor: record.intent.proposal.predecessor,
    state: record.state.kind,
  };
}

export function formatFirstCityHeadPredecessorPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityHeadPredecessorView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "head predecessor（只读）：证据冲突或不可用，暂不展示 durable head 的 predecessor；" +
        "不得推断 EMPTY 或后继 rejected 链。未自动 Submit/Continue，未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "head predecessor（只读）：证据不完整，暂不展示 durable head 的 predecessor；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const label = predecessorLabel(view.predecessor);
  const successorHint =
    view.state === "rejected"
      ? "后继 INITIAL 提案须以该 rejected head 为 exact predecessor（只读提示，本面板不启用 Submit）。"
      : "EMPTY predecessor 表示从未接收 lineage 的 INITIAL 接收臂；discovery EMPTY 与此不同。";
  return (
    `head predecessor（只读）：head ${view.commandId} · ${view.state} · predecessor=${label}。` +
    `${successorHint} Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。`
  );
}
