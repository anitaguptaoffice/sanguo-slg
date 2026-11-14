import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityDiscoverRejectedHeadLocalIntentBoundaryPanel,
  resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView,
} from "./firstCityServerSelectDiscoverRejectedHeadLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const headId = "22222222-2222-4222-8222-222222222222";
const localId = "33333333-3333-4333-8333-333333333333";

function rejectedHeadWithJournal(reason: "terrain" | "coordinateOccupied" = "terrain") {
  const headIntent = createFirstCityIntent(scope, {
    commandId: headId,
    predecessor: { kind: "empty" },
    name: "拒收演示城",
    x: 4,
    y: 5,
  });
  const record = {
    intent: headIntent,
    template: {
      templateVersion: "v1",
      rulesVersion: "r1",
      catalogVersion: "c1",
      contentEncodingVersion: 1,
      contentSha256: "00",
    },
    state: { kind: "rejected" as const, reason },
  };
  const localIntent = createFirstCityIntent(scope, {
    commandId: localId,
    predecessor: { kind: "empty" },
    name: "journal 最近草案",
    x: 1,
    y: 2,
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

describe("resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView", () => {
  it("reports retained when rejected head and journal keeps latest intent", () => {
    const view = resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView(rejectedHeadWithJournal());
    expect(view.kind).toBe("retained");
    if (view.kind !== "retained") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.headReason).toBe("terrain");
    expect(view.localCommandId).toBe(localId);
  });

  it("returns none without journal or on non-rejected head", () => {
    const knowledge = rejectedHeadWithJournal();
    expect(resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe(
      "none",
    );
    expect(
      resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const pending = { ...knowledge.head.record, state: { kind: "pending" as const } };
    expect(
      resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const knowledge = rejectedHeadWithJournal();
  expect(resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView(knowledge, true).kind).toBe("withheld");
  expect(
    resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView({ ...knowledge, unavailable: true }).reason,
  ).toBe("unavailable");
  expect(
    resolveFirstCityDiscoverRejectedHeadLocalIntentBoundaryView({ ...knowledge, incomplete: true }).reason,
  ).toBe("incomplete");
});

it("format panel mentions resolveFirstCityDiscoverRejectedHeadBoundaryView on retained journal", () => {
  const text = formatFirstCityDiscoverRejectedHeadLocalIntentBoundaryPanel(rejectedHeadWithJournal());
  expect(text).toMatch(/Discover rejected-head·本地 intent 边界/);
  expect(text).toMatch(/resolveFirstCityDiscoverRejectedHeadBoundaryView/);
  expect(text).toMatch(localId);
});