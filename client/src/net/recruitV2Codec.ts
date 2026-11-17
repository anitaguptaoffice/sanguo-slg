import protobuf from "protobufjs";
import { getProtoRoot } from "./loadProto";

export type RecruitV2Intent = Readonly<{
  city_id: string | bigint; unit_cfg_id: number; count: number;
  command_id: Uint8Array; intent_version: number;
}>;
export type RecruitV2Acceptance = Readonly<{
  queue_id: string; city_id: string; unit_cfg_id: number; count: number;
  food_paid: string; wood_paid: string; iron_paid: string; stone_paid: string;
  duration_sec: string; initial_status: number; accepted_at_ms: string;
  initial_start_at_ms: string; initial_finish_at_ms: string;
  catalog_version: readonly number[]; rule_digest: readonly number[];
}>;
const MAX64 = (1n << 63n) - 1n;
const MIN_TIME = -62135596800000n, MAX_TIME = 253402300799999n;
function invalid(field: string): never { throw new RangeError(`Invalid Recruit V2 ${field}`); }
function integer(value: unknown, min: bigint, max: bigint, field: string): bigint {
  if (typeof value !== "bigint" && (typeof value !== "string" || !/^(0|-?[1-9][0-9]*)$/.test(value))) invalid(field);
  const n = BigInt(value as string | bigint);
  if (n < min || n > max) invalid(field);
  return n;
}
function small(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) invalid(field);
  return value as number;
}
function isBytes(value: unknown): value is Uint8Array {
  return ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]";
}
function type(name: string): protobuf.Type {
  // Never allow protobufjs to silently use lossy number-based int64 handling.
  if (!protobuf.util.Long) throw new Error("Recruit V2 requires protobuf Long support");
  return getProtoRoot().lookupType(`sanguo.military.v1.${name}`);
}

/** Pure body encoder. No route, journal, authentication, network or admission decision. */
export function encodeRecruitV2Request(intent: RecruitV2Intent): Uint8Array {
  const city_id = integer(intent.city_id, -MAX64 - 1n, MAX64, "city_id").toString();
  const unit_cfg_id = small(intent.unit_cfg_id, -2147483648, 2147483647, "unit_cfg_id");
  const count = small(intent.count, -2147483648, 2147483647, "count");
  const intent_version = small(intent.intent_version, 0, 4294967295, "intent_version");
  if (!isBytes(intent.command_id) || intent.command_id.length !== 16 || !intent.command_id.some(Boolean)) invalid("command_id");
  const command_id = Uint8Array.from(intent.command_id);
  const schema = type("RecruitTroopV2Request");
  return schema.encode(schema.fromObject({ city_id, unit_cfg_id, count, command_id, intent_version })).finish();
}

// Check raw widths before protobufjs can truncate oversized varints/int32s.
function validateWire(bytes: Uint8Array, schema: protobuf.Type): void {
  const reader = protobuf.Reader.create(bytes);
  function varint(): bigint {
    let value = 0n;
    for (let i = 0; i < 10; i++) {
      if (reader.pos >= reader.len) invalid("truncated varint");
      const b = reader.buf[reader.pos++];
      if (i === 9 && b > 1) invalid("varint overflow");
      value |= BigInt(b & 127) << BigInt(i * 7);
      if (!(b & 128)) return value;
    }
    return invalid("varint");
  }
  function tagValue(): bigint {
    const tag = varint();
    if (tag > 4294967295n || tag < 8n) invalid("tag");
    return tag;
  }
  function skipUnknown(tag: bigint): void {
    const wire = Number(tag & 7n);
    if (wire === 0) { varint(); return; }
    if (wire === 3) {
      const groups = [tag >> 3n];
      while (groups.length) {
        const child = tagValue(), kind = Number(child & 7n);
        if (kind === 3) groups.push(child >> 3n);
        else if (kind === 4) { if (groups.pop() !== child >> 3n) invalid("group"); }
        else skipUnknown(child);
      }
      return;
    }
    if (wire !== 1 && wire !== 2 && wire !== 5) invalid("wire type");
    const size = wire === 2 ? varint() : BigInt(wire === 1 ? 8 : 4);
    if (size > BigInt(reader.len - reader.pos)) invalid("unknown field length");
    reader.pos += Number(size);
  }
  schema.resolveAll();
  while (reader.pos < reader.len) {
    const tag = tagValue();
    const field = schema.fieldsById[Number(tag >> 3n)], wire = Number(tag & 7n);
    if (!field) { skipUnknown(tag); continue; }
    const nested = field.resolvedType instanceof protobuf.Type ? field.resolvedType : null;
    if (field.type === "bytes" || nested) {
      if (wire !== 2) invalid(field.name);
      const size = varint();
      if (size > BigInt(reader.len - reader.pos)) invalid("length");
      const end = reader.pos + Number(size);
      if (nested) validateWire(reader.buf.subarray(reader.pos, end), nested);
      reader.pos = end;
    } else {
      if (wire !== 0) invalid(field.name);
      const n = varint();
      if (field.type === "int32" && n > 2147483647n && n < (1n << 64n) - 2147483648n) invalid(field.name);
    }
  }
}

/** Decode immutable historical acceptance only. Invalid/missing data throws, not rejection. */
export function decodeRecruitV2Response(bytes: Uint8Array): RecruitV2Acceptance {
  if (!isBytes(bytes)) invalid("response bytes");
  const schema = type("RecruitTroopV2Response");
  validateWire(bytes, schema);
  const response = schema.toObject(schema.decode(bytes), { longs: String, defaults: true });
  if (!response.acceptance) invalid("missing acceptance");
  const a = response.acceptance as Record<string, unknown>;
  const exact = (key: string, min = 0n, max = MAX64) => integer(a[key], min, max, key);
  exact("queue_id", 1n, 9007199254740991n); exact("city_id", 1n);
  small(a.unit_cfg_id, 1, 4, "unit_cfg_id");
  small(a.count, 1, 2147483647, "count");
  for (const key of ["food_paid", "wood_paid", "iron_paid", "stone_paid"]) exact(key);
  const duration = exact("duration_sec", 1n, MAX64 / 1000000000n);
  const status = small(a.initial_status, 0, 1, "initial_status");
  const accepted = exact("accepted_at_ms", MIN_TIME, MAX_TIME);
  const start = exact("initial_start_at_ms", MIN_TIME, MAX_TIME);
  const finish = exact("initial_finish_at_ms", MIN_TIME, MAX_TIME);
  if (start < accepted || (status === 1 && start !== accepted) || finish !== start + duration * 1000n) invalid("initial schedule");
  const catalog = a.catalog_version as Uint8Array, digest = a.rule_digest as Uint8Array;
  if (catalog.length !== 75 || !/^recruit-v1:[0-9a-f]{64}$/.test(String.fromCharCode(...catalog))) invalid("catalog_version");
  if (digest.length !== 32) invalid("rule_digest");
  // Frozen plain arrays keep bytes exact and immutable (typed arrays cannot be frozen).
  return Object.freeze({ ...a, catalog_version: Object.freeze(Array.from(catalog)),
    rule_digest: Object.freeze(Array.from(digest)) }) as RecruitV2Acceptance;
}
