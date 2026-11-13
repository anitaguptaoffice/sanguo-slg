import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityLocalDraftPanel,
  resolveFirstCityLocalDraftView,
} from "./firstCityServerSelectLocalDraft";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scope);
const commandId = "22222222-2222-4222-8222-222222222222";

function record(name: string, state: "pending" | "succeeded" | "rejected" = "pending") {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name,
    x: 10,
    y: 20,
  });
  return { intent, template, state: { kind: state } as const };
}

it("surfaces same-ID local draft divergence with real name and coordinates", () => {
  const server = record("Server城");
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([
      createFirstCityIntent(scope, {
        commandId,
        predecessor: { kind: "empty" },
        name: "本地草案",
        x: 1,
        y: 2,
      }),
    ]),
  };
  const view = resolveFirstCityLocalDraftView(knowledge);
  expect(view).toMatchObject({
    kind: "entries",
    entries: [{
      commandId,
      localName: "本地草案",
      localX: 1,
      localY: 2,
      serverName: "Server城",
      serverX: 10,
      serverY: 20,
    }],
  });
  const text = formatFirstCityLocalDraftPanel(knowledge);
  expect(text).toContain("本地草案");
  expect(text).toContain("Server城");
  expect(text).toMatch(/显式|规范胜者/);
});

it("returns none when local matches server record", () => {
  const server = record("一致");
  const knowledge = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([createFirstCityIntent(scope, server.intent.proposal)]),
  };
  expect(resolveFirstCityLocalDraftView(knowledge)).toEqual({ kind: "none" });
  expect(formatFirstCityLocalDraftPanel(knowledge)).toBe("");
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const server = record("城");
  const base = {
    ...empty(),
    head: { kind: "command" as const, record: server },
    records: [server],
    intents: Object.freeze([
      createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "L", x: 0, y: 0 }),
    ]),
  };
  expect(formatFirstCityLocalDraftPanel(base, true)).toBe("");
  expect(formatFirstCityLocalDraftPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityLocalDraftPanel({ ...empty(), incomplete: true, head: null })).toMatch(/不完整/);
});
