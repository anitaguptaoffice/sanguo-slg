import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityIdContentConflictLocalIntentBoundaryPanel,
  resolveFirstCityIdContentConflictLocalIntentBoundaryView,
} from "./firstCityServerSelectIdContentConflictLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const headId = "22222222-2222-4222-8222-222222222222";
const localId = "33333333-3333-4333-8333-333333333333";
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};

function headWithLatestLocal(state: "succeeded" | "rejected" | "pending" = "pending", localName = "冲突提案城") {
  const headIntent = createFirstCityIntent(scope, {
    commandId: headId,
    predecessor: { kind: "empty" },
    name: "server原始城",
    x: 12,
    y: 34,
  });
  const record = {
    intent: headIntent,
    template,
    state:
      state === "succeeded"
        ? ({
            kind: "succeeded" as const,
            cityId: 99n,
            shard: 1,
            playerId: 7n,
            isCapital: true as const,
            wallLevel: 1 as const,
            morale: 100 as const,
          } as const)
        : state === "rejected"
          ? ({ kind: "rejected" as const, reason: "terrain" as const } as const)
          : ({ kind: "pending" as const } as const),
  };
  const localIntent = createFirstCityIntent(scope, {
    commandId: localId,
    predecessor: { kind: "empty" },
    name: localName,
    x: 8,
    y: 9,
  });
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "command" as const, record },
    records: [record],
    intents: [localIntent],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityIdContentConflictLocalIntentBoundaryView", () => {
  it("reports mismatch when latest local intent commandId differs from head", () => {
    const view = resolveFirstCityIdContentConflictLocalIntentBoundaryView(headWithLatestLocal());
    expect(view.kind).toBe("mismatch");
    if (view.kind !== "mismatch") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.localCommandId).toBe(localId);
    expect(view.headState).toBe("pending");
  });

  it("returns none without local intent, matching head id, or empty head", () => {
    const knowledge = headWithLatestLocal();
    expect(resolveFirstCityIdContentConflictLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe("none");
    const sameIdLocal = createFirstCityIntent(scope, {
      commandId: headId,
      predecessor: { kind: "empty" },
      name: "x",
      x: 1,
      y: 2,
    });
    expect(
      resolveFirstCityIdContentConflictLocalIntentBoundaryView({ ...knowledge, intents: [sameIdLocal] }).kind,
    ).toBe("none");
    expect(
      resolveFirstCityIdContentConflictLocalIntentBoundaryView({ ...knowledge, head: { kind: "empty" } }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = headWithLatestLocal();
  expect(resolveFirstCityIdContentConflictLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityIdContentConflictLocalIntentBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityIdContentConflictLocalIntentBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityIdContentConflictLocalIntentBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(
    /不完整/,
  );
});

it("formats mismatch copy with head and local labels", () => {
  const text = formatFirstCityIdContentConflictLocalIntentBoundaryPanel(headWithLatestLocal());
  expect(text).toMatch(/ID_CONTENT_CONFLICT·本地 intent 边界/);
  expect(text).toMatch(/server原始城/);
  expect(text).toMatch(/冲突提案城/);
  expect(text).toMatch(/collectIdContentConflicts/);
  expect(text).toMatch(/不以 journal 最近保留 intent 为准/);
});