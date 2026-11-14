import { describe, expect, it } from "vitest";
import { createFirstCityIntent, type FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityKnowledge, reduceFirstCityKnowledge } from "@/net/firstCityKnowledge";
import {
  formatFirstCityHeadPredecessorPanel,
  resolveFirstCityHeadPredecessorView,
} from "./firstCityServerSelectHeadPredecessor";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const template = {
  templateVersion: "v1",
  rulesVersion: "r1",
  catalogVersion: "c1",
  contentEncodingVersion: 1,
  contentSha256: "abcdef",
};

const empty = () => createFirstCityKnowledge(scope);

function withEmptyHead() {
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  return reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
}

function headKnowledge(predecessor: { kind: "empty" } | { kind: "rejected"; commandId: string }, state: "pending" | "succeeded" | "rejected") {
  const commandId = "22222222-2222-4222-8222-222222222222";
  const intent = createFirstCityIntent(scope, {
    commandId,
    predecessor,
    name: "城",
    x: 0,
    y: 1,
  });
  const record =
    state === "pending"
      ? { intent, template, state: { kind: "pending" as const } }
      : state === "succeeded"
        ? {
            intent,
            template,
            state: {
              kind: "succeeded" as const,
              cityId: 9n,
              shard: 1,
              playerId: 7n,
              isCapital: true as const,
              wallLevel: 1 as const,
              morale: 100 as const,
            },
          }
        : {
            intent,
            template,
            state: { kind: "rejected" as const, reason: "terrain" as const },
          };
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record } };
  return reduceFirstCityKnowledge(empty(), {
    intents: [],
    observations: [discovery],
    unavailable: false,
  });
}

it("shows EMPTY predecessor on command head", () => {
  const knowledge = headKnowledge({ kind: "empty" }, "pending");
  const view = resolveFirstCityHeadPredecessorView(knowledge);
  expect(view.kind).toBe("predecessor");
  if (view.kind !== "predecessor") return;
  expect(view.predecessor).toEqual({ kind: "empty" });
  expect(formatFirstCityHeadPredecessorPanel(knowledge)).toMatch(/predecessor=EMPTY/);
});

it("shows rejected predecessor id", () => {
  const rejectedId = "33333333-3333-4333-8333-333333333333";
  const knowledge = headKnowledge({ kind: "rejected", commandId: rejectedId }, "pending");
  expect(formatFirstCityHeadPredecessorPanel(knowledge)).toMatch(rejectedId);
  expect(formatFirstCityHeadPredecessorPanel(knowledge)).toMatch(/rejected/);
});

it("hints successor after rejected head", () => {
  const rejectedId = "33333333-3333-4333-8333-333333333333";
  const knowledge = headKnowledge({ kind: "empty" }, "rejected");
  expect(formatFirstCityHeadPredecessorPanel(knowledge)).toMatch(/exact predecessor/);
  const withPred = headKnowledge({ kind: "rejected", commandId: rejectedId }, "rejected");
  expect(formatFirstCityHeadPredecessorPanel(withPred)).toMatch(/exact predecessor/);
});

it("withholds without knowledge, on stale-actor, unavailable, and incomplete", () => {
  expect(formatFirstCityHeadPredecessorPanel(null)).toBe("");
  expect(formatFirstCityHeadPredecessorPanel(headKnowledge({ kind: "empty" }, "pending"), true)).toBe("");
  expect(formatFirstCityHeadPredecessorPanel({ ...headKnowledge({ kind: "empty" }, "pending"), unavailable: true })).toMatch(/不可用/);
  expect(formatFirstCityHeadPredecessorPanel({ ...headKnowledge({ kind: "empty" }, "pending"), incomplete: true })).toMatch(/不完整/);
  expect(formatFirstCityHeadPredecessorPanel({ ...headKnowledge({ kind: "empty" }, "pending"), head: null })).toMatch(/不完整/);
});

it("returns none when durable head is EMPTY", () => {
  expect(resolveFirstCityHeadPredecessorView(withEmptyHead()).kind).toBe("none");
  expect(formatFirstCityHeadPredecessorPanel(withEmptyHead())).toBe("");
});
