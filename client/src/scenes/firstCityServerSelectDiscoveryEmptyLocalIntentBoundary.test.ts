import { describe, expect, it } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityDiscoveryEmptyLocalIntentBoundaryPanel,
  resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView,
} from "./firstCityServerSelectDiscoveryEmptyLocalIntentBoundary";

const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const localId = "33333333-3333-4333-8333-333333333333";
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "00",
};

function emptyHeadWithJournal(localName = "journal 草案城") {
  const localIntent = createFirstCityIntent(scope, {
    commandId: localId,
    predecessor: { kind: "empty" },
    name: localName,
    x: 8,
    y: 9,
  });
  return {
    ...createFirstCityKnowledge(scope),
    head: { kind: "empty" as const },
    intents: [localIntent],
    incomplete: false,
    unavailable: false,
  };
}

describe("resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView", () => {
  it("reports mismatch when empty head retains journal latest local intent", () => {
    const view = resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView(emptyHeadWithJournal());
    expect(view.kind).toBe("mismatch");
    if (view.kind !== "mismatch") return;
    expect(view.localCommandId).toBe(localId);
    expect(view.localName).toBe("journal 草案城");
    expect(view.localX).toBe(8);
    expect(view.localY).toBe(9);
  });

  it("returns none without journal, on command head, or when ids would be N/A", () => {
    const noJournal = { ...createFirstCityKnowledge(scope), head: { kind: "empty" as const }, intents: [] };
    expect(resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView(noJournal).kind).toBe("none");
    const intent = createFirstCityIntent(scope, {
      commandId: "44444444-4444-4444-8444-444444444444",
      predecessor: { kind: "empty" },
      name: "城",
      x: 1,
      y: 2,
    });
    const record = { intent, template, state: { kind: "pending" as const } };
    const commandHead = {
      ...createFirstCityKnowledge(scope),
      head: { kind: "command" as const, record },
      records: [record],
      intents: [intent],
    };
    expect(resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView(commandHead).kind).toBe("none");
  });

  it("withholds on unavailable, incomplete, and stale-actor", () => {
    const knowledge = emptyHeadWithJournal();
    expect(resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView({ ...knowledge, unavailable: true }).kind).toBe(
      "withheld",
    );
    expect(
      resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView({ ...knowledge, incomplete: true, head: null }).kind,
    ).toBe("withheld");
    expect(resolveFirstCityDiscoveryEmptyLocalIntentBoundaryView(knowledge, true).kind).toBe("withheld");
  });
});

describe("formatFirstCityDiscoveryEmptyLocalIntentBoundaryPanel", () => {
  it("surfaces EMPTY journal boundary copy on mismatch", () => {
    const text = formatFirstCityDiscoveryEmptyLocalIntentBoundaryPanel(emptyHeadWithJournal());
    expect(text).toMatch(/actor discovery EMPTY·本地 intent 边界/);
    expect(text).toMatch(/resolveFirstCityDiscoveryEmptyView/);
    expect(text).toMatch(/不以 journal 最近保留 intent 为准/);
    expect(text).toMatch(/NOT_OBSERVED/);
    expect(text).toMatch(/Continue\/Submit 须显式点击/);
  });

  it("returns empty string on none and stale-actor", () => {
    const noJournal = { ...createFirstCityKnowledge(scope), head: { kind: "empty" as const }, intents: [] };
    expect(formatFirstCityDiscoveryEmptyLocalIntentBoundaryPanel(noJournal)).toBe("");
    expect(formatFirstCityDiscoveryEmptyLocalIntentBoundaryPanel(emptyHeadWithJournal(), true)).toBe("");
  });
});