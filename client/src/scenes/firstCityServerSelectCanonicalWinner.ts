import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityCanonicalWinnerView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" | "indeterminate" }
  | { kind: "empty-head" }
  | Readonly<{
      kind: "command";
      commandId: string;
      name: string;
      x: number;
      y: number;
      state: "pending" | "succeeded" | "rejected";
    }>;

export function resolveFirstCityCanonicalWinnerView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityCanonicalWinnerView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "empty-head" };
  const record = knowledge.head.record;
  const state = record.state.kind;
  return {
    kind: "command",
    commandId: record.intent.proposal.commandId,
    name: record.intent.proposal.name,
    x: record.intent.proposal.x,
    y: record.intent.proposal.y,
    state,
  };
}

/** Read-only panel copy from reducer head; never promotes local-only or losing intents to canonical winner. */
export function formatFirstCityCanonicalWinnerPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityCanonicalWinnerView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "规范胜者（只读）：本地证据冲突或不可用，不得将冲突/他者/过期提案当作当前有效胜者。未进入主城，不宣称可玩首城。";
    }
    if (view.reason === "incomplete" || view.reason === "indeterminate") {
      return "规范胜者（只读）：证据不完整，当前无可认定的有效胜者；不得静默改写。未进入主城。";
    }
  }
  if (view.kind === "empty-head") {
    return "规范胜者（只读）：durable head 为空；当前无 command 胜者。EMPTY 不等于可自动建城或进主城。";
  }
  if (view.kind === "command") {
    return (
      `规范胜者（只读）：${view.commandId} · ${view.name} (${view.x},${view.y}) · ${view.state}。` +
      "本地未胜出的提案不视为当前胜者；Continue 须显式点击。不宣称可玩首城或生产验收已完成。"
    );
  }
  return "";
}
