import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoverLocalIntentBoundaryView =
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

/** When durable head is command, Discover refreshes authoritative head — not journal's latest local intent (§5.2 / wire §2). */
export function resolveFirstCityDiscoverLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoverLocalIntentBoundaryView {
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

export function formatFirstCityDiscoverLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoverLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Discover 本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 head；" +
        "不得以本地草案替代规范 head 或自动 Discover。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Discover 本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 head；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Discover 本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState} 为 ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "V2 DiscoverFirstCityIntent 仅为只读权威 actor/head 刷新；command head 时以服务端返回 head 为准，不以 journal 最近保留 intent 为准；" +
    "§5.2 仍须保留已知本地 ID/内容，勿把未胜出 journal 草案当作 Discover 权威 head 或代替 Continue/Submit。Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}