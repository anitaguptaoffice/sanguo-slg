import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityNotObservedPanel,
  resolveFirstCityNotObservedView,
} from "./firstCityServerSelectNotObserved";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const commandId = "22222222-2222-4222-8222-222222222222";
const foreignId = "33333333-3333-4333-8333-333333333333";

function record(name: string, x: number, y: number) {
  const intent = createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name, x, y });
  return {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "pending" as const },
  };
}

function knowledge(observations: FirstCityKnowledge["observations"], headRecord = record("规范记录", 10, 20)): FirstCityKnowledge {
  return {
    scope,
    intents: [],
    observations,
    records: headRecord ? [headRecord] : [],
    head: headRecord ? { kind: "command" as const, record: headRecord } : { kind: "empty" as const },
    incomplete: false,
    unavailable: false,
  };
}

it("surfaces notObserved with context head and distinguishes from discovery EMPTY", () => {
  const head = record("规范记录", 10, 20);
  const obs = {
    kind: "notObserved" as const,
    scope,
    requestedCommandId: foreignId,
    command: null,
    head: { kind: "command" as const, record: head },
  };
  const view = resolveFirstCityNotObservedView(knowledge([obs], head));
  expect(view.kind).toBe("entries");
  const text = formatFirstCityNotObservedPanel(knowledge([obs], head));
  expect(text).toContain(foreignId);
  expect(text).toMatch(/NOT_OBSERVED/);
  expect(text).toMatch(/不是 actor discovery 的 EMPTY/);
  expect(text).toContain("规范记录");
  expect(text).not.toMatch(/自动 Continue/);
});

it("formats EMPTY context head on notObserved lookup", () => {
  const obs = {
    kind: "notObserved" as const,
    scope,
    requestedCommandId: foreignId,
    command: null,
    head: { kind: "empty" as const },
  };
  const text = formatFirstCityNotObservedPanel(knowledge([obs], null));
  expect(text).toMatch(/durable head：EMPTY/);
  expect(text).toMatch(/不是 actor discovery 的 EMPTY/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  const obs = {
    kind: "notObserved" as const,
    scope,
    requestedCommandId: foreignId,
    command: null,
    head: { kind: "empty" as const },
  };
  const base = knowledge([obs], null);
  expect(formatFirstCityNotObservedPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityNotObservedPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityNotObservedPanel(base, true)).toBe("");
});

it("hides when no notObserved observations exist", () => {
  const head = record("唯一", 5, 6);
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record: head } };
  expect(formatFirstCityNotObservedPanel(knowledge([discovery], head))).toBe("");
});
