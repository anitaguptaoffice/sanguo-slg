import { describe, expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import {
  formatFirstCitySubmitEmptyHeadBoundaryPanel,
  resolveFirstCitySubmitEmptyHeadBoundaryView,
} from "./firstCityServerSelectSubmitEmptyHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};

function emptyHeadKnowledge() {
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "empty" as const },
    records: [],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCitySubmitEmptyHeadBoundaryView", () => {
  it("reports empty-head when durable head is EMPTY", () => {
    expect(resolveFirstCitySubmitEmptyHeadBoundaryView(emptyHeadKnowledge())).toEqual({ kind: "empty-head" });
  });

  it("returns none for pending, rejected, or succeeded command head", () => {
    const base = emptyHeadKnowledge();
    const intent = createFirstCityIntent(scope, {
      commandId: "22222222-2222-4222-8222-222222222222",
      predecessor: { kind: "empty" },
      name: "演示城",
      x: 1,
      y: 2,
    });
    const template = {
      templateVersion: "v1",
      rulesVersion: "r1",
      catalogVersion: "c1",
      contentEncodingVersion: 1,
      contentSha256: "00",
    };
    const pending = { intent, template, state: { kind: "pending" as const } };
    expect(
      resolveFirstCitySubmitEmptyHeadBoundaryView({
        ...base,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
    const rejected = {
      intent,
      template,
      state: { kind: "rejected" as const, reason: "terrain" as const },
    };
    expect(
      resolveFirstCitySubmitEmptyHeadBoundaryView({
        ...base,
        head: { kind: "command", record: rejected },
      }).kind,
    ).toBe("none");
    const succeeded = {
      intent,
      template,
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
      resolveFirstCitySubmitEmptyHeadBoundaryView({
        ...base,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = emptyHeadKnowledge();
  expect(resolveFirstCitySubmitEmptyHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCitySubmitEmptyHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCitySubmitEmptyHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCitySubmitEmptyHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats empty-head copy with INITIAL and Continue gating hints", () => {
  const text = formatFirstCitySubmitEmptyHeadBoundaryPanel(emptyHeadKnowledge());
  expect(text).toMatch(/Submit empty-head 边界/);
  expect(text).toMatch(/EMPTY head/);
  expect(text).toMatch(/predecessor=EMPTY/);
  expect(text).toMatch(/PENDING/);
  expect(text).toMatch(/§5\.2\(6\)/);
});