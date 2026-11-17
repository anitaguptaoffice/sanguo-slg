// Run with the repository's locked client protobufjs dependency (see RECRUIT-V2.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const protobuf = require('protobufjs');
const root = new protobuf.Root();
root.resolvePath = (_, target) => path.resolve(__dirname, target);
root.loadSync(['sanguo/military/v1/military.proto', 'sanguo/common/v1/envelope.proto'], { keepCase: true });
root.resolveAll();
const military = root.lookup('sanguo.military.v1');
const request = military.lookupType('RecruitTroopV2Request');
const response = military.lookupType('RecruitTroopV2Response');
const acceptance = military.lookupType('RecruitAcceptance');
const errors = root.lookupEnum('sanguo.common.v1.ErrorCode');
const fields = type => type.fieldsArray.map(f => [f.id, f.name, f.type, f.repeated]);
const roundTrip = (type, value) => type.decode(type.encode(type.fromObject(value)).finish());
const hex = (type, value) => Buffer.from(type.encode(type.fromObject(value)).finish()).toString('hex');

test('exact adopted descriptor and distinct route', () => {
  assert.deepEqual(fields(request), [
    [1, 'city_id', 'int64', false], [2, 'unit_cfg_id', 'int32', false],
    [3, 'count', 'int32', false], [4, 'command_id', 'bytes', false],
    [5, 'intent_version', 'uint32', false],
  ]);
  assert.deepEqual(fields(response), [[1, 'acceptance', 'RecruitAcceptance', false]]);
  const names = ['queue_id', 'city_id', 'unit_cfg_id', 'count', 'food_paid', 'wood_paid',
    'iron_paid', 'stone_paid', 'duration_sec', 'initial_status', 'accepted_at_ms',
    'initial_start_at_ms', 'initial_finish_at_ms', 'catalog_version', 'rule_digest'];
  assert.deepEqual(fields(acceptance), names.map((name, i) =>
    [i + 1, name, i >= 13 ? 'bytes' : [2, 3, 9].includes(i) ? 'int32' : 'int64', false]));
  const source = readFileSync(path.join(__dirname, 'sanguo/military/v1/military.proto'), 'utf8');
  assert.equal((source.match(/^\/\/ route: military\.v1\.RecruitTroopV2$/gm) || []).length, 1);
  assert.equal(errors.values.MILITARY_RECRUIT_INTENT_CONFLICT, 50008);
  assert.equal(Object.values(errors.values).filter(v => v === 50008).length, 1);
});

test('all pre-existing message and enum descriptors remain unchanged', () => {
  const descriptor = root.toJSON();
  const m = descriptor.nested.sanguo.nested.military.nested.v1.nested;
  delete m.RecruitTroopV2Request; delete m.RecruitTroopV2Response; delete m.RecruitAcceptance;
  delete descriptor.nested.sanguo.nested.common.nested.v1.nested.ErrorCode.values.MILITARY_RECRUIT_INTENT_CONFLICT;
  const digest = createHash('sha256').update(JSON.stringify(descriptor)).digest('hex');
  assert.equal(digest, '6b61d7ae0298d3940c5a51de9e2225b62d6cc64ece3371036970967e6810def7');
});

test('request exact bytes and full uint32 versions survive without narrowing', () => {
  const value = { city_id: '1', unit_cfg_id: 2, count: 3,
    command_id: Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'), intent_version: 1 };
  assert.equal(hex(request, value), '0801100218032210000102030405060708090a0b0c0d0e0f2801');
  for (const version of [0, 1, 2, 32768, 65537, 4294967295]) {
    const decoded = roundTrip(request, { ...value, intent_version: version });
    assert.equal(decoded.intent_version, version);
    assert.deepEqual(Buffer.from(decoded.command_id), value.command_id);
  }
});

test('immutable acceptance exact field tags and bytes', () => {
  const value = { queue_id: '1', city_id: '2', unit_cfg_id: 3, count: 4,
    food_paid: '5', wood_paid: '6', iron_paid: '7', stone_paid: '8', duration_sec: '9',
    initial_status: 0, accepted_at_ms: '11', initial_start_at_ms: '12', initial_finish_at_ms: '13',
    catalog_version: Buffer.from('recruit-v1:' + 'a'.repeat(64)), rule_digest: Buffer.alloc(32, 0xbb) };
  const body = '0801100218032004280530063807400848095000580b600c680d724b' +
    Buffer.from('recruit-v1:' + 'a'.repeat(64)).toString('hex') + '7a20' + 'bb'.repeat(32);
  assert.equal(hex(acceptance, value), body);
  assert.equal(hex(response, { acceptance: value }), '0a8901' + body);
  const decoded = roundTrip(response, { acceptance: value }).acceptance;
  assert.equal(decoded.initial_status, 0);
  assert.deepEqual(Buffer.from(decoded.catalog_version), value.catalog_version);
  assert.deepEqual(Buffer.from(decoded.rule_digest), value.rule_digest);
});

test('signed int64 and int32 extremes are lossless codec values, not admission approval', () => {
  for (const value of ['-9223372036854775808', '-62135596800000', '0',
    '253402300799999', '9007199254740993', '9223372036854775807']) {
    for (const field of acceptance.fieldsArray.filter(f => f.type === 'int64')) {
      assert.equal(roundTrip(acceptance, { [field.name]: value })[field.name].toString(), value);
    }
    assert.equal(roundTrip(request, { city_id: value }).city_id.toString(), value);
  }
  for (const value of [-2147483648, 2147483647]) {
    assert.equal(roundTrip(request, { unit_cfg_id: value, count: value }).count, value);
    assert.equal(roundTrip(request, { unit_cfg_id: value }).unit_cfg_id, value);
  }
});

test('missing success and malformed frames remain distinguishable', () => {
  assert.equal(Object.hasOwn(response.decode(Buffer.alloc(0)), 'acceptance'), false);
  assert.equal(Object.hasOwn(response.decode(Buffer.from('0a00', 'hex')), 'acceptance'), true);
  // Empty acceptance is representable but MUST fail a future application invariant validator.
  for (const bytes of ['0a02', '0a0180']) assert.throws(() => response.decode(Buffer.from(bytes, 'hex')));
  assert.throws(() => request.decode(Buffer.from('221000', 'hex')));
  // Protobuf itself does not enforce command length/nonzero or supported-version semantics.
  for (const key of [Buffer.alloc(0), Buffer.alloc(16), Buffer.alloc(15)]) {
    assert.deepEqual(Buffer.from(roundTrip(request, { command_id: key }).command_id), key);
  }
});

test('legacy request and response golden bytes unchanged', () => {
  assert.equal(hex(military.lookupType('RecruitTroopRequest'),
    { city_id: '1', unit_cfg_id: 2, count: 3 }), '080110021803');
  assert.equal(hex(military.lookupType('RecruitTroopResponse'),
    { queue_id: '1', finish_at_ms: '2' }), '18012002');
});
