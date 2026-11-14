import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityContinuePendingHeadLocalIntentBoundaryPanel,
  resolveFirstCityContinuePendingHeadLocalIntentBoundaryView,
} from "./firstCityServerSelectContinuePendingHeadLocalIntentBoundary";

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

describe("resolveFirstCityContinuePendingHeadLocalIntentBoundaryView", () => {
  it("reports retained when pending head and journal keeps latest intent", () => {
    const view = resolveFirstCityContinuePendingHeadLocalIntentBoundaryView(pendingHeadWithJournal());
    expect(view.kind).toBe("retained");
    if (view.kind !== "retained") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.localCommandId).toBe(localId);
  });

  it("returns none without journal or on non-pending head", () => {
    const knowledge = pendingHeadWithJournal();
    expect(resolveFirstCityContinuePendingHeadLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe("none");
    expect(
      resolveFirstCityContinuePendingHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const succeeded = {
      ...knowledge.head.record,
      state: { kind: "succeeded" as const },
    };
    expect(
      resolveFirstCityContinuePendingHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "command", record: succeeded },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const knowledge = pendingHeadWithJournal();
  expect(resolveFirstCityContinuePendingHeadLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityContinuePendingHeadLocalIntentBoundaryView(knowledge, true).kind).toBe("withheld");
  expect(resolveFirstCityContinuePendingHeadLocalIntentBoundaryView({ ...knowledge, unavailable: true }).reason).toBe(
    "unavailable",
  );
  expect(resolveFirstCityContinuePendingHeadLocalIntentBoundaryView({ ...knowledge, incomplete: true }).reason).toBe(
    "incomplete",
  );
});

it("format panel mentions resolveFirstCityContinuePendingHeadBoundaryView on retained journal", () => {
  const text = formatFirstCityContinuePendingHeadLocalIntentBoundaryPanel(pendingHeadWithJournal());
  expect(text).toMatch(/Continue pending-head·本地 intent 边界/);
  expect(text).toMatch(/resolveFirstCityContinuePendingHeadBoundaryView/);
  expect(text).toMatch(/canOfferFirstCityContinue/);
  expect(text).toMatch(/Continue 须显式点击/);
  expect(text).toMatch(localId);
});