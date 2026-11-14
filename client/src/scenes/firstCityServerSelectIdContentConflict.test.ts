import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityIdContentConflictPanel,
  resolveFirstCityIdContentConflictView,
} from "./firstCityServerSelectIdContentConflict";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const commandId = "22222222-2222-4222-8222-222222222222";

function record(name: string, x: number, y: number, state: "pending" | "succeeded" | "rejected" = "pending") {
  const intent = createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name, x, y });
  return {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: state },
  };
}

function knowledge(observations: FirstCityKnowledge["observations"], headRecord = record("规范记录", 10, 20)): FirstCityKnowledge {
  return {
    scope,
    intents: [],
    observations,
    records: [headRecord],
    head: { kind: "command" as const, record: headRecord },
    incomplete: false,
    unavailable: false,
  };
}

it("surfaces idContentConflict with server original record coordinates", () => {
  const retained = record("规范记录", 10, 20);
  const obs = {
    kind: "idContentConflict" as const,
    scope,
    requestedCommandId: commandId,
    command: retained,
    head: { kind: "command" as const, record: retained },
  };
  const view = resolveFirstCityIdContentConflictView(knowledge([obs], retained));
  expect(view.kind).toBe("entries");
  const text = formatFirstCityIdContentConflictPanel(knowledge([obs], retained));
  expect(text).toContain(commandId);
  expect(text).toContain("规范记录");
  expect(text).toMatch(/ID_CONTENT_CONFLICT/);
  expect(text).toMatch(/server 原始记录/);
  expect(text).not.toMatch(/自动 Continue/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  const retained = record("城", 1, 2);
  const obs = {
    kind: "idContentConflict" as const,
    scope,
    requestedCommandId: commandId,
    command: retained,
    head: { kind: "command" as const, record: retained },
  };
  const base = knowledge([obs], retained);
  expect(formatFirstCityIdContentConflictPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityIdContentConflictPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityIdContentConflictPanel(base, true)).toBe("");
});

it("hides when no idContentConflict observations exist", () => {
  const retained = record("唯一", 5, 6);
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record: retained } };
  expect(formatFirstCityIdContentConflictPanel(knowledge([discovery], retained))).toBe("");
});

it("skips observations missing server command record", () => {
  const retained = record("城", 0, 0);
  const obs = {
    kind: "idContentConflict" as const,
    scope,
    requestedCommandId: commandId,
    command: null,
    head: { kind: "command" as const, record: retained },
  };
  expect(formatFirstCityIdContentConflictPanel(knowledge([obs], retained))).toBe("");
});
