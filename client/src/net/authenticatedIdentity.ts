import protobuf from "protobufjs";

export type AuthenticatedIdentity = Readonly<{
  accountId: string; serverId: number; playerId: number; generation: number;
}>;
export const ENTRY_RESPONSE = ".sanguo.account.v1.EnterGameServerResponse";

/** Inspect identity fields before protobufjs can narrow oversized wire integers. */
export function entryAccountIdentity(bytes: Uint8Array): string | null {
  const invalid = (): never => { throw new Error("Invalid entry identity wire"); };
  function varint(r: protobuf.Reader): bigint {
    let n = 0n;
    for (let i = 0; i < 10; i++) {
      if (r.pos >= r.len) invalid();
      const b = r.buf[r.pos++];
      if ((i === 9 && b > 1) || (i > 0 && b === 0)) invalid();
      n |= BigInt(b & 127) << BigInt(i * 7);
      if (!(b & 128)) return n;
    }
    return invalid();
  }
  function tag(r: protobuf.Reader): number {
    const n = varint(r);
    if (n < 8n || n > 4294967295n) invalid();
    return Number(n);
  }
  function take(r: protobuf.Reader, size: bigint): Uint8Array {
    if (size > BigInt(r.len - r.pos)) invalid();
    const start = r.pos; r.pos += Number(size);
    return r.buf.subarray(start, r.pos);
  }
  function skip(r: protobuf.Reader, t: number): void {
    const wire = t & 7;
    if (wire === 0) { varint(r); return; }
    if (wire === 3) {
      for (;;) {
        const child = tag(r);
        if ((child & 7) === 4) { if (child >>> 3 !== t >>> 3) invalid(); return; }
        skip(r, child);
      }
    }
    if (wire !== 1 && wire !== 2 && wire !== 5) invalid();
    take(r, wire === 2 ? varint(r) : BigInt(wire === 1 ? 8 : 4));
  }
  function scan(data: Uint8Array, player = false): Map<number, bigint> {
    const r = protobuf.Reader.create(data), seen = new Map<number, bigint>();
    let hasPlayer = false;
    while (r.pos < r.len) {
      const t = tag(r), field = t >>> 3;
      const limit = player ? (field === 1 ? 2147483647n : field === 2 ? 9007199254740991n : null)
        : (field === 2 ? 2147483647n : field === 6 ? 9223372036854775807n : null);
      if (limit !== null) {
        if ((t & 7) !== 0) invalid();
        const n = varint(r);
        if (n > limit || (seen.has(field) && seen.get(field) !== n)) invalid();
        seen.set(field, n);
      } else if (!player && field === 3) {
        if ((t & 7) !== 2 || hasPlayer) invalid();
        hasPlayer = true; scan(take(r, varint(r)), true);
      } else skip(r, t);
    }
    return seen;
  }
  try {
    // No intermediate Number for account identity, even if Long support disappears.
    if (!protobuf.util.Long) return null;
    const account = scan(bytes).get(6);
    return account && account > 0n ? account.toString() : null;
  } catch { return null; } // Safe legacy decoding remains independent of identity availability.
}
