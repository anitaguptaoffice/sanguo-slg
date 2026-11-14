import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  authenticatedIdentityMatchesKnowledge,
  bindFirstCityActor,
  firstCityActorBindingDrifted,
  firstCityKnowledgeOwnsCommandId,
  firstCitySessionActorDrifted,
} from "./firstCityServerSelectActor";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const knowledge = () => createFirstCityKnowledge(scope);

it("detects login and server drift against binding", () => {
  const binding = bindFirstCityActor("alice", 1, 3, knowledge());
  expect(firstCityActorBindingDrifted(binding, knowledge(), "alice", 1, 3)).toBe(false);
  expect(firstCityActorBindingDrifted(binding, knowledge(), "bob", 1, 3)).toBe(true);
  expect(firstCityActorBindingDrifted(binding, knowledge(), "alice", 2, 3)).toBe(true);
  expect(firstCityActorBindingDrifted(binding, knowledge(), "alice", 1, 4)).toBe(true);
  expect(firstCityActorBindingDrifted(null, knowledge(), "alice", 1, 3)).toBe(true);
});

it("requires commandId ownership in local knowledge", () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const empty = knowledge();
  expect(firstCityKnowledgeOwnsCommandId(empty, id)).toBe(false);
  const intent = createFirstCityIntent(scope, { commandId: id, predecessor: { kind: "empty" }, name: "城", x: 1, y: 2 });
  const withIntent = { ...empty, intents: Object.freeze([intent]) };
  expect(firstCityKnowledgeOwnsCommandId(withIntent, id)).toBe(true);
  expect(firstCityKnowledgeOwnsCommandId(withIntent, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBe(false);
});

it("matches authenticated identity to knowledge scope", () => {
  const identity = { accountId: "44", serverId: 1, playerId: 7, generation: 2 };
  expect(authenticatedIdentityMatchesKnowledge(identity, knowledge(), 2)).toBe(true);
  expect(authenticatedIdentityMatchesKnowledge({ ...identity, playerId: 8 }, knowledge(), 2)).toBe(false);
  expect(authenticatedIdentityMatchesKnowledge({ ...identity, accountId: "45" }, knowledge(), 2)).toBe(false);
  expect(authenticatedIdentityMatchesKnowledge(identity, knowledge(), 3)).toBe(false);
});

it("detects post-enter session actor drift", () => {
  const gateway = {
    getAuthenticatedIdentity: () => ({ accountId: "44", serverId: 1, playerId: 7, generation: 2 }),
    getBoundServerId: () => 1,
  };
  expect(firstCitySessionActorDrifted(gateway, knowledge(), 2)).toBe(false);
  expect(firstCitySessionActorDrifted({
    getAuthenticatedIdentity: () => ({ accountId: "44", serverId: 1, playerId: 99, generation: 2 }),
    getBoundServerId: () => 1,
  }, knowledge(), 2)).toBe(true);
  expect(firstCitySessionActorDrifted({ getAuthenticatedIdentity: () => null }, knowledge(), 2)).toBe(true);
});
