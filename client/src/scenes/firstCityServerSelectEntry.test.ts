import { expect, it } from "vitest";
import { createFirstCityKnowledge } from "@/net/firstCityKnowledge";
import { formatFirstCityProbeStatus, permitsFirstCityV2Probe } from "./firstCityServerSelectEntry";
import type { FirstCityScope } from "@/net/firstCityCanonical";

const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1,
  playerId: 1n, accountId: 2n };

it.each([
  ["ws://127.0.0.1:8080/ws", true], ["ws://localhost:8080/ws", true], ["ws://[::1]:8080/ws", true],
  ["wss://game.example/ws", false], ["wss://127.0.0.1:8080/ws", false], ["ws://game.example/ws", false],
  ["wss://name:secret@localhost/ws", false],
])("probe transport boundary %s", (url, allowed) => expect(permitsFirstCityV2Probe(url)).toBe(allowed));
it("describes empty durable head without implying playability", () => {
  const knowledge = createFirstCityKnowledge(scope);
  expect(formatFirstCityProbeStatus({ ...knowledge, head: { kind: "empty" } })).toContain("不");
});
