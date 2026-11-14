import type { FirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";

export type FirstCityStaleActorLocalIntentBoundaryView =
  | { kind: "withheld"; reason: "no-knowledge" | "not-stale" }
  | { kind: "none" }
  | Readonly<{
      kind: "retained";
      localCommandId: string;
      localName: string;
      localX: number;
      localY: number;
      headCommandId: string | null;
      headState: "empty" | "pending" | "succeeded" | "rejected";
    }>;

function latestLocalIntent(knowledge: FirstCityKnowledge): FirstCityIntent | null {
  const last = knowledge.intents[knowledge.intents.length - 1];
  return last ?? null;
}

/** Stale-actor isolation follows binding/session drift checks — journal latest alone cannot re-authorize (§4 / §10.6 / #2687). */
export function resolveFirstCityStaleActorLocalIntentBoundaryView(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): FirstCityStaleActorLocalIntentBoundaryView {
  if (!knowledge) return { kind: "withheld", reason: "no-knowledge" };
  if (!staleActor) return { kind: "withheld", reason: "not-stale" };
  const local = latestLocalIntent(knowledge);
  if (!local) return { kind: "none" };
  const localProposal = local.proposal;
  if (knowledge.head === null || knowledge.head.kind === "empty") {
    return {
      kind: "retained",
      localCommandId: localProposal.commandId,
      localName: localProposal.name,
      localX: localProposal.x,
      localY: localProposal.y,
      headCommandId: null,
      headState: "empty",
    };
  }
  const headProposal = knowledge.head.record.intent.proposal;
  return {
    kind: "retained",
    localCommandId: localProposal.commandId,
    localName: localProposal.name,
    localX: localProposal.x,
    localY: localProposal.y,
    headCommandId: headProposal.commandId,
    headState: knowledge.head.record.state.kind,
  };
}

export function formatFirstCityStaleActorLocalIntentBoundaryPanel(
  knowledge: FirstCityKnowledge | null,
  staleActor = false,
): string {
  const view = resolveFirstCityStaleActorLocalIntentBoundaryView(knowledge, staleActor);
  if (view.kind === "withheld" || view.kind === "none") return "";
  const localLabel = `${view.localName} (${view.localX},${view.localY})`;
  const headPart =
    view.headState === "empty"
      ? "durable head 为 EMPTY"
      : `durable head ${view.headCommandId} · ${view.headState}`;
  return (
    `stale-actor·本地 intent 边界（只读）：${headPart}；` +
    `journal 最近保留 intent ${view.localCommandId} 为 ${localLabel}。` +
    "stale-actor 门控源自 firstCityActorBindingDrifted / firstCitySessionActorDrifted（#2687）：" +
    "账户/login、shard、session generation 或 scope 与 Discover 绑定 actor 不一致时，" +
    "不得以 journal 最近保留 intent 或草案字段推断可 Submit/Continue/Get、替代 canonical head 读回或绕过隔离；" +
    "须 login→enter 后显式 Discover 再操作。与 FIRST_CITY_STALE_ACTOR_NOTICE 互补。Submit/Continue/Get 在 stale 下 fail-closed。" +
    "不宣称可玩首城或生产验收已完成。"
  );
}