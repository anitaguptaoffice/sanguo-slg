import type { AuthenticatedIdentity } from "./authenticatedIdentity";
import { getProtoRoot } from "./loadProto";
import { decodeRecruitV2Response, encodeRecruitV2Request } from "./recruitV2Codec";

const database = "sanguo-recruit-journal";
const stores = ["commands", "slots"] as const;
const max64 = (1n << 63n) - 1n;
const min32 = -2147483648n, max32 = 2147483647n;
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const unhex = (value: string) => Uint8Array.from(value.match(/../g) ?? [], b => parseInt(b, 16));
const stringify = JSON.stringify;
const digest = async (value: unknown) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stringify(value)))));
const invalid = (): never => { throw new Error("Recruit journal unavailable"); };
const pending = (phase: string) => phase === "prepared" || phase === "attempting" || phase === "unknown";
const rejectionCodes = ["50001", "50002", "50003", "50004", "30001"];
const blockedScopes = new Set<string>();

type Scope = readonly [string, string, string, "RecruitTroop"];
type LiveIdentity = () => AuthenticatedIdentity | null;
export type RecruitJournalIntent = Readonly<{ city_id: string | bigint; unit_cfg_id: number; count: number }>;
type Phase = "prepared" | "attempting" | "unknown" | "accepted" | "rejected" | "quarantined";
type Stored = {
  payload: string[]; payloadDigest: string; phase: Phase;
  attempt: number; uncertain: boolean; outcome: string[] | string | null; recordDigest: string;
};
export type RecruitJournalHandle = Readonly<{
  commandHex: string; payloadDigest: string; intent: Readonly<{ city_id: string; unit_cfg_id: number; count: number }>;
  encodeRequest(): Uint8Array;
}>;
export type RecruitJournalInspection = Readonly<{
  phase: "unknown" | "accepted" | "rejected"; command: RecruitJournalHandle;
}>;
export type RecruitSubmissionResult = "accepted" | "rejected" | "unknown" | "busy" | "quarantined";
export type RecruitSubmissionChannel = Readonly<{
  // Caller must enforce reviewed profile enrollment and server capability.
  authorize(identity: AuthenticatedIdentity): void;
  // Opted-in local activation reserves externally after attempting readback.
  reserve?(command: RecruitJournalHandle): Promise<void>;
  // Preserve denial outside the journal when its quarantine write cannot be verified.
  blockProfile(identity: AuthenticatedIdentity): void;
  // Start exactly one correlated V2 exchange synchronously. No deferred sends.
  exchange(body: Uint8Array, identity: AuthenticatedIdentity, signal: AbortSignal): Promise<Uint8Array>;
}>;
type Snapshot = { head: string | null; commands: Stored[] };
type ScanResult = readonly [IDBValidKey[], unknown[], IDBValidKey[], unknown[]];

function decimal(value: unknown, min: bigint, max: bigint): string {
  if (typeof value !== "string" || value.length > 20 || !/^(0|-?[1-9][0-9]*)$/.test(value)) return invalid();
  const n = BigInt(value);
  if (n < min || n > max) return invalid();
  return value;
}

function small(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) return invalid();
  return value;
}

function scopeOf(id: AuthenticatedIdentity): Scope {
  return [decimal(id.accountId, 1n, max64), String(small(id.serverId, 1, Number(max32))),
    String(small(id.playerId, 1, Number.MAX_SAFE_INTEGER)), "RecruitTroop"];
}

function hexString(value: unknown, length: number): string {
  if (typeof value !== "string" || value.length !== length || /[^0-9a-f]/.test(value)) return invalid();
  return value;
}

function commandHex(value: unknown): string {
  const key = hexString(value, 32);
  if (/^0+$/.test(key)) return invalid();
  return key;
}

function tuple(value: unknown, length: number): unknown[] {
  if (!Array.isArray(value) || value.length !== length || Object.keys(value).length !== length) return invalid();
  // Reject holes even if extra array properties happen to balance their count.
  for (let i = 0; i < length; i++) if (!Object.hasOwn(value, i)) return invalid();
  return value;
}

