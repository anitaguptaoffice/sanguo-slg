import { createFirstCityIntent, validateFirstCityScope, validateFirstCityUuid } from "./firstCityCanonical";
import type { FirstCityIntent, FirstCityScope } from "./firstCityCanonical";

type Grammar = "response" | "discovery" | "outcome" | "head" | "record" | "canonical" |
  "template" | "success" | "rejection" | "scope" | "proposal" | "predecessor" | "empty";
type Field = Grammar | "text" | "bytes" | "i32" | "u32" | "i64" | "bool";
type Wire = Record<number, unknown>;
const grammar: Record<Grammar, readonly Field[]> = {
  response: ["outcome"], discovery: ["scope", "head"],
  outcome: ["scope", "i32", "text", "record", "head"], head: ["empty", "record"],
  record: ["canonical", "template", "empty", "success", "rejection"],
  canonical: ["scope", "text", "u32", "u32", "proposal"],
  template: ["text", "text", "text", "u32", "bytes"],
  success: ["i64", "i32", "i64", "bool", "i32", "i32"], rejection: ["i32"],
  scope: ["text", "i32", "i64", "i64"], proposal: ["text", "predecessor", "text", "i32", "i32"],
  predecessor: ["empty", "text"], empty: [],
};
const routes = {
  "world.v2.SubmitFirstCity": [1, 2, 3], "world.v2.ContinueFirstCity": [1, 2, 4],
  "world.v2.GetFirstCityResult": [1, 4], "world.v2.DiscoverFirstCityIntent": [],
} as const;
const invalid = (): never => { throw new TypeError("Invalid first-city response"); };
const arrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!;
const limits: Partial<Record<Field, bigint>> = { i32: 2147483647n, u32: 4294967295n, i64: 9223372036854775807n, bool: 1n };
const nested = (value: Wire, key: number): Wire => value[key] as Wire;
const same = (a: object, b: object): boolean => Object.keys(a).every(key => Reflect.get(a, key) === Reflect.get(b, key));

export type FirstCityState = Readonly<
  { kind: "pending" } | { kind: "rejected"; reason: "terrain" | "coordinateOccupied" } |
  { kind: "succeeded"; cityId: bigint; shard: number; playerId: bigint; isCapital: true; wallLevel: 1; morale: 100 }
>;
export type FirstCityRecord = Readonly<{
  intent: FirstCityIntent;
  template: Readonly<{ templateVersion: string; rulesVersion: string; catalogVersion: string;
    contentEncodingVersion: number; contentSha256: string }>;
  state: FirstCityState;
}>;
export type FirstCityHead = Readonly<{ kind: "empty" } | { kind: "command"; record: FirstCityRecord }>;
export type FirstCityResponse = Readonly<
  { kind: "discovery"; scope: FirstCityScope; head: FirstCityHead } |
  { kind: "command" | "idContentConflict" | "headConflict" | "notObserved";
    scope: FirstCityScope; requestedCommandId: string; command: FirstCityRecord | null; head: FirstCityHead }
>;

// Parse the closed grammar without protobuf's duplicate merging, defaults or number conversions.
function parse(bytes: Uint8Array, kind: Grammar, utf8: TextDecoder, depth = 0): Wire {
  if (depth > 8) invalid();
  let offset = 0;
  const value: Wire = {};
  const varint = (maximum: bigint): bigint => {
    let result = 0n;
    for (let index = 0; index < 10; index++) {
      if (offset === bytes.length) invalid();
      const octet = bytes[offset++];
      result |= BigInt(octet & 127) << BigInt(index * 7);
      if (result > maximum) invalid();
      if (octet < 128) {
        if (index > 0 && octet === 0) invalid();
        return result;
      }
    }
    return invalid();
  };
  while (offset < bytes.length) {
    const tag = Number(varint(0xffffffffn));
    const id = Math.floor(tag / 8);
    const field = grammar[kind][id - 1];
    if (!id || !field || Object.hasOwn(value, id)) invalid();
    const maximum = limits[field];
    if (tag % 8 !== (maximum === undefined ? 2 : 0)) invalid();
    if (maximum !== undefined) value[id] = varint(maximum);
    else {
      const length = Number(varint(0xffffffffn));
      if (length > bytes.length - offset) invalid();
      const part = bytes.subarray(offset, offset + length);
      value[id] = field === "text" ? utf8.decode(part) : field === "bytes" ? part : parse(part, field as Grammar, utf8, depth + 1);
      offset += length;
    }
  }
  const oneof = kind === "record" ? 3 : kind === "head" || kind === "predecessor" ? 1 : 0;
  for (let id = 1; id <= grammar[kind].length; id++) {
    if ((oneof && id >= oneof) || (kind === "outcome" && id === 4)) continue;
    if (!Object.hasOwn(value, id)) invalid();
  }
  if (oneof && Object.keys(value).filter(id => Number(id) >= oneof).length !== 1) invalid();
  return value;
}

