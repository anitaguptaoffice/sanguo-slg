'use strict';
// Contract-only binary test; no runtime or generated code is changed.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const protobuf = require(process.env.PROTOBUFJS_PATH ||
  path.resolve(__dirname, '../../../client/node_modules/protobufjs'));
const repo = path.resolve(__dirname, '../../..');
const spec = path.join(repo, 'spec/proto');
const active = process.env.ACTIVE_PROTO_ROOT || path.join(repo, 'internal/api/proto');

function load(base, file) {
  const root = new protobuf.Root();
  root.resolvePath = (_, target) => {
    if (path.isAbsolute(target)) return target;
    const local = path.join(base, target);
    return fs.existsSync(local) ? local : path.join(spec, target);
  };
  root.loadSync(path.join(base, file), { keepCase: true }).resolveAll();
  return root.lookupType('sanguo.domestic.v1.GetCityStateResponse');
}
// Immutable pre-extension bytes, never fall back to mutable shared imports.
const legacyDir = path.join(__dirname, 'fixtures/garrison-legacy');
const legacyFiles = {
  'sanguo/domestic/v1/extra.proto': ['extra.proto.txt',
    '967c51027f5eb05034bfc5ab8f62619502325e0f22ed6a8ebf4fa5656cf2fbd2'],
  'sanguo/common/v1/types.proto': ['types.proto.txt',
    '746d03c49e6f43e1f7e87f2d9ac1df6c6434db2e6e0b55143644ad69726141d3'],
};
for (const [file, hash] of Object.values(legacyFiles)) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(legacyDir, file)))
    .digest('hex'), hash, `legacy fixture checksum: ${file}`);
}
const legacyRoot = new protobuf.Root();
legacyRoot.resolvePath = (_, target) => {
  assert.ok(Object.hasOwn(legacyFiles, target), `unexpected legacy import: ${target}`);
  return path.join(legacyDir, legacyFiles[target][0]);
};
legacyRoot.loadSync('sanguo/domestic/v1/extra.proto', { keepCase: true }).resolveAll();
const old = legacyRoot.lookupType('sanguo.domestic.v1.GetCityStateResponse');
const current = load(active, 'sanguo/domestic/v1/extra.proto');
const next = load(spec, 'sanguo/domestic/v1/domestic.proto');
const fields = type => type.fieldsArray.map(f => [f.name, f.id, f.type, f.repeated]);
assert.deepEqual(fields(old), [
  ['wallet', 1, 'sanguo.common.v1.ResourceWallet', false],
  ['buildings', 2, 'sanguo.common.v1.CityBuilding', true],
  ['production_rates', 3, 'sanguo.common.v1.ResourceWallet', false],
]);
assert.deepEqual(fields(next).slice(0, 3), fields(old));
assert.deepEqual(fields(next)[3], ['garrison', 4, 'CityGarrisonSnapshot', false]);
// Compare referenced DTO fields too, not merely their message type names.
const shape = type => type.fieldsArray.map(f => [f.name, f.id, f.type, f.repeated,
  f.resolvedType instanceof protobuf.Type ? shape(f.resolvedType) : null]);
assert.deepEqual(shape(next).slice(0, 3), shape(old));
assert.deepEqual(shape(current).slice(0, 3), shape(old));
const mirrored = !!current.fields.garrison;
assert.deepEqual(shape(current), mirrored ? shape(next) : shape(old),
  'active adapter must match the complete old or new contract');
const normalize = (type, message) => type.toObject(message, { longs: String });
const encode = (type, value) => {
  const message = type.fromObject(value);
  assert.equal(type.verify(message), null);
  return type.encode(message).finish();
};
const owns = (message, key) => Object.prototype.hasOwnProperty.call(message, key);
const baseline = {
  wallet: { food: '9007199254740993', wood: '202', iron: '303', stone: '404', gold: '505' },
  buildings: [{ slot_key: 'barracks', building_cfg_id: 1001, level: 1,
    upgrade_finish_at_ms: '1793037000123' }],
  production_rates: { food: '11', wood: '22', iron: '33', stone: '44', gold: '0' },
};
const oldBytes = encode(old, baseline);
const expected = normalize(old, old.decode(oldBytes));
assert.deepEqual(encode(next, baseline), oldBytes, 'fields 1-3 must be byte-identical');
const oldToNew = next.decode(oldBytes);
assert.equal(owns(oldToNew, 'garrison'), false);
assert.equal(oldToNew.garrison, null);
assert.deepEqual(normalize(next, oldToNew), expected);
console.log('PASS old -> new: wallet/buildings/rates unchanged, garrison absent');

for (const garrison of [{}, { troops: [] }, { troops: [
  { unit_cfg_id: 1001, count: 1 }, { unit_cfg_id: 1002, count: 2147483647 },
] }]) {
  const bytes = encode(next, { ...baseline, garrison });
  assert.deepEqual(normalize(old, old.decode(bytes)), expected, 'old decoder ignores field 4');
  const decoded = next.decode(bytes);
  assert.equal(owns(decoded, 'garrison'), true);
  assert.deepEqual(normalize(next, decoded).garrison,
    normalize(next, next.fromObject({ garrison })).garrison);
  assert.deepEqual(encode(next, decoded), bytes, 'presence survives re-encode');
}
console.log('PASS new -> old: unknown field 4 ignored, fields 1-3 unchanged');
assert.deepEqual([...encode(next, {})], []);
assert.deepEqual([...encode(next, { garrison: {} })], [0x22, 0x00]);
assert.equal(owns(next.decode(Uint8Array.from([0x22, 0x00])), 'garrison'), true);
assert.equal(owns(next.decode(new Uint8Array()), 'garrison'), false);
console.log('PASS absent vs present-empty: [] versus [0x22, 0x00]');
console.log('PASS populated snapshot and int32 upper bound round-trip');
// Exercise the mutable adapter separately: it may legitimately be pre/post mirror.
assert.deepEqual(encode(current, baseline), oldBytes);
assert.deepEqual(normalize(current, current.decode(oldBytes)), expected);
assert.equal(owns(current.decode(oldBytes), 'garrison'), false);
for (const garrison of [{}, { troops: [] }, { troops: [{ unit_cfg_id: 1001, count: 1 }] }]) {
  const bytes = encode(next, { ...baseline, garrison });
  const decoded = current.decode(bytes);
  assert.equal(owns(decoded, 'garrison'), mirrored);
  assert.deepEqual(normalize(current, decoded), mirrored
    ? normalize(next, next.decode(bytes)) : expected);
  if (mirrored) assert.deepEqual(encode(current, decoded), bytes);
}
if (mirrored) {
  assert.deepEqual([...encode(current, {})], []);
  assert.deepEqual([...encode(current, { garrison: {} })], [0x22, 0x00]);
  assert.equal(owns(current.decode(Uint8Array.from([0x22, 0x00])), 'garrison'), true);
}
console.log(`PASS active adapter: ${mirrored ? 'post' : 'pre'}-mirror fields/presence`);
