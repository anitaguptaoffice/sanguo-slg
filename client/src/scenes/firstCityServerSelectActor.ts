import type { FirstCityScope } from "@/net/firstCityCanonical";
import type { AuthenticatedIdentity } from "@/net/authenticatedIdentity";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import { firstCityUnknown } from "@/net/firstCityPacket";
import type { FirstCityProbeGateway } from "./firstCityServerSelectEntry";

export type FirstCityIdentityGateway = FirstCityProbeGateway & Readonly<{
  getAuthenticatedIdentity?(): AuthenticatedIdentity | null;
  getSessionGeneration?(): number;
  getBoundServerId?(): number;
}>;

export type FirstCityActorBinding = Readonly<{
  login: string;
  serverId: number;
  sessionGeneration: number | undefined;
  scopeStamp: string;
}>;

export const FIRST_CITY_STALE_ACTOR_NOTICE =
  "首城 stale-actor：账户或会话 binding/generation 已变更，与本地 commandId/knowledge 所属 actor 不一致。" +
  "不得沿用他者或过期证据；请重新显式 login→enter 后再 Discover。未调用 v1 建城，未进入主城，亦不宣称可玩首城。";

export function stampFirstCityScope(scope: FirstCityScope): string {
  return JSON.stringify(scope, (_, value) => typeof value === "bigint" ? String(value) : value);
}

export function bindFirstCityActor(
  login: string,
  serverId: number,
  sessionGeneration: number | undefined,
  knowledge: FirstCityKnowledge,
): FirstCityActorBinding {
  return Object.freeze({
    login: login.trim(),
    serverId,
    sessionGeneration,
    scopeStamp: stampFirstCityScope(knowledge.scope),
  });
}

export function firstCityKnowledgeOwnsCommandId(knowledge: FirstCityKnowledge, commandId: string): boolean {
  const id = commandId.trim();
  if (knowledge.intents.some(intent => intent.proposal.commandId === id)) return true;
  if (knowledge.records.some(record => record.intent.proposal.commandId === id)) return true;
  return knowledge.observations.some(value => value.kind !== "discovery" && value.requestedCommandId === id);
}

export function authenticatedIdentityMatchesKnowledge(
  identity: AuthenticatedIdentity | null | undefined,
  knowledge: FirstCityKnowledge,
  sessionGeneration?: number,
): boolean {
  if (!identity) return false;
  if (sessionGeneration !== undefined && identity.generation !== sessionGeneration) return false;
  if (identity.serverId !== knowledge.scope.shard) return false;
  if (identity.accountId !== String(knowledge.scope.accountId)) return false;
  return identity.playerId === Number(knowledge.scope.playerId);
}

/** UI-time drift: login/server/generation/scope stamp before any new login→enter. */
export function firstCityActorBindingDrifted(
  binding: FirstCityActorBinding | null,
  knowledge: FirstCityKnowledge | null,
  login: string,
  serverId: number,
  sessionGeneration: number | undefined,
): boolean {
  if (!knowledge) return false;
  if (!binding) return true;
  if (binding.login !== login.trim()) return true;
  if (binding.serverId !== serverId || knowledge.scope.shard !== serverId) return true;
  if (binding.scopeStamp !== stampFirstCityScope(knowledge.scope)) return true;
  if (binding.sessionGeneration !== undefined && sessionGeneration !== undefined &&
    binding.sessionGeneration !== sessionGeneration) return true;
  return false;
}

/** Post enterGameServer: session actor must match retained knowledge scope. */
export function firstCitySessionActorDrifted(
  gateway: FirstCityIdentityGateway,
  knowledge: FirstCityKnowledge,
  sessionGeneration?: number,
): boolean {
  const identity = gateway.getAuthenticatedIdentity?.();
  if (!identity) return true;
  if (!authenticatedIdentityMatchesKnowledge(identity, knowledge, sessionGeneration)) return true;
  const bound = gateway.getBoundServerId?.();
  if (bound !== undefined && bound !== knowledge.scope.shard) return true;
  return false;
}

export function assertFirstCityActorFresh(
  gateway: FirstCityIdentityGateway,
  binding: FirstCityActorBinding | null,
  knowledge: FirstCityKnowledge,
  login: string,
  serverId: number,
  sessionGeneration?: number,
): void {
  if (firstCityActorBindingDrifted(binding, knowledge, login, serverId, sessionGeneration) ||
    firstCitySessionActorDrifted(gateway, knowledge, sessionGeneration ?? gateway.getSessionGeneration?.())) {
    throw firstCityUnknown();
  }
}