function scopeForKey(key: IDBValidKey, length: number): Scope {
  const parts = tuple(key, length);
  if (parts[3] !== "RecruitTroop") return invalid();
  return [decimal(parts[0], 1n, max64), decimal(parts[1], 1n, max32),
    decimal(parts[2], 1n, BigInt(Number.MAX_SAFE_INTEGER)), "RecruitTroop"];
}

function validateAccepted(value: unknown, payload: string[]): void {
  const fields = tuple(value, 15);
  for (const x of fields.slice(0, 13)) decimal(x, -max64 - 1n, max64);
  const [queue_id, city_id, unit, count, food_paid, wood_paid, iron_paid, stone_paid,
    duration_sec, status, accepted_at_ms, initial_start_at_ms, initial_finish_at_ms] = fields;
  const unit_cfg_id = Number(decimal(unit, 1n, 4n));
  const amount = Number(decimal(count, 1n, max32));
  const initial_status = Number(decimal(status, 0n, 1n));
  const catalog_version = unhex(hexString(fields[13], 150));
  const rule_digest = unhex(hexString(fields[14], 64));
  const schema = getProtoRoot().lookupType("sanguo.military.v1.RecruitTroopV2Response");
  const body = schema.encode(schema.fromObject({ acceptance: { queue_id, city_id, unit_cfg_id, count: amount,
    food_paid, wood_paid, iron_paid, stone_paid, duration_sec, initial_status, accepted_at_ms, initial_start_at_ms,
    initial_finish_at_ms, catalog_version, rule_digest } })).finish();
  const confirmed = decodeRecruitV2Response(body);
  if (confirmed.city_id !== payload[7] || unit !== payload[8] || count !== payload[9]) invalid();
}

const recordKeys = ["attempt", "outcome", "payload", "payloadDigest", "phase", "recordDigest", "uncertain"];
const signedRecord = (row: Stored) => [row.payload, row.payloadDigest, row.phase, String(row.attempt),
  row.uncertain, row.outcome, row.recordDigest] as const;
const digestInput = (row: Stored) => ["recruit-record-v1", row.payloadDigest, row.phase, String(row.attempt), row.uncertain, row.outcome];

function quarantinePrior(value: unknown, row: Stored, scope: Scope, key: string): Stored {
  const [reason, text, observation] = tuple(value, 3);
  if (reason !== "intent-conflict" && reason !== "receipt-conflict" &&
      reason !== "terminal-conflict" && reason !== "known-restored") return invalid();
  if (typeof text !== "string" || typeof observation !== "string" || observation.length % 2 ||
      /[^0-9a-f]/.test(observation) || (reason !== "known-restored" && !observation.length)) return invalid();
  const [payload, payloadDigest, phase, attempt, uncertain, outcome, recordDigest] = tuple(JSON.parse(text), 7);
  if (phase === "quarantined") return invalid();
  const prior = verifyShape({ payload, payloadDigest, phase,
    attempt: Number(decimal(attempt, 0n, BigInt(Number.MAX_SAFE_INTEGER))), uncertain, outcome, recordDigest }, scope, key);
  if (stringify(signedRecord(prior)) !== text || stringify(prior.payload) !== stringify(row.payload) ||
      prior.payloadDigest !== row.payloadDigest || prior.attempt !== row.attempt || !row.uncertain) return invalid();
  return prior;
}

