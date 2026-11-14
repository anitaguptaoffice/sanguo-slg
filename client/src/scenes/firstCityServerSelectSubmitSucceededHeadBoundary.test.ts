import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCitySubmitSucceededHeadBoundaryPanel,
  resolveFirstCitySubmitSucceededHeadBoundaryView,
} from "./firstCityServerSelectSubmitSucceededHeadBoundary";

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

describe("resolveFirstCitySubmitSucceededHeadBoundaryView", () => {
  it("reports succeeded-head when durable head is succeeded", () => {
    const view = resolveFirstCitySubmitSucceededHeadBoundaryView(succeededHeadKnowledge());
    expect(view).toMatchObject({ kind: "succeeded-head", commandId, cityId: 99n });
  });

  it("returns none for empty, rejected, or pending head", () => {
    const succeeded = succeededHeadKnowledge();
    expect(resolveFirstCitySubmitSucceededHeadBoundaryView({ ...succeeded, head: { kind: "empty" } }).kind).toBe("none");
    const baseRecord = succeeded.head.record;
    const rejected = { ...baseRecord, state: { kind: "rejected" as const, reason: "terrain" as const } };
    expect(
      resolveFirstCitySubmitSucceededHeadBoundaryView({
        ...succeeded,
        head: { kind: "command", record: rejected },
      }).kind,
    ).toBe("none");
    const pending = { ...baseRecord, state: { kind: "pending" as const } };
    expect(
      resolveFirstCitySubmitSucceededHeadBoundaryView({
        ...succeeded,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = succeededHeadKnowledge();
  expect(resolveFirstCitySubmitSucceededHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCitySubmitSucceededHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCitySubmitSucceededHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCitySubmitSucceededHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats succeeded-head copy with HEAD_CONFLICT hint", () => {
  const text = formatFirstCitySubmitSucceededHeadBoundaryPanel(succeededHeadKnowledge());
  expect(text).toMatch(/Submit succeeded-head 边界/);
  expect(text).toMatch(commandId);
  expect(text).toMatch(/EMPTY head/);
  expect(text).toMatch(/HEAD_CONFLICT/);
  expect(text).toMatch(/§5\.2\(7\)/);
  expect(text).toMatch(/成功演示城/);
  expect(text).toMatch(/cityId 99/);
});