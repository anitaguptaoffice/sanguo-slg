import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityProposalFormInput } from "./firstCityServerSelectProposalFormBoundary";

export type FirstCitySubmitFormLocalIdBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "new-id";
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
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

/** When durable head is EMPTY and form matches local fields, Submit still mints a new commandId (§5.2–§5.3 / wire §5). */
export function resolveFirstCitySubmitFormLocalIdBoundaryView(
  knowledge: FirstCityKnowledge | null,
  form: FirstCityProposalFormInput | null,
  staleActor = false,
): FirstCitySubmitFormLocalIdBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "empty" || !form) return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const proposal = local.proposal;
  if (!proposalFieldsMatch(proposal, form)) return { kind: "none" };
  return {
    kind: "new-id",
    localCommandId: proposal.commandId,
    localName: proposal.name,
    localX: proposal.x,
    localY: proposal.y,
  };
}

export function formatFirstCitySubmitFormLocalIdBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  form: FirstCityProposalFormInput | null,
  staleActor = false,
): string {
  const view = resolveFirstCitySubmitFormLocalIdBoundaryView(knowledge, form, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Submit commandId 边界（只读）：证据冲突或不可用，暂不说明 Submit 与 journal 保留 commandId 关系；" +
        "不得以表单等同已保留身份或自动 Submit。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Submit commandId 边界（只读）：证据不完整，暂不说明 journal 保留 commandId；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Submit commandId 边界（只读）：表单与 journal 最近保留 intent ${view.localCommandId} · ${localLabel} 字段一致。` +
    "V2 Submit 仍生成新 commandId，不以 journal 保留 commandId 为准；" +
    "§5.2 仍须保留已知本地 ID/内容，勿把表单与本地一致误解为 Submit 复用同一身份。Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}