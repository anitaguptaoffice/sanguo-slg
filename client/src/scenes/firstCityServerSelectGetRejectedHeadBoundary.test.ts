import { describe, expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import {
  formatFirstCityGetRejectedHeadBoundaryPanel,
  resolveFirstCityGetRejectedHeadBoundaryView,
} from "./firstCityServerSelectGetRejectedHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};

function rejectedHeadKnowledge() {
  const intent = createFirstCityIntent(scope, {
    commandId: "22222222-2222-4222-8222-222222222222",
    predecessor: { kind: "empty" },
    name: "演示城",
    x: 1,
    y: 2,
  });
  const record = {
    intent,
    template: {
      templateVersion: "v1",
      rulesVersion: "r1",
      catalogVersion: "c1",
      contentEncodingVersion: 1,
      contentSha256: "00",
    },
    state: { kind: "rejected" as const, reason: "terrain" as const },
  };
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityGetRejectedHeadBoundaryView", () => {
  it("reports rejected-head when durable head is rejected", () => {
    const view = resolveFirstCityGetRejectedHeadBoundaryView(rejectedHeadKnowledge());
    expect(view.kind).toBe("rejected-head");
    if (view.kind === "rejected-head") {
      expect(view.commandId).toBe("22222222-2222-4222-8222-222222222222");
      expect(view.reason).toBe("terrain");
    }
  });

  it("returns none for EMPTY, pending, or succeeded head", () => {
    const base = rejectedHeadKnowledge();
    expect(
      resolveFirstCityGetRejectedHeadBoundaryView({
        ...base,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const intent = base.head.kind === "command" ? base.head.record.intent : null;
    if (!intent) throw new Error("fixture");
    const pending = {
      intent,
      template: base.records[0]!.template,
      state: { kind: "pending" as const },
    };
    expect(
      resolveFirstCityGetRejectedHeadBoundaryView({
        ...base,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
    const succeeded = {
      intent,
      template: base.records[0]!.template,
      state: {
        kind: "succeeded" as const,
        cityId: 1n,
        shard: 1,
        playerId: 7n,
        isCapital: true as const,
        wallLevel: 1 as const,
        morale: 100 as const,
      },
    };
    expect(
      resolveFirstCityGetRejectedHeadBoundaryView({
        ...base,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = rejectedHeadKnowledge();
  expect(resolveFirstCityGetRejectedHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityGetRejectedHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityGetRejectedHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityGetRejectedHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats rejected-head copy with read-only GetResult and Submit successor hints", () => {
  const text = formatFirstCityGetRejectedHeadBoundaryPanel(rejectedHeadKnowledge());
  expect(text).toMatch(/Get rejected-head 边界/);
  expect(text).toMatch(/NOT_OBSERVED/);
  expect(text).toMatch(/predecessor=rejected/);
  expect(text).toMatch(/§5\.2\(7\)/);
  expect(text).toMatch(/不得用 GetResult 代替/);
});