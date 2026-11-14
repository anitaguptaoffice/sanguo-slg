import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityPendingIntakeLocalIntentBoundaryPanel,
  resolveFirstCityPendingIntakeLocalIntentBoundaryView,
} from "./firstCityServerSelectPendingIntakeLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const headId = "22222222-2222-4222-8222-222222222222";
const localId = "33333333-3333-4333-8333-333333333333";

function headWithLatestLocal(localName = "本地草案城", x = 8, y = 9) {
  const headIntent = createFirstCityIntent(scope, {
    commandId: headId,
    predecessor: { kind: "empty" },
    name: "规范Head城",
    x: 12,
    y: 34,
  });
  const record = {
    intent: headIntent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "pending" as const },
  };
  const localIntent = createFirstCityIntent(scope, {
    commandId: localId,
    predecessor: { kind: "empty" },
    name: localName,
    x,
    y,
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

describe("resolveFirstCityPendingIntakeLocalIntentBoundaryView", () => {
  it("reports mismatch when latest local intent commandId differs from head", () => {
    const view = resolveFirstCityPendingIntakeLocalIntentBoundaryView(headWithLatestLocal());
    expect(view.kind).toBe("mismatch");
    if (view.kind !== "mismatch") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.localCommandId).toBe(localId);
    expect(view.localName).toBe("本地草案城");
    expect(view.headName).toBe("规范Head城");
  });

  it("returns none without local intent, matching head id, or empty head", () => {
    const knowledge = headWithLatestLocal();
    expect(resolveFirstCityPendingIntakeLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe("none");
    const sameIdLocal = createFirstCityIntent(scope, {
      commandId: headId,
      predecessor: { kind: "empty" },
      name: "x",
      x: 1,
      y: 2,
    });
    expect(
      resolveFirstCityPendingIntakeLocalIntentBoundaryView({ ...knowledge, intents: [sameIdLocal] }).kind,
    ).toBe("none");
    expect(resolveFirstCityPendingIntakeLocalIntentBoundaryView({ ...knowledge, head: { kind: "empty" } }).kind).toBe(
      "none",
    );
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const base = headWithLatestLocal();
  expect(resolveFirstCityPendingIntakeLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityPendingIntakeLocalIntentBoundaryView(base, true).reason).toBe("stale-actor");
  expect(formatFirstCityPendingIntakeLocalIntentBoundaryPanel({ ...base, unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityPendingIntakeLocalIntentBoundaryPanel({ ...base, incomplete: true, head: null })).toMatch(
    /不完整/,
  );
});

it("formats mismatch copy with head and local labels", () => {
  const text = formatFirstCityPendingIntakeLocalIntentBoundaryPanel(headWithLatestLocal());
  expect(text).toMatch(/PENDING 接收·本地 intent 边界/);
  expect(text).toMatch(/规范Head城/);
  expect(text).toMatch(/本地草案城/);
  expect(text).toMatch(/resolveFirstCityPendingIntakeView/);
  expect(text).toMatch(/不以 journal 最近保留 intent 为准/);
});