import { expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import {
  formatFirstCityDiscoveryEmptyPanel,
  resolveFirstCityDiscoveryEmptyView,
} from "./firstCityServerSelectDiscoveryEmpty";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 1n, accountId: 2n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};
const empty = () => createFirstCityKnowledge(scope);

function pendingRecord() {
  const intent = createFirstCityIntent(scope, {
    commandId: "44444444-4444-4444-8444-444444444444",
    predecessor: { kind: "empty" },
    name: "城",
    x: 1,
    y: 2,
  });
  return { intent, template, state: { kind: "pending" as const } };
}

it("surfaces durable discovery EMPTY distinct from NOT_OBSERVED", () => {
  const knowledge = { ...empty(), head: { kind: "empty" as const } };
  expect(resolveFirstCityDiscoveryEmptyView(knowledge)).toEqual({ kind: "empty" });
  const text = formatFirstCityDiscoveryEmptyPanel(knowledge);
  expect(text).toMatch(/actor discovery EMPTY/);
  expect(text).toMatch(/不是按 commandId 查找的 NOT_OBSERVED/);
  expect(text).toMatch(/不证明旧包失败/);
  expect(text).toMatch(/Submit\/Continue 须显式点击/);
});

it("withholds on unavailable, incomplete, and stale-actor", () => {
  expect(formatFirstCityDiscoveryEmptyPanel({ ...empty(), unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityDiscoveryEmptyPanel({ ...empty(), incomplete: true, head: null })).toMatch(/不完整/);
  expect(formatFirstCityDiscoveryEmptyPanel({ ...empty(), head: { kind: "empty" } }, true)).toBe("");
});

it("hides on command head", () => {
  const record = pendingRecord();
  const knowledge = { ...empty(), head: { kind: "command" as const, record }, records: [record] };
  expect(formatFirstCityDiscoveryEmptyPanel(knowledge)).toBe("");
});
