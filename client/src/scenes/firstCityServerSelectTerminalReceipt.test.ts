import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityTerminalReceiptPanel,
  resolveFirstCityTerminalReceiptView,
} from "./firstCityServerSelectTerminalReceipt";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scope);
const commandId = "33333333-3333-4333-8333-333333333333";

function succeededRecord() {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "Receipt city",
    x: 12,
    y: 34,
  });
  return {
    intent,
    template,
    state: {
      kind: "succeeded" as const,
      cityId: 99n,
      shard: 1,
      playerId: 1n,
      isCapital: true as const,
      wallLevel: 1 as const,
      morale: 100 as const,
    },
  };
}

function rejectedRecord(reason: "terrain" | "coordinateOccupied" = "terrain") {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "Failed city",
    x: 3,
    y: 4,
  });
  return {
    intent,
    template,
    state: { kind: "rejected" as const, reason },
  };
}

it("surfaces succeeded receipt fields on durable head", () => {
  const record = succeededRecord();
  const knowledge = { ...empty(), head: { kind: "command" as const, record }, records: [record] };
  const view = resolveFirstCityTerminalReceiptView(knowledge);
  expect(view).toMatchObject({ kind: "succeeded", cityId: 99n, wallLevel: 1, morale: 100 });
  const text = formatFirstCityTerminalReceiptPanel(knowledge);
  expect(text).toMatch(/cityId=99/);
  expect(text).toMatch(/Receipt city/);
  expect(text).toMatch(/不授予当前主城进入权/);
});

it("surfaces rejected receipt reason on durable head", () => {
  const record = rejectedRecord("coordinateOccupied");
  const knowledge = { ...empty(), head: { kind: "command" as const, record }, records: [record] };
  const view = resolveFirstCityTerminalReceiptView(knowledge);
  expect(view).toMatchObject({ kind: "rejected", reason: "coordinateOccupied" });
  expect(formatFirstCityTerminalReceiptPanel(knowledge)).toMatch(/COORDINATE_OCCUPIED/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  const record = succeededRecord();
  const base = { ...empty(), head: { kind: "command" as const, record }, records: [record] };
  expect(formatFirstCityTerminalReceiptPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityTerminalReceiptPanel({ ...empty(), incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityTerminalReceiptPanel(base, true)).toBe("");
});

it("hides on pending or empty head", () => {
  const pending = {
    ...succeededRecord(),
    state: { kind: "pending" as const },
  };
  expect(formatFirstCityTerminalReceiptPanel({
    ...empty(),
    head: { kind: "command", record: pending },
    records: [pending],
  })).toBe("");
  expect(formatFirstCityTerminalReceiptPanel({ ...empty(), head: { kind: "empty" } })).toBe("");
});
