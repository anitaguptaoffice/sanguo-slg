import { describe, expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import {
  formatFirstCityDiscoverSucceededHeadBoundaryPanel,
  resolveFirstCityDiscoverSucceededHeadBoundaryView,
} from "./firstCityServerSelectDiscoverSucceededHeadBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};

function succeededHeadKnowledge() {
  const intent = createFirstCityIntent(scope, {
    commandId: "22222222-2222-4222-8222-222222222222",
    predecessor: { kind: "empty" },
    name: "成功演示城",
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

describe("resolveFirstCityDiscoverSucceededHeadBoundaryView", () => {
  it("reports succeeded-head when durable head is SUCCEEDED", () => {
    const view = resolveFirstCityDiscoverSucceededHeadBoundaryView(succeededHeadKnowledge());
    expect(view.kind).toBe("succeeded-head");
    if (view.kind === "succeeded-head") {
      expect(view.commandId).toBe("22222222-2222-4222-8222-222222222222");
      expect(view.cityId).toBe(99n);
    }
  });

  it("returns none for EMPTY, pending, or rejected head", () => {
    const base = succeededHeadKnowledge();
    expect(
      resolveFirstCityDiscoverSucceededHeadBoundaryView({
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
      resolveFirstCityDiscoverSucceededHeadBoundaryView({
        ...base,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
    const rejected = {
      intent,
      template: base.records[0]!.template,
      state: { kind: "rejected" as const, reason: "terrain" as const },
    };
    expect(
      resolveFirstCityDiscoverSucceededHeadBoundaryView({
        ...base,
        head: { kind: "command", record: rejected },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = succeededHeadKnowledge();
  expect(resolveFirstCityDiscoverSucceededHeadBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverSucceededHeadBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityDiscoverSucceededHeadBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityDiscoverSucceededHeadBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(/不完整/);
});

it("formats succeeded-head copy with read-only Discover and owner hints", () => {
  const text = formatFirstCityDiscoverSucceededHeadBoundaryPanel(succeededHeadKnowledge());
  expect(text).toMatch(/Discover succeeded-head 边界/);
  expect(text).toMatch(/不得用重复 Discover 代替/);
  expect(text).toMatch(/§5\.2\(6\)/);
  expect(text).toMatch(/owner 校验/);
});