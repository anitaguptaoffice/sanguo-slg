import { describe, expect, it } from "vitest";
import { createFirstCityIntent, type FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge, reduceFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityAuthorizedScopePanel,
  resolveFirstCityAuthorizedScopeView,
} from "./firstCityServerSelectAuthorizedScope";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};

const empty = () => createFirstCityKnowledge(scope);

function withEmptyHead() {
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  return reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
}

it("shows authorized scope after complete discovery", () => {
  const knowledge = withEmptyHead();
  const view = resolveFirstCityAuthorizedScopeView(knowledge);
  expect(view).toEqual({ kind: "scope", scope });
  expect(formatFirstCityAuthorizedScopePanel(knowledge)).toMatch(/realm=11111111/);
  expect(formatFirstCityAuthorizedScopePanel(knowledge)).toMatch(/playerId=7/);
  expect(formatFirstCityAuthorizedScopePanel(knowledge)).toMatch(/accountId=44/);
  expect(formatFirstCityAuthorizedScopePanel(knowledge)).toMatch(/expectedScope/);
});

it("withholds without knowledge, on stale-actor, unavailable, and incomplete", () => {
  expect(formatFirstCityAuthorizedScopePanel(null)).toBe("");
  expect(formatFirstCityAuthorizedScopePanel(withEmptyHead(), true)).toBe("");
  expect(formatFirstCityAuthorizedScopePanel({ ...withEmptyHead(), unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityAuthorizedScopePanel({ ...withEmptyHead(), incomplete: true })).toMatch(/不完整/);
  expect(formatFirstCityAuthorizedScopePanel({ ...withEmptyHead(), head: null })).toMatch(/不完整/);
});

it("still shows scope when durable head is non-empty", () => {
  const commandId = "22222222-2222-4222-8222-222222222222";
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "城",
    x: 0,
    y: 1,
  });
  const record = { intent, template, state: { kind: "pending" as const } };
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record } };
  const knowledge = reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
  expect(resolveFirstCityAuthorizedScopeView(knowledge).kind).toBe("scope");
  expect(formatFirstCityAuthorizedScopePanel(knowledge)).toMatch(/shard=1/);
});
