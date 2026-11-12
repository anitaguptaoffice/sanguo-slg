import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { createRelay, PROFILE } from './live_chat_tcp_delay.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }
async function fixture(handler, options = {}) {
  const peers = new Set();
  const server = net.createServer({ allowHalfOpen: true }, socket => {
    peers.add(socket); socket.on('error', () => {}); socket.on('close', () => peers.delete(socket)); handler(socket);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const relay = await createRelay({ fixture: true, listenPort: 0, targetPort: server.address().port, ...options });
  const clients = new Set();
  async function connect() {
    const socket = net.createConnection({ host: '127.0.0.1', port: relay.address.port, allowHalfOpen: true });
    clients.add(socket); socket.on('error', () => {}); socket.on('close', () => clients.delete(socket));
    await once(socket, 'connect'); return socket;
  }
  async function close() {
    const report = await relay.stop();
    for (const socket of [...clients, ...peers]) socket.destroy();
    await new Promise(resolve => server.close(resolve)); return report;
  }
  return { relay, connect, close, peers };
}
function received(socket) {
  const parts = []; socket.on('data', data => parts.push(data));
  return { parts, end: new Promise(resolve => socket.once('end', () => resolve(Buffer.concat(parts)))) };
}
function clean(report) {
  assert.equal(report.profile, PROFILE); assert.deepEqual(report.errors, []);
  assert.equal(report.stopped, true); assert.equal(report.pending, 0);
  for (const c of report.connections) {
    assert.equal(c.pending, 0); assert.equal(c.closed, 2);
    for (const d of c.directions) {
      assert.equal(d.discarded, 0); assert.equal(d.received, d.written); assert.equal(d.inputHash, d.outputHash);
      let offset = 0;
      d.chunks.forEach((chunk, i) => {
        assert.equal(chunk.ordinal, i); assert.equal(chunk.offset, offset); offset += chunk.length;
        assert.equal(chunk.eligible, chunk.arrived + d.delay);
        assert.ok(chunk.start >= chunk.eligible); assert.ok(chunk.complete >= chunk.start);
      });
      assert.equal(offset, d.received);
    }
  }
}
await check('strict endpoint and native settings', async () => {
  for (const options of [{ host: 'example.com' }, { targetPort: 0 }, { listenPort: 8080, targetPort: 8080 },
    { listenPort: -1 }, { targetPort: 65536 }, { targetPort: 1.5 }, { cap: 0 }, { cap: 1048577 },
    { maxConnections: 17 }, { maxConnections: 0 }, { fixture: 'true' }, { listenPort: 0 }, { delay: 0 }]) {
    await assert.rejects(createRelay(options));
  }
});
await check('binary fidelity, segmentation, FIFO and minimum delay', async () => {
  const sent = Buffer.from(Array.from({ length: 256 }, (_, i) => i)); let actual;
  const f = await fixture(socket => {
    const r = received(socket); r.end.then(bytes => { actual = bytes; socket.write(bytes.subarray(0, 13)); socket.end(bytes.subarray(13)); });
  });
  try {
    const c = await f.connect(), r = received(c), started = performance.now();
    c.write(sent.subarray(0, 3)); await pause(20); c.end(sent.subarray(3));
    assert.deepEqual(await r.end, sent); assert.deepEqual(actual, sent);
    assert.ok(performance.now() - started >= 500); await pause(20); clean(await f.close());
  } finally { await f.close(); }
});
await check('parallel health-like connections and independent half-closes', async () => {
  const f = await fixture(socket => { socket.write('greeting'); socket.on('data', data => socket.write(data)); socket.on('end', () => socket.end('tail')); });
  try {
    const clients = await Promise.all([f.connect(), f.connect(), f.connect()]);
    const results = clients.map((c, i) => { const r = received(c); c.end(`own${i}`); return r.end; });
    const values = await Promise.all(results);
    values.forEach((bytes, i) => assert.equal(bytes.toString(), `greetingown${i}tail`));
    await pause(20); const report = await f.close(); clean(report); assert.equal(report.connections.length, 3);
  } finally { await f.close(); }
});
await check('large full-duplex transfer and slow reader backpressure', async () => {
  const payload = Buffer.alloc(512 * 1024, 177); let upstreamBytes;
  const f = await fixture(socket => {
    const r = received(socket); socket.write(payload); r.end.then(bytes => { upstreamBytes = bytes; socket.end(); });
  });
  try {
    const c = await f.connect(), r = received(c); c.pause(); c.end(payload);
    await pause(650); c.resume(); assert.deepEqual(await r.end, payload); assert.deepEqual(upstreamBytes, payload);
    await pause(30); const report = await f.close(); clean(report);
  } finally { await f.close(); }
});
await check('stop drains queued bytes and closes idle pooled sockets', async () => {
  const f = await fixture(socket => { socket.write('queued'); socket.on('end', () => socket.end()); });
  try {
    const c = await f.connect(), r = received(c); await pause(40);
    const stopped = f.relay.stop(); assert.equal((await r.end).toString(), 'queued'); c.end();
    clean(await stopped); await f.close();
  } finally { await f.close(); }
});
await check('buffer overflow fails rather than silently dropping', async () => {
  const f = await fixture(socket => { socket.write(Buffer.alloc(1024)); }, { cap: 128 });
  try { const c = await f.connect(); c.resume(); await f.relay.failure; const report = await f.close();
    assert.ok(report.errors.includes('Buffer or evidence limit')); assert.equal(report.pending, 0);
    assert.ok(report.connections.some(row => row.directions.some(d => d.discarded > 0)));
  } finally { await f.close(); }
});
await check('connection cap is explicit failure', async () => {
  const f = await fixture(() => {}, { maxConnections: 1 });
  try { await f.connect(); await f.connect(); await f.relay.failure;
    assert.ok((await f.close()).errors.includes('Connection limit or late acquisition'));
  } finally { await f.close(); }
});
await check('reset while delayed bytes pending fails and cleans', async () => {
  const f = await fixture(socket => { socket.write('pending'); setTimeout(() => socket.resetAndDestroy(), 30); });
  try { const c = await f.connect(); c.resume(); await f.relay.failure;
    const report = await f.close(); assert.ok(report.errors.length); assert.equal(report.pending, 0);
  } finally { await f.close(); }
});
await check('upstream connection failure never reconnects', async () => {
  const unavailable = net.createServer(); unavailable.listen(0, '127.0.0.1'); await once(unavailable, 'listening');
  const port = unavailable.address().port; await new Promise(resolve => unavailable.close(resolve));
  const relay = await createRelay({ fixture: true, listenPort: 0, targetPort: port });
  const client = net.createConnection(relay.address.port, '127.0.0.1'); client.on('error', () => {}); client.resume();
  await relay.failure; const report = await relay.stop(); client.destroy();
  assert.equal(report.connections.length, 1); assert.ok(report.errors.length); assert.equal(report.pending, 0);
});
await check('listener address conflict rejected without leaked listener', async () => {
  const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await assert.rejects(createRelay({ fixture: true, listenPort: server.address().port, targetPort: 1 })); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
await check('reset during backpressured upload fails without replay', async () => {
  const f = await fixture(socket => socket.pause());
  try {
    const c = await f.connect(); c.resume(); c.write(Buffer.alloc(32 * 1024 * 1024, 93));
    for (let n = 0; n < 200 && !f.relay.report.connections[0]?.directions[0].chunks.some(chunk => chunk.backpressure); n++) await pause(10);
    for (const peer of f.peers) peer.resetAndDestroy();
    await f.relay.failure; const report = await f.close(); assert.ok(report.errors.length);
    assert.equal(report.connections.length, 1); assert.equal(report.pending, 0);
    assert.ok(report.connections[0].directions[0].chunks.some(chunk => chunk.backpressure));
  } finally { await f.close(); }
});
await check('uncooperative half-open peer times out, never clean success', async () => {
  const f = await fixture(socket => socket.resume());
  try {
    const c = await f.connect(); c.resume(); await pause(20);
    const report = await f.relay.stop(); assert.ok(report.errors.includes('Relay shutdown deadline'));
    assert.equal(report.pending, 0); assert.equal(await f.relay.stop(), report);
  } finally { await f.close(); }
});
await check('aggregate queued caps across distinct connections release once', async () => {
  const f = await fixture(socket => socket.write(Buffer.alloc(80)), { cap: 128, totalCap: 128 });
  try { const first = await f.connect(); first.resume(); await pause(30);
    const second = await f.connect(); second.resume(); await f.relay.failure;
    const report = await f.close(); assert.ok(report.errors.includes('Buffer or evidence limit'));
    assert.equal(report.pending, 0); assert.equal(report.connections.length, 2);
    assert.ok(report.connections.every(c => c.pending === 0));
  } finally { await f.close(); }
});
await check('actual write(false) drains then forwards every byte exactly once', async () => {
  const bytes = Buffer.alloc(32 * 1024 * 1024, 49); let delivered;
  const f = await fixture(socket => { socket.pause(); const r = received(socket);
    r.end.then(data => { delivered = data; socket.end('done'); }); });
  try { const c = await f.connect(), r = received(c); c.end(bytes);
    for (let n = 0; n < 200 && !f.relay.report.connections[0]?.directions[0].chunks.some(chunk => chunk.backpressure); n++) await pause(10);
    assert.ok(f.relay.report.connections[0].directions[0].chunks.some(chunk => chunk.backpressure));
    for (const peer of f.peers) peer.resume();
    assert.equal((await r.end).toString(), 'done'); assert.deepEqual(delivered, bytes);
    await pause(20); clean(await f.close());
  } finally { await f.close(); }
});
console.log(`${passed} relay groups passed; actual TCP only, no native/product acceptance`);
