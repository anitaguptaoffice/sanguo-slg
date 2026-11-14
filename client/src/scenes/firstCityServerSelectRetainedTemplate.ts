import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityRecord } from "@/net/firstCityResponseCodec";

export type FirstCityRetainedTemplateRef = FirstCityRecord["template"];

export type FirstCityRetainedTemplateView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{ kind: "template"; commandId: string; template: FirstCityRetainedTemplateRef }>;

function formatTemplateRef(template: FirstCityRetainedTemplateRef): string {
  return (
    `templateVersion=${template.templateVersion} rulesVersion=${template.rulesVersion} ` +
    `catalogVersion=${template.catalogVersion} encoding=${template.contentEncodingVersion} ` +
    `sha256=${template.contentSha256}`
  );
}

/** Durable head immutable TemplateRef; distinct from proposal/intake/receipt rows (FIRST-CITY-WIRE.md §4). */
export function resolveFirstCityRetainedTemplateView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityRetainedTemplateView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind === "empty") return { kind: "none" };
  const { record } = knowledge.head;
  return {
    kind: "template",
    commandId: record.intent.proposal.commandId,
    template: record.template,
  };
}

export function formatFirstCityRetainedTemplatePanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityRetainedTemplateView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "保留模板（只读）：证据冲突或不可用，暂不展示 durable head 的 TemplateRef；不得用当前发行版替换或推断执行。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "保留模板（只读）：证据不完整，暂不展示 server 接收时冻结的模板快照；须保留本地记录并显式 Discover/GetResult。未进入主城。";
    }
    return "";
  }
  if (view.kind === "none") return "";
  return (
    `保留模板（只读）：head ${view.commandId} · ${formatTemplateRef(view.template)}。` +
    "非调用方意图；重复 Submit/Continue 须与此快照一致，不可用当前配置替换。不授予执行或进主城。不宣称可玩首城或生产验收已完成。"
  );
}
