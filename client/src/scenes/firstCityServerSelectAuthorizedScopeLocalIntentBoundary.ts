import type { FirstCityIntent, FirstCityScope } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityAuthorizedScopeLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "none" }
  | Readonly<{
      kind: "mismatch";
      scope: FirstCityScope;
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

function formatScopeFields(scope: FirstCityScope): string {
  return `realm=${scope.realmId} shard=${scope.shard} playerId=${scope.playerId} accountId=${scope.accountId}`;
}

/** Authorized scope display follows Discover knowledge.scope — not journal's latest alone (§3 / §4 / §10.6 / wire §2). */
export function resolveFirstCityAuthorizedScopeLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityAuthorizedScopeLocalIntentBoundaryView {
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
    scope: knowledge.scope,
    headCommandId: headProposal.commandId,
    headState: knowledge.head.record.state.kind,
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
  };
}

export function formatFirstCityAuthorizedScopeLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityAuthorizedScopeLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return (
        "授权作用域·本地 intent 边界（只读）：证据冲突或不可用，暂不对比 journal 最近保留 intent 与 Discover scope；" +
        "不得以 journal 草案的 actor 假设替代 server-derived expectedScope 权威。未进入主城。"
      );
    }
    if (view.reason === "incomplete") {
      return (
        "授权作用域·本地 intent 边界（只读）：证据不完整，暂不对比 journal 与 Discover scope；" +
        "须保留本地记录并显式 Discover/GetResult。未进入主城。"
      );
    }
    return "";
  }
  if (view.kind === "none") return "";
  const scopeLabel = formatScopeFields(view.scope);
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  return (
    `授权作用域·本地 intent 边界（只读）：规范 head ${view.headCommandId} · ${view.headState}；` +
    `Discover scope ${scopeLabel}；journal 最近保留 intent ${view.localCommandId} · ${localLabel}。` +
    "scope 展示源自 resolveFirstCityAuthorizedScopeView（Discover 固定的 knowledge.scope），" +
    "不以 journal 最近保留 intent 为准；Submit/Continue/Get 的 expectedScope 须与此 realm/shard/player/account 一致，" +
    "勿把未胜出 journal 草案误当作授权作用域权威或替代 stale-actor 隔离读回。Continue/Submit 须显式点击。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}