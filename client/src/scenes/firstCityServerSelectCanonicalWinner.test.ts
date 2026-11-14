import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityCanonicalWinnerPanel,
  resolveFirstCityCanonicalWinnerView,
} from "./firstCityServerSelectCanonicalWinner";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scope);
const winnerId = "33333333-3333-4333-8333-333333333333";
const loserId = "44444444-4444-4444-8444-444444444444";

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

it("shows canonical head command, not local losing intents", () => {
  const winner = record(winnerId, "Canonical winner", "succeeded");
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: winner },
    records: [winner],
    intents: Object.freeze([
      createFirstCityIntent(scope, { commandId: loserId, predecessor: { kind: "empty" }, name: "Local loser", x: 1, y: 2 }),
    ]),
  };
  const view = resolveFirstCityCanonicalWinnerView(knowledge);
  expect(view).toMatchObject({ kind: "command", commandId: winnerId, name: "Canonical winner" });
  const text = formatFirstCityCanonicalWinnerPanel(knowledge);
  expect(text).toContain("Canonical winner");
  expect(text).toContain(winnerId);
  expect(text).not.toContain("Local loser");
  expect(text).not.toContain(loserId);
});

it("withholds winner on unavailable, incomplete, and stale-actor", () => {
  const winner = record(winnerId, "城", "pending");
  const base = { ...empty(), head: { kind: "command" as const, record: winner }, records: [winner] };
  expect(resolveFirstCityCanonicalWinnerView({ ...base, unavailable: true }).kind).toBe("withheld");
  expect(formatFirstCityCanonicalWinnerPanel({ ...base, unavailable: true })).toMatch(/冲突或不可用/);
  expect(resolveFirstCityCanonicalWinnerView({ ...empty(), incomplete: true, head: null }).reason).toBe("incomplete");
  expect(formatFirstCityCanonicalWinnerPanel(base, true)).toBe("");
});

it("describes empty durable head without implying auto-submit", () => {
  const view = resolveFirstCityCanonicalWinnerView({ ...empty(), head: { kind: "empty" } });
  expect(view).toEqual({ kind: "empty-head" });
  expect(formatFirstCityCanonicalWinnerPanel({ ...empty(), head: { kind: "empty" } })).toMatch(/head 为空/);
});
