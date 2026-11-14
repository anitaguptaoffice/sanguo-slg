import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityProposalFormInput } from "./firstCityServerSelectProposalFormBoundary";

export type FirstCitySubmitFormLocalBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      commandId: string;
      localName: string;
      localX: number;
      localY: number;
      formName: string;
      formX: number;
      formY: number;
    }>;

function proposalFieldsMatch(
  proposal: Readonly<{ name: string; x: number; y: number }>,
  form: FirstCityProposalFormInput,
): boolean {
  return proposal.name === form.name && proposal.x === form.x && proposal.y === form.y;
}

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** When durable head is EMPTY, Submit uses form + new commandId — not retained local intent (§5.2–§5.3 / wire §5). */
export function resolveFirstCitySubmitFormLocalBoundaryView(
  knowledge: FirstCityKnowledge | null,
  form: FirstCityProposalFormInput | null,
  staleActor = false,
): FirstCitySubmitFormLocalBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "empty" || !form) return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const proposal = local.proposal;
  if (proposalFieldsMatch(proposal, form)) return { kind: "none" };
  return {
    kind: "mismatch",
    commandId: proposal.commandId,
    localName: proposal.name,
    localX: proposal.x,
    localY: proposal.y,
    formName: form.name,
    formX: form.x,
    formY: form.y,
  };
}

export function formatFirstCitySubmitFormLocalBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  form: FirstCityProposalFormInput | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitFormLocalBoundaryView(knowledge, form, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit 表单边界（只读）：证据冲突或不可用，暂不对比表单与本地保留 intent；" +
        "不得以表单替代 journal 保留身份或自动 Submit。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit 表单边界（只读）：证据不完整，暂不对比表单与本地保留 intent；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  const formLabel = `${view.formName} (${view.formX},${view.formY})`;
  return (
    `Submit 表单边界（只读）：journal 最近保留 intent ${view.commandId} 为 ${localLabel}；` +
    `当前表单为 ${formLabel}。V2 Submit 以表单构造新提案并生成新 commandId，不以该本地 intent 为准；` +
    "§5.2 仍须保留已知本地 ID/内容，勿把表单草稿当作已保留身份。Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}