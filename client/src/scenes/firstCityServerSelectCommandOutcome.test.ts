import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityCommandOutcomePanel,
  resolveFirstCityCommandOutcomeView,
} from "./firstCityServerSelectCommandOutcome";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const commandId = "22222222-2222-4222-8222-222222222222";
const empty = () => createFirstCityKnowledge(scope);

function pendingRecord(name = "回放城") {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name,
    x: 3,
    y: 4,
  });
  return { intent, template, state: { kind: "pending" as const } };
}

it("surfaces retained COMMAND observation distinct from NOT_OBSERVED and discovery EMPTY", () => {
  const record = pendingRecord();
  const observation = {
    kind: "command" as const,
    scope,
    requestedCommandId: commandId,
    command: record,
    head: { kind: "command" as const, record },
  };
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record },
    records: [record],
    observations: [observation],
  };
  expect(resolveFirstCityCommandOutcomeView(knowledge).kind).toBe("entries");
  const text = formatFirstCityCommandOutcomePanel(knowledge);
  expect(text).toMatch(/COMMAND 回放/);
  expect(text).toMatch(commandId);
  expect(text).toMatch(/回放城/);
  expect(text).toMatch(/不是 NOT_OBSERVED/);
  expect(text).toMatch(/Continue\/Submit 须显式点击/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  const record = pendingRecord();
  const base = {
    ...empty(),
    head: { kind: "command" as const, record },
    records: [record],
  };
  expect(formatFirstCityCommandOutcomePanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityCommandOutcomePanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityCommandOutcomePanel(base, true)).toBe("");
});

it("hides when no command observations exist", () => {
  const record = pendingRecord();
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record } };
  const knowledge = { ...empty(), head: { kind: "command" as const, record }, records: [record], observations: [discovery] };
  expect(formatFirstCityCommandOutcomePanel(knowledge)).toBe("");
});
