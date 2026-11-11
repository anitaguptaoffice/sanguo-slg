import { getTypes } from "./loadProto";

export const firstCityUnknown = (): Error => new Error("First-city outcome UNKNOWN");
const invalid = (): never => { throw firstCityUnknown(); };
const trace = (value: unknown): value is string => typeof value === "string" && /^[\x20-\x7e]{1,64}$/.test(value);

export function firstCityPacket(route: string, payload: Uint8Array, traceId: string, session: string, shard: number): Uint8Array {
  if (!trace(traceId) || !session || session.length > 128 || !Number.isInteger(shard) || shard < 1 || shard > 2147483647 ||
    payload.length > 2048 || new TextEncoder().encode(session).length > 128) invalid();
  for (const scalar of session) {
    const point = scalar.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) invalid();
  }
  const bytes = getTypes().ClientPacket.encode({ route, payload, trace_id: traceId, session_id: session, server_id: shard }).finish();
  if (bytes.length > 4096) invalid();
  return bytes;
}

/** The common envelope is validated before any payload decoder or trace dispatch. */
export function readFirstCityPacket(frame: unknown): { code: bigint; data: Uint8Array; trace: string } {
  if (!(frame instanceof ArrayBuffer)) return invalid();
  const bytes = new Uint8Array(frame);
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  if (!utf8.fatal || !utf8.ignoreBOM) invalid();
  let offset = 0;
  let code = 0n;
  let data = new Uint8Array();
  let traceId = "";
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
    if (id < 1 || id > 4 || seen.has(id) || tag % 8 !== (id === 1 ? 0 : 2)) invalid();
    seen.add(id);
    if (id === 1) {
      code = varint(0xffffffffffffffffn);
      if (code > 2147483647n && code < 0xffffffff80000000n) invalid();
    } else {
      const length = Number(varint(0xffffffffn));
      if (length > bytes.length - offset || (id === 3 && length > 16384) || (id === 4 && (length < 1 || length > 64))) invalid();
      const part = bytes.subarray(offset, offset + length);
      if (id === 3) data = part;
      else {
        const value = utf8.decode(part);
        if (id === 4) traceId = value;
      }
      offset += length;
    }
  }
  if (!trace(traceId)) invalid();
  return { code, data, trace: traceId };
}
