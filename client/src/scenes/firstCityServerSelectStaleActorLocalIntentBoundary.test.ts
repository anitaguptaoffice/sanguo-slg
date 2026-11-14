import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityStaleActorLocalIntentBoundaryPanel,
  resolveFirstCityStaleActorLocalIntentBoundaryView,
} from "./firstCityServerSelectStaleActorLocalIntentBoundary";

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
    name: "规范 pending",
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

describe("resolveFirstCityStaleActorLocalIntentBoundaryView", () => {
  it("reports retained when stale and journal keeps latest intent", () => {
    const view = resolveFirstCityStaleActorLocalIntentBoundaryView(pendingHeadWithJournal(), true);
    expect(view.kind).toBe("retained");
    if (view.kind !== "retained") return;
    expect(view.headCommandId).toBe(headId);
    expect(view.localCommandId).toBe(localId);
  });

  it("withholds when actor is fresh or knowledge missing", () => {
    const knowledge = pendingHeadWithJournal();
    expect(resolveFirstCityStaleActorLocalIntentBoundaryView(null, true).reason).toBe("no-knowledge");
    expect(resolveFirstCityStaleActorLocalIntentBoundaryView(knowledge, false).reason).toBe("not-stale");
  });

  it("returns none when stale but journal empty", () => {
    const knowledge = pendingHeadWithJournal();
    expect(resolveFirstCityStaleActorLocalIntentBoundaryView({ ...knowledge, intents: [] }, true).kind).toBe("none");
  });
});

it("format panel mentions drift helpers on stale retained journal", () => {
  const text = formatFirstCityStaleActorLocalIntentBoundaryPanel(pendingHeadWithJournal(), true);
  expect(text).toMatch(/stale-actor·本地 intent 边界/);
  expect(text).toMatch(/firstCityActorBindingDrifted/);
  expect(text).toMatch(/firstCitySessionActorDrifted/);
  expect(text).toMatch(localId);
});