function scope(value: Wire): FirstCityScope {
  return validateFirstCityScope({ realmId: value[1], shard: Number(value[2]), playerId: value[3], accountId: value[4] });
}
function label(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(value)) return invalid();
  return value;
}
function record(value: Wire, expected: FirstCityScope): FirstCityRecord {
  const canonical = nested(value, 1);
  if (canonical[2] !== "world.first_city" || canonical[3] !== 2n || canonical[4] !== 1n) invalid();
  const actualScope = scope(nested(canonical, 1));
  if (!same(actualScope, expected)) invalid();
  const proposal = nested(canonical, 5);
  const predecessor = nested(proposal, 2);
  const intent = createFirstCityIntent(actualScope, {
    commandId: proposal[1], name: proposal[3], x: Number(proposal[4]), y: Number(proposal[5]),
    predecessor: Object.hasOwn(predecessor, 1) ? { kind: "empty" } : { kind: "rejected", commandId: predecessor[2] },
  });
  const ref = nested(value, 2);
  const digest = ref[5] as Uint8Array;
  if (ref[4] === 0n || digest.length !== 32) invalid();
  const template = Object.freeze({
    templateVersion: label(ref[1]), rulesVersion: label(ref[2]), catalogVersion: label(ref[3]),
    contentEncodingVersion: Number(ref[4]), contentSha256: Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join(""),
  });
  let state: FirstCityState;
  if (Object.hasOwn(value, 3)) state = Object.freeze({ kind: "pending" });
  else if (Object.hasOwn(value, 4)) {
    const success = nested(value, 4);
    if (success[1] === 0n || success[2] !== BigInt(expected.shard) || success[3] !== expected.playerId ||
      success[4] !== 1n || success[5] !== 1n || success[6] !== 100n) invalid();
    state = Object.freeze({ kind: "succeeded", cityId: success[1] as bigint, shard: expected.shard,
      playerId: expected.playerId, isCapital: true, wallLevel: 1, morale: 100 });
  } else {
    const reason = nested(value, 5)[1];
    if (reason !== 1n && reason !== 2n) invalid();
    state = Object.freeze({ kind: "rejected", reason: reason === 1n ? "terrain" : "coordinateOccupied" });
  }
  return Object.freeze({ intent, template, state });
}
function head(value: Wire, expected: FirstCityScope): FirstCityHead {
  return Object.hasOwn(value, 1) ? Object.freeze({ kind: "empty" }) :
    Object.freeze({ kind: "command", record: record(nested(value, 2), expected) });
}
function sameRecord(a: FirstCityRecord, b: FirstCityRecord): boolean {
  return a.intent.matches(b.intent.encode()) && same(a.template, b.template) && same(a.state, b.state) && same(b.state, a.state);
}

/** Payload-only validation. Packet/session/trace and original-request correlation remain mandatory. */
export function decodeFirstCityResponse(route: unknown, input: unknown): FirstCityResponse {
  try {
    if (typeof route !== "string" || !Object.hasOwn(routes, route) || !(input instanceof Uint8Array)) return invalid();
    const length = arrayLength.call(input);
    if (length > 16384) invalid();
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index++) bytes[index] = input[index];
    const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    if (!utf8.fatal || !utf8.ignoreBOM) invalid();
    const allowed: readonly number[] = routes[route as keyof typeof routes];
    const discovery = allowed.length === 0;
    const parsed = parse(bytes, discovery ? "discovery" : "response", utf8);
    const body = discovery ? parsed : nested(parsed, 1);
    const actualScope = scope(nested(body, 1));
    const current = head(nested(body, discovery ? 2 : 5), actualScope);
    if (discovery) return Object.freeze({ kind: "discovery", scope: actualScope, head: current });
    const kind = Number(body[2]);
    if (!allowed.includes(kind)) invalid();
    const requestedCommandId = validateFirstCityUuid(body[3]);
    const hasCommand = Object.hasOwn(body, 4);
    if (hasCommand !== (kind === 1 || kind === 2)) invalid();
    const command = hasCommand ? record(nested(body, 4), actualScope) : null;
    const currentId = current.kind === "command" ? current.record.intent.proposal.commandId : null;
    const previousHead = current.kind === "command" ? current.record.intent.proposal.predecessor : null;
    const previousHeadId = previousHead?.kind === "rejected" ? previousHead.commandId : null;
    if ((kind === 3 || kind === 4) && [currentId, previousHeadId].includes(requestedCommandId)) invalid();
    if (command) {
      if (command.intent.proposal.commandId !== requestedCommandId || current.kind === "empty") invalid();
      if (current.kind === "command" && currentId === requestedCommandId && !sameRecord(command, current.record)) invalid();
      if (command.state.kind !== "rejected" && currentId !== requestedCommandId) invalid();
      if (currentId !== requestedCommandId) {
        const previous = command.intent.proposal.predecessor;
        if (previousHeadId === null || (previous.kind === "rejected" &&
          (previous.commandId === currentId || previous.commandId === previousHeadId))) invalid();
      }
    }
    const kinds = ["command", "idContentConflict", "headConflict", "notObserved"] as const;
    return Object.freeze({ kind: kinds[kind - 1], scope: actualScope, requestedCommandId, command, head: current });
  } catch { return invalid(); }
}
