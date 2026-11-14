import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityDiscoveryEmptyLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Actor discovery EMPTY display follows durable empty head — not journal's latest alone (§4 / §5.2(2) / §10.6). */
export function resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityDiscoveryEmptyLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  if (knowledge.head.kind !== "empty") return { kind: "none" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const localProposal = local.proposal;
  return {
    kind: "mismatch",
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityDiscoveryEmptyLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "actor discovery EMPTY·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 EMPTY head；" +
        "不得以 journal 草案定义 actor discovery EMPTY 展示权威。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "actor discovery EMPTY·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 EMPTY head；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `actor discovery EMPTY·本地 intent 边界（只读）：durable head 为 actor discovery EMPTY；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "EMPTY 观测展示源自 Discover 响应的 durable empty head（resolveFirstCityDiscoveryEmptyView），" +
    "不以 journal 最近保留 intent 为准；§5.2(2) 仍须保留 journal 草案，" +
    "勿把未提交 journal 草案误当作 EMPTY 槽态权威或替代 discovery head。" +
    "不是 command lookup NOT_OBSERVED。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}