import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityLegacyRouteLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      headCommandId: string;
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

/** Legacy route boundary display follows wire §1 — not journal's latest alone (§10.6 / FIRST-CITY-WIRE.md §1). */
export function resolveFirstCityLegacyRouteLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityLegacyRouteLocalIntentBoundaryView {
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
    headState: knowledge.head.record.state.kind,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityLegacyRouteLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityLegacyRouteLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "legacy 路由·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 legacy 路由边界；" +
        "不得以 journal 草案假设 v1/v2 回落策略。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "legacy 路由·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 legacy 路由边界；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `legacy 路由·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "legacy 路由边界展示源自 resolveFirstCityLegacyRouteBoundaryView（wire §1 / loopback 门控）：" +
    "world.v1 CreateCity 与 world.v2 四路由独立保留，V2 失败/未知不得回落 v1 建城，" +
    "不以 journal 最近保留 intent 推断可回落 legacy 或登录/进入触发创建；" +
    "勿把未胜出 journal 草案误当作 v1 回落权威。Continue/Submit/Get/Discover 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}