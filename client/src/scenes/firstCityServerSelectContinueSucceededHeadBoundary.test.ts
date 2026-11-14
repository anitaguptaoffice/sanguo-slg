import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityContinueSucceededHeadBoundaryPanel,
  resolveFirstCityContinueSucceededHeadBoundaryView,
} from "./firstCityServerSelectContinueSucceededHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const commandId = "22222222-2222-4222-8222-222222222222";

function succeededHeadKnowledge() {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "成功演示城",
    x: 4,
    y: 5,
  });
  const record = {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: {
      kind: "succeeded" as const,
      cityId: 99n,
      shard: 1,
      playerId: 7n,
      isCapital: true as const,
      wallLevel: 1 as const,
      morale: 100 as const,
    },
  };
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityContinueSucceededHeadBoundaryView", () => {
  it("reports succeeded-head when durable head is succeeded", () => {
    const view = resolveFirstCityContinueSucceededHeadBoundaryView(succeededHeadKnowledge());
    expect(view).toMatchObject({ kind: "succeeded-head", commandId, cityId: 99n });
  });

  it("returns none for empty, rejected, or pending head", () => {
    const succeeded = succeededHeadKnowledge();
    expect(resolveFirstCityContinueSucceededHeadBoundaryView({ ...succeeded, head: { kind: "empty" } }).kind).toBe("none");
    const baseRecord = succeeded.head.record;
    const rejected = { ...baseRecord, state: { kind: "rejected" as const, reason: "terrain" as const } };
    expect(
      resolveFirstCityContinueSucceededHeadBoundaryView({
        ...succeeded,
        head: { kind: "command", record: rejected },
      }).kind,
    ).toBe("none");
    const pending = { ...baseRecord, state: { kind: "pending" as const } };
    expect(
      resolveFirstCityContinueSucceededHeadBoundaryView({
        ...succeeded,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = succeededHeadKnowledge();
  expect(resolveFirstCityContinueSucceededHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityContinueSucceededHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityContinueSucceededHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityContinueSucceededHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats succeeded-head copy with §6 / §5.2(7) hint", () => {
  const text = formatFirstCityContinueSucceededHeadBoundaryPanel(succeededHeadKnowledge());
  expect(text).toMatch(/Continue succeeded-head 边界/);
  expect(text).toMatch(commandId);
  expect(text).toMatch(/PENDING head/);
  expect(text).toMatch(/§5\.2\(7\)/);
  expect(text).toMatch(/成功演示城/);
  expect(text).toMatch(/cityId 99/);
});