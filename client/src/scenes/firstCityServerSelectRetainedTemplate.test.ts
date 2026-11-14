import { describe, expect, it } from "vitest";
import { createFirstCityIntent, type FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge, reduceFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityRetainedTemplatePanel,
  resolveFirstCityRetainedTemplateView,
} from "./firstCityServerSelectRetainedTemplate";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "abcdef",
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

function withPendingHead() {
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
  return reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
}

it("shows TemplateRef from durable command head", () => {
  const knowledge = withPendingHead();
  const view = resolveFirstCityRetainedTemplateView(knowledge);
  expect(view.kind).toBe("template");
  if (view.kind !== "template") return;
  expect(view.template).toEqual(template);
  const panel = formatFirstCityRetainedTemplatePanel(knowledge);
  expect(panel).toMatch(/templateVersion=v1/);
  expect(panel).toMatch(/sha256=abcdef/);
  expect(panel).toMatch(/非调用方意图/);
});

it("withholds without knowledge, on stale-actor, unavailable, and incomplete", () => {
  expect(formatFirstCityRetainedTemplatePanel(null)).toBe("");
  expect(formatFirstCityRetainedTemplatePanel(withEmptyHead(), true)).toBe("");
  expect(formatFirstCityRetainedTemplatePanel({ ...withPendingHead(), unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityRetainedTemplatePanel({ ...withPendingHead(), incomplete: true })).toMatch(/不完整/);
  expect(formatFirstCityRetainedTemplatePanel({ ...withPendingHead(), head: null })).toMatch(/不完整/);
});

it("returns none when durable head is EMPTY", () => {
  expect(resolveFirstCityRetainedTemplateView(withEmptyHead()).kind).toBe("none");
  expect(formatFirstCityRetainedTemplatePanel(withEmptyHead())).toBe("");
});

it("shows template for terminal head record", () => {
  const commandId = "22222222-2222-4222-8222-222222222222";
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "城",
    x: 0,
    y: 1,
  });
  const record = {
    intent,
    template: { ...template, templateVersion: "frozen" },
    state: {
      kind: "succeeded" as const,
      cityId: 9n,
      shard: 1,
      playerId: 7n,
      isCapital: true as const,
      wallLevel: 1 as const,
      morale: 100 as const,
    },
  };
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record } };
  const knowledge = reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
  expect(formatFirstCityRetainedTemplatePanel(knowledge)).toMatch(/templateVersion=frozen/);
});
