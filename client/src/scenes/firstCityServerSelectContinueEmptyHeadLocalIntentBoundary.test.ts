import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityContinueEmptyHeadLocalIntentBoundaryPanel,
  resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView,
} from "./firstCityServerSelectContinueEmptyHeadLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const localId = "33333333-3333-4333-8333-333333333333";

function emptyHeadWithJournal() {
  const localIntent = createFirstCityIntent(scope, {
    commandId: localId,
    predecessor: { kind: "empty" },
    name: "journal 草案",
    x: 8,
    y: 9,
  });
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "empty" as const },
    records: [],
    intents: [localIntent],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView", () => {
  it("reports retained when empty head and journal keeps latest intent", () => {
    const view = resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView(emptyHeadWithJournal());
    expect(view.kind).toBe("retained");
    if (view.kind !== "retained") return;
    expect(view.localCommandId).toBe(localId);
    expect(view.localName).toBe("journal 草案");
  });

  it("returns none without journal or on command head", () => {
    const knowledge = emptyHeadWithJournal();
    expect(resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe("none");
    const headId = "22222222-2222-4222-8222-222222222222";
    const headIntent = createFirstCityIntent(scope, {
      commandId: headId,
      predecessor: { kind: "empty" },
      name: "h",
      x: 1,
      y: 2,
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
    expect(
      resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "command", record },
        records: [record],
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const knowledge = emptyHeadWithJournal();
  expect(resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView(knowledge, true).kind).toBe("withheld");
  expect(resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView({ ...knowledge, unavailable: true }).reason).toBe(
    "unavailable",
  );
  expect(resolveFirstCityContinueEmptyHeadLocalIntentBoundaryView({ ...knowledge, incomplete: true }).reason).toBe(
    "incomplete",
  );
});

it("format panel mentions canOfferFirstCityContinue on retained journal", () => {
  const text = formatFirstCityContinueEmptyHeadLocalIntentBoundaryPanel(emptyHeadWithJournal());
  expect(text).toMatch(/Continue empty-head·本地 intent 边界/);
  expect(text).toMatch(/canOfferFirstCityContinue/);
  expect(text).toMatch(/resolveFirstCityContinueEmptyHeadBoundaryView/);
  expect(text).toMatch(localId);
});