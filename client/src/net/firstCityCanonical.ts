/** C1 business intent only: scope is an untrusted expectation, never authority. */
export type FirstCityScope = Readonly<{
  realmId: string;
  shard: number;
  playerId: bigint;
  accountId: bigint;
}>;
export type FirstCityPredecessor = Readonly<
  { kind: "empty" } | { kind: "rejected"; commandId: string }
>;
export type FirstCityProposal = Readonly<{
  commandId: string;
  predecessor: FirstCityPredecessor;
  name: string;
  x: number;
  y: number;
}>;
export interface FirstCityIntent {
  readonly scope: FirstCityScope;
  readonly proposal: FirstCityProposal;
  encode(): Uint8Array;
  matches(bytes: unknown): boolean;
}

const invalid = (): never => { throw new TypeError("Invalid first-city intent"); };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const encoder = new TextEncoder();
const arrayLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "length")!.get!;

// Snapshot own data properties once; neither defaults nor accessors supply presence.
function fields(value: unknown, keys: string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) invalid();
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptor, "value")) invalid();
    copy[key] = descriptor.value;
  }
  return copy;
}

export function validateFirstCityUuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) invalid();
  return value as string;
}

function identity(value: unknown): bigint {
  if (typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value)) value = BigInt(value);
  if (typeof value !== "bigint" || value < 1n || value > 9223372036854775807n) invalid();
  return value as bigint;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) invalid();
  return value as number;
}

function nameBytes(value: unknown): Uint8Array {
  if (typeof value !== "string") return invalid();
  let count = 0;
  for (const scalar of value) {
    const point = scalar.codePointAt(0)!;
    if (point === 0 || (point >= 0xd800 && point <= 0xdfff) || ++count > 32) invalid();
  }
  if (count === 0) invalid();
  const bytes = encoder.encode(value);
  if (bytes.length > 128) invalid();
  return bytes;
}

function encode(scope: FirstCityScope, proposal: FirstCityProposal, name: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(87 + name.length + (proposal.predecessor.kind === "rejected" ? 16 : 0));
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const append = (part: Uint8Array) => {
    bytes.set(part, offset);
    offset += part.length;
  };
  const u16 = (value: number) => {
    view.setUint16(offset, value, false);
    offset += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(offset, value, false);
    offset += 4;
  };
  const u64 = (value: bigint) => {
    view.setBigUint64(offset, value, false);
    offset += 8;
  };
  const appendUuid = (value: string) => append(Uint8Array.from(
    value.replaceAll("-", "").match(/../g)!, octet => parseInt(octet, 16),
  ));
  append(encoder.encode("SGFC"));
  u16(1);
  u16(16);
  append(encoder.encode("world.first_city"));
  u32(2);
  appendUuid(scope.realmId);
  u32(scope.shard);
  u64(scope.playerId);
  u64(scope.accountId);
  appendUuid(proposal.commandId);
  bytes[offset++] = proposal.predecessor.kind === "empty" ? 0 : 1;
  if (proposal.predecessor.kind === "rejected") appendUuid(proposal.predecessor.commandId);
  u16(name.length);
  append(name);
  u16(proposal.x);
  u16(proposal.y);
  return bytes;
}

/** Validate and copy an untrusted equality expectation; this grants no authority. */
export function validateFirstCityScope(expectedScope: unknown): FirstCityScope {
  try {
    const s = fields(expectedScope, ["realmId", "shard", "playerId", "accountId"]);
    return Object.freeze({
      realmId: validateFirstCityUuid(s.realmId), shard: integer(s.shard, 1, 2147483647),
      playerId: identity(s.playerId), accountId: identity(s.accountId),
    });
  } catch { return invalid(); }
}

/** Throws a fixed safe TypeError; a successful value grants no permission or effects. */
export function createFirstCityIntent(expectedScope: unknown, proposed: unknown): FirstCityIntent {
  try {
    const scope = validateFirstCityScope(expectedScope);
    const p = fields(proposed, ["commandId", "predecessor", "name", "x", "y"]);
    const commandId = validateFirstCityUuid(p.commandId);
    // Reading descriptors avoids evaluating a hostile discriminator getter.
    const kind = Object.getOwnPropertyDescriptor(p.predecessor ?? {}, "kind")?.value;
    const previous = fields(p.predecessor, kind === "empty" ? ["kind"] : ["kind", "commandId"]);
    let predecessor: FirstCityPredecessor;
    if (previous.kind === "empty") predecessor = Object.freeze({ kind: "empty" });
    else if (previous.kind === "rejected" && validateFirstCityUuid(previous.commandId) !== commandId) {
      predecessor = Object.freeze({ kind: "rejected", commandId: validateFirstCityUuid(previous.commandId) });
    } else return invalid();
    const name = nameBytes(p.name);
    const proposal = Object.freeze({
      commandId, predecessor, name: p.name as string,
      x: integer(p.x, 0, 499), y: integer(p.y, 0, 499),
    });
    const bytes = encode(scope, proposal, name);
    return Object.freeze({
      scope, proposal,
      encode: () => bytes.slice(),
      matches: (candidate: unknown): boolean => {
        try {
          if (!(candidate instanceof Uint8Array) || arrayLength.call(candidate) !== bytes.length) return false;
          let equal = true;
          for (let i = 0; i < bytes.length; i++) equal = candidate[i] === bytes[i] && equal;
          return equal;
        } catch { return false; }
      },
    });
  } catch { return invalid(); }
}
