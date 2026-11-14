import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityDiscoverPendingHeadLocalIntentBoundaryPanel,
  resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView,
} from "./firstCityServerSelectDiscoverPendingHeadLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const headId = "22222222-2222-4222-8222-222222222222";
const localId = "33333333-3333-4333-8333-333333333333";

function pendingHeadWithJournal() {
  const headIntent = createFirstCityIntent(scope, {
    commandId: headId,
    predecessor: { kind: "empty" },
    name: "pending 演示城",
    x: 9,
    y: 10,
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
    state: { kind: "pending" as const },
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

describe("resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView", () => {
  it("reports retained when pending head and journal keeps latest intent", () => {
    const view = resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView(pendingHeadWithJournal());
    expect(view.kind).toBe("retained");
    if (view.kind !== "retained") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.localCommandId).toBe(localId);
  });

  it("returns none without journal or on non-pending head", () => {
    const knowledge = pendingHeadWithJournal();
    expect(resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe("none");
    expect(
      resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const succeeded = {
      ...knowledge.head.record,
      state: { kind: "succeeded" as const },
    };
    expect(
      resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const knowledge = pendingHeadWithJournal();
  expect(resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView(knowledge, true).kind).toBe("withheld");
  expect(
    resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView({ ...knowledge, unavailable: true }).reason,
  ).toBe("unavailable");
  expect(
    resolveFirstCityDiscoverPendingHeadLocalIntentBoundaryView({ ...knowledge, incomplete: true }).reason,
  ).toBe("incomplete");
});

it("format panel mentions resolveFirstCityDiscoverPendingHeadBoundaryView on retained journal", () => {
  const text = formatFirstCityDiscoverPendingHeadLocalIntentBoundaryPanel(pendingHeadWithJournal());
  expect(text).toMatch(/Discover pending-head·本地 intent 边界/);
  expect(text).toMatch(/resolveFirstCityDiscoverPendingHeadBoundaryView/);
  expect(text).toMatch(/Discover 须显式点击/);
  expect(text).toMatch(localId);
});