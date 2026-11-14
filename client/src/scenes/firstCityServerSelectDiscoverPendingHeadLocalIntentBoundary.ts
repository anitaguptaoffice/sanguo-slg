import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoverPendingHeadLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "retained";
      headCommandId: string;
      headName: string;
      headX: number;
      headY: number;
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Discover pending-head gate follows resolveFirstCityDiscoverPendingHeadBoundaryView — not journal's latest alone (§5.2(6) / §10.6 / wire §2). */
export function resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoverPendingHeadLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "command") return { kind: "none" };
  const record = knowledge.head.record;
  if (record.state.kind !== "pending") return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const headProposal = record.intent.proposal;
  const localProposal = local.proposal;
  return {
    kind: "retained",
    headCommandId: headProposal.commandId,
    headName: headProposal.name,
    headX: headProposal.x,
    headY: headProposal.y,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityDiscoverPendingHeadLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "Discover pending-head·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 PENDING head Discover 门控；" +
        "不得以 journal 保留草案替代 canonical pending head 下的只读 Discover 说明或推断 Continue 路径。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "Discover pending-head·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 PENDING head Discover 门控；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const headLabel = `${view.headName} (${view.headX},${view.headY})`;
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `Discover pending-head·本地 intent 边界（只读）：durable head ${view.headCommandId} · pending · ${headLabel}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "Discover 门控说明源自 resolveFirstCityDiscoverPendingHeadBoundaryView（**PENDING head 下 DiscoverFirstCityIntent 仅为只读权威刷新**；" +
    "不接收、不执行、不改 head）：不以 journal 最近保留 intent 推断 canonical pending head、" +
    "不据此用重复 Discover 代替对 canonical winner 的 V2 Continue 或 competing EMPTY Submit。§5.2 仍须保留已知本地 ID/内容。" +
    "与 #2828 Discover pending-head 边界及 #2852 Discover vs journal local-intent 互补。Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}