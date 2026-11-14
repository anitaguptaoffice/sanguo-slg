import type { FirstCityScope } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityAuthorizedScopeView =
  | { kind: "withheld"; reason: "no-knowledge" | "stale-actor" | "unavailable" | "incomplete" }
  | { kind: "scope"; scope: FirstCityScope };

function formatScopeFields(scope: FirstCityScope): string {
  return `realm=${scope.realmId} shard=${scope.shard} playerId=${scope.playerId} accountId=${scope.accountId}`;
}

/** Server-derived authorized scope from Discover; distinct from outcome rows and stale-actor notice text. */
export function resolveFirstCityAuthorizedScopeView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityAuthorizedScopeView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (staleActor) return { kind: "withheld", reason: "stale-actor" };
  if (knowledge.unavailable) return { kind: "withheld", reason: "unavailable" };
  if (knowledge.incomplete || knowledge.head === null) return { kind: "withheld", reason: "incomplete" };
  return { kind: "scope", scope: knowledge.scope };
}

export function formatFirstCityAuthorizedScopePanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityAuthorizedScopeView(knowledge, staleActor);
  if (view.kind === "withheld") {
    if (view.reason === "no-knowledge" || view.reason === "stale-actor") return "";
    if (view.reason === "unavailable") {
      return "授权作用域（只读）：证据冲突或不可用，暂不展示 Discover 绑定 scope；不得跨 actor 读回或自动 Submit/Continue。未进入主城。";
    }
    if (view.reason === "incomplete") {
      return "授权作用域（只读）：证据不完整，暂不认定 server-derived scope；须保留本地记录并显式 Discover。未进入主城。";
    }
    return "";
  }
  return (
    `授权作用域（只读）：${formatScopeFields(view.scope)}。` +
    "Submit/Continue/Get 的 expectedScope 须与此一致；scope 不授予执行或进主城。Continue/Submit 须显式点击。不宣称可玩首城或生产验收已完成。"
  );
}
