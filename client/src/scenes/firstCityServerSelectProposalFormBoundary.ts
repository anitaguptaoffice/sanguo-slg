import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityProposalFormInput = Readonly<{
  name: string;
  x: number;
  y: number;
}>;

export type FirstCityProposalFormBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      commandId: string;
      headName: string;
      headX: number;
      headY: number;
      formName: string;
      formX: number;
      formY: number;
      state: "pending" | "succeeded" | "rejected";
    }>;

function proposalFieldsMatch(
  proposal: Readonly<{ name: string; x: number; y: number }>,
  form: FirstCityProposalFormInput,
): boolean {
  return proposal.name === form.name && proposal.x === form.x && proposal.y === form.y;
}

/** When durable head is command, Continue uses head proposal — not the editable form (§5.6 / wire §5). */
export function resolveFirstCityProposalFormBoundaryView(
  knowledge: FirstCityKnowledge | null,
  form: FirstCityProposalFormInput | null,
  staleActor = false,
): FirstCityProposalFormBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty" || !form) return { kind: "none" };
  const proposal = knowledge.head.record.intent.proposal;
  if (proposalFieldsMatch(proposal, form)) return { kind: "none" };
  return {
    kind: "mismatch",
    commandId: proposal.commandId,
    headName: proposal.name,
    headX: proposal.x,
    headY: proposal.y,
    formName: form.name,
    formX: form.x,
    formY: form.y,
    state: knowledge.head.record.state.kind,
  };
}

export function formatFirstCityProposalFormBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  form: FirstCityProposalFormInput | null,
  staleActor = false,
): string {
  const view = resolveFirstCityProposalFormBoundaryView(knowledge, form, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "提案表单边界（只读）：证据冲突或不可用，暂不对比表单与规范 head；" +
        "不得以表单内容替代规范胜者或自动 Continue。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "提案表单边界（只读）：证据不完整，暂不对比表单与规范 head；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const formLabel = `${view.formName} (${view.formX},${view.formY})`;
  return (
    `提案表单边界（只读）：规范 head ${view.commandId} · ${view.state} 为 ${headLabel}；` +
    `当前表单为 ${formLabel}。V2 Continue 仅发送 head proposal，不以表单为准；` +
    "不得以表单或 loser 草案套用规范胜者。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}