const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const protobuf = require('protobufjs');
const root = new protobuf.Root();
root.resolvePath = (_, target) => path.resolve(__dirname, target);
root.loadSync('sanguo/account/v1/account.proto', { keepCase: true });
root.resolveAll();
const response = root.lookupType('sanguo.account.v1.EnterGameServerResponse');
const descriptor = root.toJSON();
delete descriptor.nested.sanguo.nested.account.nested.v1.nested
  .EnterGameServerResponse.fields.account_id;
const legacyRoot = protobuf.Root.fromJSON(descriptor).resolveAll();
const legacy = legacyRoot.lookupType('sanguo.account.v1.EnterGameServerResponse');
const encode = (type, value) => type.encode(type.fromObject(value)).finish();
const plain = (type, value) => type.toObject(value, { longs: String });
const bytes = hex => Buffer.from(hex, 'hex');

test('one additive field; all baseline account and common descriptors unchanged', () => {
  assert.deepEqual(response.fieldsArray.map(f => [f.id, f.name, f.type, f.repeated]), [
    [1, 'session_id', 'string', false], [2, 'server_id', 'int32', false],
    [3, 'player', 'sanguo.common.v1.PlayerProfile', false],
    [4, 'wallet', 'sanguo.common.v1.ResourceWallet', false],
    [5, 'session_expires_at_ms', 'int64', false], [6, 'account_id', 'int64', false],
  ]);
  // Independently generated from the untouched 7079f87 baseline, not a new oracle.
  assert.equal(createHash('sha256').update(JSON.stringify(descriptor)).digest('hex'),
    '828eeb01a0a732c29aaf697ad31d2e90e907063f9352424833019f2af12e6ef9');
});

test('fixed legacy bytes and old/new interoperability preserve all old fields', () => {
  const value = { session_id: 's', server_id: 2,
    player: { server_id: 2, player_id: '3', display_name: 'n', level: 4, power: '5' },
    wallet: { food: '6', wood: '7', iron: '8', stone: '9', gold: '10' },
    session_expires_at_ms: '11' };
  const oldBytes = encode(legacy, value);
  assert.equal(Buffer.from(oldBytes).toString('hex'),
    '0a017310021a0b080210031a016e20042805220a0806100718082009280a280b');
  const newBytes = encode(response, { ...value, account_id: '12' });
  assert.deepEqual(Buffer.from(newBytes), Buffer.concat([Buffer.from(oldBytes), bytes('300c')]));
  assert.deepEqual(plain(legacy, legacy.decode(newBytes)), plain(legacy, legacy.decode(oldBytes)));
  const fromOld = response.decode(oldBytes);
  assert.equal(Object.hasOwn(fromOld, 'account_id'), false);
  assert.equal(fromOld.account_id.toString(), '0');
  assert.deepEqual(plain(response, fromOld), plain(legacy, legacy.decode(oldBytes)));
  // Unknown field skipping must work before existing fields too.
  assert.deepEqual(plain(legacy, legacy.decode(Buffer.concat([bytes('300c'), oldBytes]))),
    plain(legacy, legacy.decode(oldBytes)));
});

test('missing and explicit zero both lack usable identity, without breaking entry wire', () => {
  const absent = response.decode(bytes(''));
  const zero = response.decode(bytes('3000'));
  assert.equal(Object.hasOwn(absent, 'account_id'), false);
  assert.equal(Object.hasOwn(zero, 'account_id'), true);
  assert.equal(absent.account_id.toString(), '0');
  assert.equal(zero.account_id.toString(), '0');
  assert.deepEqual(plain(legacy, legacy.decode(bytes('3000'))), {});
});

test('positive int64 identities use exact tag6 fixtures without Number narrowing', () => {
  for (const [id, hex] of [
    ['1', '3001'], ['9007199254740991', '30ffffffffffffff0f'],
    ['9007199254740992', '308080808080808010'],
    ['9007199254740993', '308180808080808010'],
    ['9223372036854775807', '30ffffffffffffffff7f'],
  ]) {
    assert.equal(Buffer.from(encode(response, { account_id: id })).toString('hex'), hex);
    assert.equal(response.decode(bytes(hex)).account_id.toString(), id);
    assert.deepEqual(plain(legacy, legacy.decode(bytes(hex))), {});
  }
});

test('negative int64 values are representable, not valid authenticated identities', () => {
  for (const [id, hex] of [
    ['-1', '30ffffffffffffffffff01'],
    ['-9223372036854775808', '3080808080808080808001'],
  ]) {
    assert.equal(Buffer.from(encode(response, { account_id: id })).toString('hex'), hex);
    assert.equal(response.decode(bytes(hex)).account_id.toString(), id);
  }
});

test('truncated field6 varints reject rather than inventing identity', () => {
  for (const hex of ['30', '3080', '30808080808080808080']) {
    assert.throws(() => response.decode(bytes(hex)));
    assert.throws(() => legacy.decode(bytes(hex)));
  }
});
