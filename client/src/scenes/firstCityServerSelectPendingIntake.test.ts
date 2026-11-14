import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityPendingIntakePanel,
  resolveFirstCityPendingIntakeView,
} from "./firstCityServerSelectPendingIntake";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scope);
const commandId = "44444444-4444-4444-8444-444444444444";

function pendingRecord() {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "待完成城",
    x: 8,
    y: 9,
  });
  return { intent, template, state: { kind: "pending" as const } };
}

function succeededRecord() {
  const intent = createFirstCityIntent(scope, {
    commandId: "55555555-5555-4555-8555-555555555555",
    predecessor: { kind: "empty" },
    name: "终态城",
    x: 1,
    y: 2,
  });
  return {
    intent,
    template,
    state: {
      kind: "succeeded" as const,
      cityId: 9n,
      shard: 1,
      playerId: 1n,
      isCapital: true as const,
      wallLevel: 1 as const,
      morale: 100 as const,
    },
  };
}

it("surfaces durable head pending intake fields", () => {
  const record = pendingRecord();
  const knowledge = { ...empty(), head: { kind: "command" as const, record }, records: [record] };
  const view = resolveFirstCityPendingIntakeView(knowledge);
  expect(view).toMatchObject({ kind: "pending", commandId, name: "待完成城", x: 8, y: 9 });
  const text = formatFirstCityPendingIntakePanel(knowledge);
  expect(text).toMatch(/意图已接收/);
  expect(text).toMatch(/待完成城/);
  expect(text).toMatch(/不是执行许可/);
  expect(text).toMatch(/Continue\/Submit 须显式点击/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  const record = pendingRecord();
  const base = { ...empty(), head: { kind: "command" as const, record }, records: [record] };
  expect(formatFirstCityPendingIntakePanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityPendingIntakePanel({ ...empty(), incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityPendingIntakePanel(base, true)).toBe("");
});

it("hides on succeeded, rejected, or empty head", () => {
  const succeeded = succeededRecord();
  expect(formatFirstCityPendingIntakePanel({
    ...empty(),
    head: { kind: "command", record: succeeded },
    records: [succeeded],
  })).toBe("");
  const rejected = {
    ...pendingRecord(),
    state: { kind: "rejected" as const, reason: "terrain" as const },
  };
  expect(formatFirstCityPendingIntakePanel({
    ...empty(),
    head: { kind: "command", record: rejected },
    records: [rejected],
  })).toBe("");
  expect(formatFirstCityPendingIntakePanel({ ...empty(), head: { kind: "empty" } })).toBe("");
});
