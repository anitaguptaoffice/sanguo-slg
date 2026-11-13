import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import type { FirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityHeadConflictPanel,
  resolveFirstCityHeadConflictView,
} from "./firstCityServerSelectHeadConflict";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const winnerId = "33333333-3333-4333-8333-333333333333";
const loserId = "44444444-4444-4444-8444-444444444444";

function record(commandId: string, name: string, state: "pending" | "succeeded" | "rejected" = "pending") {
  const intent = createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name, x: 10, y: 20 });
  return {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: state },
  };
}

function knowledge(
  observations: FirstCityKnowledge["observations"],
  headRecord = record(winnerId, "规范胜者"),
): FirstCityKnowledge {
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

it("surfaces headConflict with actual winner coordinates", () => {
  const winner = record(winnerId, "规范胜者");
  const obs = {
    kind: "headConflict" as const,
    scope,
    requestedCommandId: loserId,
    command: null,
    head: { kind: "command" as const, record: winner },
  };
  const view = resolveFirstCityHeadConflictView(knowledge([obs], winner));
  expect(view.kind).toBe("entries");
  const text = formatFirstCityHeadConflictPanel(knowledge([obs], winner));
  expect(text).toContain(loserId);
  expect(text).toContain(winnerId);
  expect(text).toContain("规范胜者");
  expect(text).toMatch(/HEAD_CONFLICT/);
  expect(text).not.toMatch(/自动 Continue/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  const winner = record(winnerId, "城");
  const obs = {
    kind: "headConflict" as const,
    scope,
    requestedCommandId: loserId,
    command: null,
    head: { kind: "command" as const, record: winner },
  };
  const base = knowledge([obs], winner);
  expect(formatFirstCityHeadConflictPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityHeadConflictPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityHeadConflictPanel(base, true)).toBe("");
});

it("hides when no headConflict observations exist", () => {
  const winner = record(winnerId, "唯一");
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record: winner } };
  expect(formatFirstCityHeadConflictPanel(knowledge([discovery], winner))).toBe("");
});

it("formats EMPTY actual head from observation", () => {
  const winner = record(winnerId, "城");
  const obs = {
    kind: "headConflict" as const,
    scope,
    requestedCommandId: loserId,
    command: null,
    head: { kind: "empty" as const },
  };
  expect(formatFirstCityHeadConflictPanel(knowledge([obs], winner))).toMatch(/EMPTY/);
});
