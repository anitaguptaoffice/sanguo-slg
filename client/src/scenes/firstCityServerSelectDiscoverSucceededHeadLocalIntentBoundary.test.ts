import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityDiscoverSucceededHeadLocalIntentBoundaryPanel,
  resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView,
} from "./firstCityServerSelectDiscoverSucceededHeadLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const headId = "22222222-2222-4222-8222-222222222222";
const localId = "33333333-3333-4333-8333-333333333333";

function succeededHeadWithJournal(cityId = 99n) {
  const headIntent = createFirstCityIntent(scope, {
    commandId: headId,
    predecessor: { kind: "empty" },
    name: "成功演示城",
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
    state: { kind: "succeeded" as const, cityId },
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

describe("resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView", () => {
  it("reports retained when succeeded head and journal keeps latest intent", () => {
    const view = resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView(succeededHeadWithJournal());
    expect(view.kind).toBe("retained");
    if (view.kind !== "retained") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.headCityId).toBe(99n);
    expect(view.localCommandId).toBe(localId);
  });

  it("returns none without journal or on non-succeeded head", () => {
    const knowledge = succeededHeadWithJournal();
    expect(resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView({ ...knowledge, intents: [] }).kind).toBe(
      "none",
    );
    expect(
      resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "empty" },
      }).kind,
    ).toBe("none");
    const pending = { ...knowledge.head.record, state: { kind: "pending" as const } };
    expect(
      resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView({
        ...knowledge,
        head: { kind: "command", record: pending },
      }).kind,
    ).toBe("none");
  });
});

it("withholds on stale-actor, unavailable, and incomplete", () => {
  const knowledge = succeededHeadWithJournal();
  expect(resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView(null).reason).toBe("no-knowledge");
  expect(resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView(knowledge, true).kind).toBe("withheld");
  expect(
    resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView({ ...knowledge, unavailable: true }).reason,
  ).toBe("unavailable");
  expect(
    resolveFirstCityDiscoverSucceededHeadLocalIntentBoundaryView({ ...knowledge, incomplete: true }).reason,
  ).toBe("incomplete");
});

it("format panel mentions resolveFirstCityDiscoverSucceededHeadBoundaryView on retained journal", () => {
  const text = formatFirstCityDiscoverSucceededHeadLocalIntentBoundaryPanel(succeededHeadWithJournal());
  expect(text).toMatch(/Discover succeeded-head·本地 intent 边界/);
  expect(text).toMatch(/resolveFirstCityDiscoverSucceededHeadBoundaryView/);
  expect(text).toMatch(localId);
});