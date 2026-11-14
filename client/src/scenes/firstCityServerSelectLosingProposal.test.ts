import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityLosingProposalsPanel,
  resolveFirstCityLosingProposalsView,
} from "./firstCityServerSelectLosingProposal";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scope);
const winnerId = "22222222-2222-4222-8222-222222222222";
const loserId = "33333333-3333-4333-8333-333333333333";

function record(commandId: string, name: string, state: "pending" | "succeeded" | "rejected") {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name,
    x: 10,
    y: 20,
  });
  return { intent, template, state: { kind: state } as const };
}

it("lists local losing intents with real name and coordinates", () => {
  const winner = record(winnerId, "规范胜者", "pending");
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: winner },
    records: [winner],
    intents: Object.freeze([
      createFirstCityIntent(scope, { commandId: loserId, predecessor: { kind: "empty" }, name: "他者提案", x: 1, y: 2 }),
    ]),
  };
  const view = resolveFirstCityLosingProposalsView(knowledge);
  expect(view).toMatchObject({
    kind: "entries",
    entries: [{ commandId: loserId, name: "他者提案", x: 1, y: 2, source: "local" }],
  });
  const text = formatFirstCityLosingProposalsPanel(knowledge);
  expect(text).toContain("他者提案");
  expect(text).toContain(loserId);
  expect(text).toMatch(/显式|规范胜者/);
  expect(text).not.toContain(winnerId);
});

it("lists server records that are not durable head", () => {
  const winner = record(winnerId, "胜者", "pending");
  const loser = record(loserId, "Server loser", "rejected");
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: winner },
    records: [winner, loser],
  };
  const view = resolveFirstCityLosingProposalsView(knowledge);
  expect(view.kind).toBe("entries");
  if (view.kind === "entries") {
    expect(view.entries[0]).toMatchObject({ commandId: loserId, source: "server", name: "Server loser" });
  }
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const winner = record(winnerId, "城", "pending");
  const base = {
    ...empty(),
    head: { kind: "command" as const, record: winner },
    records: [winner],
    intents: Object.freeze([
      createFirstCityIntent(scope, { commandId: loserId, predecessor: { kind: "empty" }, name: "L", x: 0, y: 0 }),
    ]),
  };
  expect(formatFirstCityLosingProposalsPanel(base, true)).toBe("");
  expect(formatFirstCityLosingProposalsPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityLosingProposalsPanel({ ...empty(), incomplete: true, head: null })).toMatch(/不完整/);
});

it("returns empty panel when there is no loser", () => {
  const winner = record(winnerId, "唯一", "pending");
  const knowledge = { ...empty(), head: { kind: "command" as const, record: winner }, records: [winner] };
  expect(resolveFirstCityLosingProposalsView(knowledge)).toEqual({ kind: "none" });
  expect(formatFirstCityLosingProposalsPanel(knowledge)).toBe("");
});
