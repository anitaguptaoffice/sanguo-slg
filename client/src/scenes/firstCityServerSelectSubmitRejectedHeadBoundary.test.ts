import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCitySubmitRejectedHeadBoundaryPanel,
  resolveFirstCitySubmitRejectedHeadBoundaryView,
} from "./firstCityServerSelectSubmitRejectedHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const commandId = "22222222-2222-4222-8222-222222222222";

function rejectedHeadKnowledge(reason: "terrain" | "coordinateOccupied" = "terrain") {
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor: { kind: "empty" },
    name: "拒收城",
    x: 4,
    y: 5,
  });
  const record = {
    intent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "rejected" as const, reason },
  };
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCitySubmitRejectedHeadBoundaryView", () => {
  it("reports rejected-head when durable head is rejected", () => {
    const view = resolveFirstCitySubmitRejectedHeadBoundaryView(rejectedHeadKnowledge());
    expect(view).toMatchObject({ kind: "rejected-head", commandId, reason: "terrain" });
  });

  it("returns none for empty, pending, or succeeded head", () => {
    const rejected = rejectedHeadKnowledge();
    expect(resolveFirstCitySubmitRejectedHeadBoundaryView({ ...rejected, head: { kind: "empty" } }).kind).toBe("none");
    const pendingRecord = rejected.head.record;
    const pending = { ...pendingRecord, state: { kind: "pending" as const } };
    expect(
      resolveFirstCitySubmitRejectedHeadBoundaryView({
        ...rejected,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
    const succeeded = {
      ...pendingRecord,
      state: {
        kind: "succeeded" as const,
        cityId: 9n,
        shard: 1,
        playerId: 7n,
        isCapital: true as const,
        wallLevel: 1 as const,
        morale: 100 as const,
      },
    };
    expect(
      resolveFirstCitySubmitRejectedHeadBoundaryView({
        ...rejected,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = rejectedHeadKnowledge();
  expect(resolveFirstCitySubmitRejectedHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCitySubmitRejectedHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCitySubmitRejectedHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCitySubmitRejectedHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats rejected-head copy with predecessor hint", () => {
  const text = formatFirstCitySubmitRejectedHeadBoundaryPanel(rejectedHeadKnowledge("coordinateOccupied"));
  expect(text).toMatch(/Submit rejected-head 边界/);
  expect(text).toMatch(commandId);
  expect(text).toMatch(/EMPTY head/);
  expect(text).toMatch(/predecessor=rejected/);
  expect(text).toMatch(/coordinateOccupied/);
});