function verifyShape(value: unknown, scope: Scope, key: string): Stored {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype ||
      stringify(Object.keys(value).sort()) !== stringify(recordKeys)) return invalid();
  const row = value as Stored;
  const payload = tuple(row.payload, 10);
  if (payload[0] !== "recruit-journal-v1" || stringify(payload.slice(1, 5)) !== stringify(scope) ||
      payload[5] !== key || payload[6] !== "1") return invalid();
  // Every payload element is now compared or range-checked as its exact type.
  decimal(payload[7], -max64 - 1n, max64);
  decimal(payload[8], min32, max32);
  decimal(payload[9], min32, max32);
  hexString(row.payloadDigest, 64);
  hexString(row.recordDigest, 64);
  small(row.attempt, 0, Number.MAX_SAFE_INTEGER);
  if (typeof row.uncertain !== "boolean") return invalid();
  switch (row.phase) {
    case "prepared": if (row.attempt !== 0 || row.uncertain || row.outcome !== null) return invalid(); break;
    case "attempting": if (row.attempt === 0 || row.outcome !== null) return invalid(); break;
    case "unknown": if (!row.uncertain || row.outcome !== null) return invalid(); break;
    case "accepted": if (!row.attempt) return invalid(); validateAccepted(row.outcome, row.payload); break;
    case "rejected":
      if (!row.attempt || row.uncertain || !rejectionCodes.some(code => code === row.outcome)) return invalid();
      break;
    case "quarantined": quarantinePrior(row.outcome, row, scope, key); break;
    default: return invalid();
  }
  return row;
}

async function verifyDigests(row: Stored, scope: Scope, allowedQuarantine?: Stored): Promise<void> {
  if (await digest(row.payload) !== row.payloadDigest || await digest(digestInput(row)) !== row.recordDigest) invalid();
  if (row.phase === "quarantined") {
    await verifyDigests(quarantinePrior(row.outcome, row, scope, row.payload[5]), scope);
    if (!allowedQuarantine || stringify(signedRecord(row)) !== stringify(signedRecord(allowedQuarantine))) invalid();
  }
}

function classify([commandKeys, values, slotKeys, heads]: ScanResult, scope: Scope): Snapshot {
  const current = stringify(scope);
  const commands = commandKeys.flatMap((key, index) => {
    if (stringify(scopeForKey(key, 5)) !== current) return [];
    return [verifyShape(values[index], scope, commandHex((key as IDBValidKey[])[4]))];
  });
  let head = null;
  for (let i = 0; i < slotKeys.length; i++) {
    if (stringify(scopeForKey(slotKeys[i], 4)) === current) head = commandHex(heads[i]);
  }
  if (head === null ? commands.length !== 0 : !commands.some(row => row.payload[5] === head)) return invalid();
  const active = commands.filter(row => pending(row.phase));
  if (active.length > 1 || active.some(row => row.payload[5] !== head)) return invalid();
  return { head, commands };
}

function signature(snapshot: Snapshot): string {
  return stringify([snapshot.head, snapshot.commands.map(signedRecord)]);
}

// All four reads share a single transaction. The final request callback runs
// synchronous validation and queues any writes before returning to IndexedDB.
function scan(tx: IDBTransaction, scope: Scope, visit: (snapshot: Snapshot) => void,
              fail: (error: unknown) => void): void {
  const commands = tx.objectStore("commands"), slots = tx.objectStore("slots");
  for (const store of [commands, slots]) {
    if (store.keyPath !== null || store.autoIncrement || store.indexNames.length) invalid();
  }
  const requests = [commands.getAllKeys(), commands.getAll(), slots.getAllKeys(), slots.getAll()] as const;
  let left = requests.length;
  for (const req of requests) req.onsuccess = () => {
    if (--left !== 0) return;
    try { visit(classify(requests.map(r => r.result) as unknown as ScanResult, scope)); }
    catch (error) { fail(error); }
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(database, 1);
    let failed = false;
    const fail = () => {
      failed = true;
      clearTimeout(timer);
      reject(new Error("Recruit journal database unavailable"));
    };
    const timer = setTimeout(fail, 5000);
    req.onblocked = req.onerror = fail;
    req.onupgradeneeded = () => {
      if (failed || req.result.objectStoreNames.length) { req.transaction?.abort(); return; }
      for (const store of stores) req.result.createObjectStore(store);
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      if (failed || db.version !== 1 || stringify(Array.from(db.objectStoreNames)) !== stringify(stores)) {
        db.close();
        fail();
        return;
      }
      resolve(db);
    };
  });
}

