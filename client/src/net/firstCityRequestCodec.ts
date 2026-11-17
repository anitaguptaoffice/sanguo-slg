import protobuf from "protobufjs";
import { getProtoRoot } from "./loadProto";
import { createFirstCityIntent, validateFirstCityScope, validateFirstCityUuid } from "./firstCityCanonical";
import type { FirstCityScope, FirstCityProposal } from "./firstCityCanonical";

type Grammar = "submit" | "get" | "empty" | "scope" | "proposal" | "predecessor";
type Field = Grammar | "text" | "i32" | "i64";
const grammar: Record<Grammar, readonly Field[]> = {
  submit: ["scope", "proposal"], get: ["scope", "text"], empty: [],
  scope: ["text", "i32", "i64", "i64"],
  proposal: ["text", "predecessor", "text", "i32", "i32"],
  predecessor: ["empty", "text"],
};
const routes = {
  "world.v2.SubmitFirstCity": "submit", "world.v2.ContinueFirstCity": "submit",
  "world.v2.GetFirstCityResult": "get", "world.v2.DiscoverFirstCityIntent": "empty",
} as const;
export type FirstCityRequest = Readonly<
  { expectedScope: FirstCityScope; proposal: FirstCityProposal } |
  { expectedScope: FirstCityScope; commandId: string } | Record<string, never>
>;
const invalid = (): never => { throw new TypeError("Invalid first-city request"); };
const arrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!;

function boundary(route: unknown) {
  if (typeof route !== "string" || !Object.hasOwn(routes, route)) return invalid();
  const Long = protobuf.util.Long;
  if (!Long) invalid();
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  if (!utf8.fatal || !utf8.ignoreBOM) invalid();
  return {
    kind: routes[route as keyof typeof routes], utf8,
    type: getProtoRoot().lookupType(`sanguo.${route}Request`),
  };
}

function fields(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) invalid();
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    if (!Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value")) invalid();
    copy[key] = descriptors[key].value;
  }
  return copy;
}

function snapshot(kind: Grammar, value: unknown): FirstCityRequest {
  const input = fields(value, kind === "empty" ? [] : ["expectedScope", kind === "get" ? "commandId" : "proposal"]);
  if (kind === "empty") return Object.freeze({});
  if (kind === "get") return Object.freeze({
    expectedScope: validateFirstCityScope(input.expectedScope), commandId: validateFirstCityUuid(input.commandId),
  });
  const intent = createFirstCityIntent(input.expectedScope, input.proposal);
  return Object.freeze({ expectedScope: intent.scope, proposal: intent.proposal });
}

// Closed request grammar only. All bounds are checked before making a nested view.
function validateWire(bytes: Uint8Array, kind: Grammar, utf8: TextDecoder, depth = 0): void {
  if (depth > 8) invalid();
  let offset = 0;
  const seen = new Set<number>();
  const varint = (maximum: bigint): bigint => {
    let value = 0n;
    for (let index = 0; index < 10; index++) {
      if (offset === bytes.length) invalid();
      const octet = bytes[offset++];
      value |= BigInt(octet & 127) << BigInt(index * 7);
      if (value > maximum) invalid();
      if (octet < 128) {
        if (index > 0 && octet === 0) invalid();
        return value;
      }
    }
    return invalid();
  };
  while (offset < bytes.length) {
    const tag = Number(varint(0xffffffffn));
    const id = Math.floor(tag / 8);
    const field = grammar[kind][id - 1];
    if (!id || !field || seen.has(id)) invalid();
    seen.add(id);
    const scalar = field === "i32" || field === "i64";
    if (tag % 8 !== (scalar ? 0 : 2)) invalid();
    if (scalar) varint(field === "i32" ? 2147483647n : 9223372036854775807n);
    else {
      const length = Number(varint(0xffffffffn));
      if (length > bytes.length - offset) invalid();
      const part = bytes.subarray(offset, offset + length);
      if (field === "text") utf8.decode(part);
      else validateWire(part, field, utf8, depth + 1);
      offset += length;
    }
  }
  if (seen.size !== (kind === "predecessor" ? 1 : grammar[kind].length)) invalid();
}

/** Fresh binary payload only. This neither sends nor authenticates an operation. */
export function encodeFirstCityRequest(route: unknown, value: unknown): Uint8Array {
  try {
    const { kind, type } = boundary(route);
    const input = snapshot(kind, value);
    if (!("expectedScope" in input)) return new Uint8Array();
    const s = input.expectedScope;
    const payload: Record<string, unknown> = { expected_scope: {
      realm_id: s.realmId, server_id: s.shard, player_id: s.playerId.toString(), account_id: s.accountId.toString(),
    } };
    if ("commandId" in input) payload.command_id = input.commandId;
    else {
      const p = input.proposal as FirstCityProposal;
      payload.proposal = {
        command_id: p.commandId, name: p.name, x: p.x, y: p.y,
        predecessor: p.predecessor.kind === "empty" ? { empty: {} } : { rejected_command_id: p.predecessor.commandId },
      };
    }
    return Uint8Array.from(type.encode(type.fromObject(payload)).finish());
  } catch { return invalid(); }
}

/** Validate raw bytes before protobufjs can merge duplicates or repair UTF-8. */
export function decodeFirstCityRequest(route: unknown, value: unknown): FirstCityRequest {
  try {
    const { kind, type, utf8 } = boundary(route);
    if (!(value instanceof Uint8Array)) return invalid();
    const length = arrayLength.call(value);
    if (length > 2048) invalid();
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index++) bytes[index] = value[index];
    validateWire(bytes, kind, utf8);
    const message = type.decode(bytes) as protobuf.Message & { expected_scope?: { player_id: unknown; account_id: unknown } };
    if (kind !== "empty" && (!(message.expected_scope?.player_id instanceof protobuf.util.Long) ||
      !(message.expected_scope?.account_id instanceof protobuf.util.Long))) invalid();
    const decoded = type.toObject(message, { longs: String });
    if (kind === "empty") return snapshot(kind, {});
    const s = decoded.expected_scope;
    const expectedScope = { realmId: s.realm_id, shard: s.server_id, playerId: s.player_id, accountId: s.account_id };
    if (kind === "get") return snapshot(kind, { expectedScope, commandId: decoded.command_id });
    const p = decoded.proposal;
    const predecessor = Object.hasOwn(p.predecessor, "empty") ? { kind: "empty" } : {
      kind: "rejected", commandId: p.predecessor.rejected_command_id,
    };
    return snapshot(kind, { expectedScope, proposal: { commandId: p.command_id, predecessor, name: p.name, x: p.x, y: p.y } });
  } catch { return invalid(); }
}
