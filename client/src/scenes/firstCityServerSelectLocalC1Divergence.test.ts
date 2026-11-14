import { expect, it } from "vitest";
import { createFirstCityIntent, type FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityLocalC1DivergencePanel,
  resolveFirstCityLocalC1DivergenceView,
} from "./firstCityServerSelectLocalC1Divergence";

const scopeA: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 1n,
  accountId: 2n,
};
const scopeB: FirstCityScope = { ...scopeA, accountId: 99n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scopeA);
const commandId = "22222222-2222-4222-8222-222222222222";
const proposal = {
  commandId,
  predecessor: { kind: "empty" as const },
  name: "城",
  x: 10,
  y: 20,
};

function serverRecord(scope: FirstCityScope) {
  const intent = createFirstCityIntent(scope, proposal);
  return { intent, template, state: { kind: "pending" as const } };
}

it("surfaces C1 divergence when proposal fields match but scope differs", () => {
  const server = serverRecord(scopeA);
  const local = createFirstCityIntent(scopeB, proposal);
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([local]),
  };
  const view = resolveFirstCityLocalC1DivergenceView(knowledge);
  expect(view.kind).toBe("entries");
  if (view.kind !== "entries") return;
  expect(view.entries).toHaveLength(1);
  expect(view.entries[0]!.commandId).toBe(commandId);
  expect(view.entries[0]!.localByteLength).toBe(local.encode().length);
  expect(view.entries[0]!.serverByteLength).toBe(server.intent.encode().length);
  const text = formatFirstCityLocalC1DivergencePanel(knowledge);
  expect(text).toMatch(/同 ID 本地 C1/);
  expect(text).toMatch(/scope\/operation|完整 C1/);
  expect(text).not.toMatch(/进入主城/);
});

it("surfaces C1 divergence when proposal name differs", () => {
  const server = serverRecord(scopeA);
  const local = createFirstCityIntent(scopeA, { ...proposal, name: "本地" });
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([local]),
  };
  expect(resolveFirstCityLocalC1DivergenceView(knowledge).kind).toBe("entries");
  expect(formatFirstCityLocalC1DivergencePanel(knowledge)).toMatch(/≠/);
});

it("returns none when local C1 matches server record", () => {
  const server = serverRecord(scopeA);
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([createFirstCityIntent(scopeA, proposal)]),
  };
  expect(resolveFirstCityLocalC1DivergenceView(knowledge)).toEqual({ kind: "none" });
  expect(formatFirstCityLocalC1DivergencePanel(knowledge)).toBe("");
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const server = serverRecord(scopeA);
  const local = createFirstCityIntent(scopeB, proposal);
  const base = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([local]),
  };
  expect(formatFirstCityLocalC1DivergencePanel(base, true)).toBe("");
  expect(formatFirstCityLocalC1DivergencePanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityLocalC1DivergencePanel({ ...empty(), incomplete: true, head: null })).toMatch(/不完整/);
});