function transaction(db: IDBDatabase, scope: Scope, mode: "readonly" | "readwrite",
                     visit?: (tx: IDBTransaction, snapshot: Snapshot) => void): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...stores], mode, mode === "readwrite" ? { durability: "strict" } : undefined);
    let result: Snapshot;
    let failure: unknown;
    const abort = (err: unknown) => {
      failure = err;
      try { tx.abort(); } catch { reject(err); }
    };
    const timer = setTimeout(() => abort(new Error("Recruit journal transaction timed out")), 5000);
    tx.onabort = () => { clearTimeout(timer); reject(failure ?? tx.error ?? new Error("Recruit journal transaction aborted")); };
    tx.oncomplete = () => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else resolve(result);
    };
    try {
      if (mode === "readwrite" && tx.durability !== "strict") invalid();
      scan(tx, scope, snapshot => {
        result = snapshot;
        visit?.(tx, snapshot);
      }, abort);
    } catch (err) { abort(err); }
  });
}

type ReplyMetadata = Pick<Stored, "outcome" | "uncertain"> & { phase: Exclude<RecruitSubmissionResult, "busy"> };

function replyMetadata(raw: Uint8Array | null, row: Stored, current: boolean): ReplyMetadata {
  const unknown = { phase: "unknown", outcome: null, uncertain: true } as const;
  if (!raw) return unknown;
  const quarantine = (reason: string): ReplyMetadata => ({ phase: "quarantined", uncertain: true,
    outcome: [reason, stringify(signedRecord(row)), hex(raw)] });
  try {
    const schema = getProtoRoot().lookupType("sanguo.common.v1.ServerPacket");
    const packet = schema.decode(raw) as unknown as { code: number; data: Uint8Array };
    // The gateway emits canonical protobuf. Reject malformed widths, duplicate
    // fields and unknown evidence before trusting any business rejection code.
    if (hex(schema.encode(packet).finish()) !== hex(raw)) return unknown;
    if (packet.code === 50008 && !packet.data.length) return quarantine("intent-conflict");
    if (packet.code === 0) {
      const a = decodeRecruitV2Response(packet.data);
      if (a.city_id !== row.payload[7] || String(a.unit_cfg_id) !== row.payload[8] || String(a.count) !== row.payload[9]) {
        return quarantine("receipt-conflict");
      }
      const outcome = [a.queue_id, a.city_id, a.unit_cfg_id, a.count, a.food_paid, a.wood_paid, a.iron_paid, a.stone_paid,
        a.duration_sec, a.initial_status, a.accepted_at_ms, a.initial_start_at_ms, a.initial_finish_at_ms].map(String);
      outcome.push(hex(Uint8Array.from(a.catalog_version)), hex(Uint8Array.from(a.rule_digest)));
      if (row.phase === "rejected") return quarantine("terminal-conflict");
      if (row.phase === "accepted" && stringify(row.outcome) !== stringify(outcome)) return quarantine("receipt-conflict");
      return { phase: "accepted", outcome, uncertain: row.uncertain };
    }
    const code = String(packet.code);
    if (current && !row.uncertain && !packet.data.length && rejectionCodes.includes(code)) {
      return { phase: "rejected", outcome: code, uncertain: false };
    }
  } catch { /* A malformed reply provides no conclusive result. */ }
  return unknown;
}

async function exchangeWithDeadline(channel: RecruitSubmissionChannel, body: Uint8Array, identity: AuthenticatedIdentity) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<null>(resolve => {
      timer = setTimeout(() => { resolve(null); controller.abort(); }, 15000);
    });
    return await Promise.race([deadline, channel.exchange(body, identity, controller.signal)]);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function openJournal(live: LiveIdentity, channel?: RecruitSubmissionChannel) {
  const initial = live();
  if (!initial || !globalThis.isSecureContext || !globalThis.indexedDB ||
      !globalThis.crypto?.subtle || !navigator.locks || !navigator.storage?.persisted) return invalid();
  const identity = Object.freeze({ ...initial });
  const scope = scopeOf(identity), generation = small(identity.generation, 0, Number.MAX_SAFE_INTEGER);
  const scopeKey = stringify(scope);
  let closed = false;
  const guard = () => {
    const current = live();
    if (closed || blockedScopes.has(scopeKey) || !current ||
        current.generation !== generation || stringify(scopeOf(current)) !== scopeKey) invalid();
  };
  await navigator.storage.persisted();
  guard();
  const db = await openDatabase();
  let exchanges = 0;
  const close = () => { closed = true; if (!exchanges) db.close(); };
  db.onversionchange = db.onclose = () => { closed = true; db.close(); };
  const readStorage = async (allowedQuarantine?: Stored) => {
    const snapshot = await transaction(db, scope, "readonly");
    for (const row of snapshot.commands) await verifyDigests(row, scope, allowedQuarantine);
    return snapshot;
  };
  const read = async () => {
    guard();
    const snapshot = await readStorage();
    guard();
    return snapshot;
  };
  const handles = new WeakMap<RecruitJournalHandle, boolean>();
  const handle = (row: Stored): RecruitJournalHandle => {
    const [, , , , , commandHex, , city_id, unit, count] = row.payload;
    const intent = Object.freeze({ city_id, unit_cfg_id: Number(unit), count: Number(count) });
    const value = Object.freeze({
      commandHex, payloadDigest: row.payloadDigest, intent,
      encodeRequest() {
        guard();
        return encodeRecruitV2Request({ ...intent, command_id: unhex(commandHex), intent_version: 1 });
      },
    });
    handles.set(value, false);
    return value;
  };
  const replace = async (before: Snapshot, updated: Stored, beforeWrite?: () => void) => {
    updated.recordDigest = await digest(digestInput(updated));
    const key = updated.payload[5];
    verifyShape(updated, scope, key);
    await transaction(db, scope, "readwrite", (tx, actual) => {
      beforeWrite?.();
      if (signature(actual) !== signature(before)) invalid();
      tx.objectStore("commands").put(updated, [...scope, key]);
    });
    const after = await readStorage(updated.phase === "quarantined" ? updated : undefined);
    const saved = after.commands.find(row => row.payload[5] === key);
    if (!saved || stringify(signedRecord(saved)) !== stringify(signedRecord(updated))) invalid();
  };
  const stillCurrent = () => { try { guard(); return true; } catch { return false; } };
  async function submit(command: RecruitJournalHandle): Promise<RecruitSubmissionResult> {
    if (!channel || !handles.has(command)) return invalid();
    guard();
    let reportFailedMarker!: () => void;
    const failedMarker = new Promise<"unknown">(resolve => { reportFailedMarker = () => resolve("unknown"); });
    const attempt = navigator.locks.request(stringify(["recruit-send-v1", ...scope]), { ifAvailable: true }, async lock => {
      if (!lock) return "busy";
      guard();
      channel.authorize(identity);
      const before = await read();
      const row = before.commands.find(r => r.payload[5] === command.commandHex);
      if (!row || row.payloadDigest !== command.payloadDigest || before.head !== command.commandHex) return invalid();
      if (row.phase === "accepted" || row.phase === "rejected") return row.phase;
      if (!pending(row.phase) || row.attempt === Number.MAX_SAFE_INTEGER) return invalid();
      const uncertain = row.uncertain || row.phase !== "prepared" || !handles.get(command);
      handles.set(command, false);
      const attempted: Stored = { ...row, phase: "attempting", attempt: row.attempt + 1, uncertain, outcome: null };
      exchanges++;
      let fenced = false;
      const classifyReply = (raw: Uint8Array | null, record: Stored, current: boolean) => {
        const metadata = replyMetadata(raw, record, current);
        if (metadata.phase === "quarantined") {
          blockedScopes.add(scopeKey);
          fenced = true;
        }
        return metadata;
      };
      try {
        await replace(before, attempted, guard);
        channel.authorize(identity);
        if (channel.reserve) {
          await channel.reserve(command);
          channel.authorize(identity);
        }
        const body = command.encodeRequest(); // Recheck identity immediately before exchange.
        const raw = (await exchangeWithDeadline(channel, body, identity))?.slice() ?? null;
        const reply = classifyReply(raw, attempted, stillCurrent());
        const observed = await readStorage();
        const prior = observed.commands.find(r => r.payload[5] === command.commandHex);
        if (!prior || prior.payloadDigest !== row.payloadDigest || prior.attempt !== attempted.attempt) return invalid();
        const same = stringify(signedRecord(prior)) === stringify(signedRecord(attempted));
        const phase = prior.phase;
        const terminal = phase === "accepted" || phase === "rejected";
        if (!same && !terminal) return invalid();
        const metadata = same ? reply : classifyReply(raw, prior, false);
        if (terminal && !fenced) return stillCurrent() ? phase : "unknown";
        await replace(observed, { ...prior, ...metadata }, metadata.phase === "rejected" ? guard : undefined);
        if (fenced) blockedScopes.delete(scopeKey);
        return stillCurrent() ? metadata.phase : "unknown";
      } catch {
        if (!fenced) return "unknown";
        try { channel.blockProfile(identity); } catch { /* Retain the local fence even if external recording fails. */ }
        reportFailedMarker();
        // Keep sibling tabs out even though the caller has already received unknown.
        return new Promise<never>(() => {});
      }
      finally { if (--exchanges === 0 && closed) db.close(); }
    });
    return Promise.race([attempt, failedMarker]);
  }
  try { await read(); } catch (err) { close(); throw err; }
  return Object.freeze({
    close, submit,
    async inspect(key?: string): Promise<RecruitJournalInspection | null> {
      if (key !== undefined) commandHex(key);
      const snapshot = await read();
      const row = snapshot.commands.find(r => r.payload[5] === (key ?? snapshot.head));
      if (!row) return null;
      return Object.freeze({ phase: row.phase === "accepted" || row.phase === "rejected" ? row.phase : "unknown",
        command: handle(row) });
    },
    async prepare(expected: string | null, intent: RecruitJournalIntent): Promise<RecruitJournalHandle> {
      if (expected !== null) commandHex(expected);
      const city = decimal(typeof intent.city_id === "bigint" ? String(intent.city_id) : intent.city_id, -max64 - 1n, max64);
      const unit = String(small(intent.unit_cfg_id, Number(min32), Number(max32)));
      const count = String(small(intent.count, Number(min32), Number(max32)));
      for (let tries = 0; tries < 4; tries++) {
        const before = await read();
        if (before.head !== expected || before.commands.some(row => pending(row.phase))) return invalid();
        const key = hex(crypto.getRandomValues(new Uint8Array(16)));
        if (/^0+$/.test(key)) continue;
        const payload = ["recruit-journal-v1", ...scope, key, "1", city, unit, count];
        const row: Stored = { payload, payloadDigest: await digest(payload), phase: "prepared",
          attempt: 0, uncertain: false, outcome: null, recordDigest: "" };
        row.recordDigest = await digest(digestInput(row));
        guard();
        let duplicate = false;
        try {
          await transaction(db, scope, "readwrite", (tx, current) => {
            guard();
            if (signature(current) !== signature(before)) invalid();
            const add = tx.objectStore("commands").add(row, [...scope, key]);
            add.onerror = () => { duplicate = add.error?.name === "ConstraintError"; };
            tx.objectStore("slots").put(key, [...scope]);
          });
        } catch (err) {
          if (!duplicate) throw err;
          // A proven existing key can only be retried before send, under the
          // exact same predecessor, with no writes surviving the abort.
          const current = await read();
          if (signature(current) === signature(before) && current.commands.some(r => r.payload[5] === key)) continue;
          throw err;
        }
        const after = await read();
        const saved = after.commands.find(r => r.payload[5] === key);
        if (!saved || after.head !== key || stringify(signedRecord(saved)) !== stringify(signedRecord(row))) return invalid();
        const created = handle(saved);
        handles.set(created, true);
        return created;
      }
      throw new Error("Recruit journal command generation exhausted");
    },
  });
}

/** Offline interface has no connection to a submission channel. */
export async function openRecruitJournal(live: LiveIdentity) {
  const { close, inspect, prepare } = await openJournal(live);
  return Object.freeze({ close, inspect, prepare });
}

/** Dormant coordinator. Runtime authorization and the gateway transport are separate. */
export function openRecruitSubmissionJournal(live: LiveIdentity, channel: RecruitSubmissionChannel) {
  return openJournal(live, channel);
}
