import assert from 'node:assert/strict';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
export const PROFILE = 'localtcp-s2c500-c2s0-v1';
export async function createRelay(options = {}) {
  const { fixture = false, listenPort = 8080, targetPort = 18080, cap = 1048576, maxConnections = 16, totalCap = 4194304 } = options;
  assert.ok(Object.keys(options).every(key => ['fixture', 'listenPort', 'targetPort', 'cap', 'maxConnections', 'totalCap'].includes(key)));
  assert.equal(typeof fixture, 'boolean');
  for (const port of [listenPort, targetPort]) assert.ok(Number.isInteger(port) && port >= 0 && port <= 65535);
  assert.ok(targetPort > 0 && listenPort !== targetPort);
  assert.ok(Number.isInteger(cap) && cap > 0 && cap <= 1048576);
  assert.ok(Number.isInteger(maxConnections) && maxConnections > 0 && maxConnections <= 16);
  assert.ok(Number.isInteger(totalCap) && totalCap > 0 && totalCap <= 4194304);
  if (!fixture) assert.deepEqual([listenPort, targetPort, cap, maxConnections, totalCap], [8080, 18080, 1048576, 16, 4194304]);
  const report = { profile: PROFILE, clock: 'node performance.now milliseconds', connections: [], errors: [], pending: 0, stopped: false };
  const active = new Set(); let stopping = false, stopPromise, resolveFailure;
  const failure = new Promise(resolve => { resolveFailure = resolve; });
  function fail(reason) {
    if (!report.errors.includes(reason)) report.errors.push(reason);
    resolveFailure(reason); stopping = true;
    if (server.listening) server.close();
    for (const c of active) c.abort();
  }
  const server = net.createServer({ allowHalfOpen: true }, downstream => {
    if (stopping || active.size >= maxConnections || report.connections.length >= 64) {
      downstream.destroy(); fail('Connection limit or late acquisition'); return;
    }
    const upstream = net.createConnection({ host: '127.0.0.1', port: targetPort, allowHalfOpen: true });
    const row = { id: report.connections.length + 1, pending: 0, closed: 0, directions: [] };
    report.connections.push(row); const directions = []; let ready = false;
    const c = { row, drain() { for (const d of directions) d.pump(); }, abort() { for (const d of directions) d.dispose(); downstream.destroy(); upstream.destroy(); } };
    active.add(c);
    function direction(source, destination, name, delay) {
      const evidence = { name, delay, received: 0, written: 0, discarded: 0, eof: false, fin: false, chunks: [] };
      row.directions.push(evidence);
      const inputHash = createHash('sha256'), outputHash = createHash('sha256');
      const queue = []; let current, timer, blocked = false, disposed = false;
      const release = chunk => {
        if (!chunk.released) { chunk.released = true; row.pending -= chunk.data.length; report.pending -= chunk.data.length; }
      };
      const finish = () => {
        if ((evidence.eof || stopping) && !queue.length && !current && !evidence.fin && !destination.destroyed) {
          evidence.fin = true; destination.end();
        }
      };
      function pump() {
        if (disposed || current || blocked || !ready) return;
        if (!queue.length) { finish(); if (!stopping && !evidence.eof) source.resume(); return; }
        const remaining = queue[0].record.eligible - performance.now();
        if (remaining > 0) { clearTimeout(timer); timer = setTimeout(pump, Math.ceil(remaining)); return; }
        current = queue.shift(); const chunk = current;
        chunk.record.start = performance.now();
        if (chunk.record.start < chunk.record.eligible) { fail('Early write'); return; }
        try {
          blocked = !destination.write(chunk.data, error => {
            if (disposed) return;
            if (error) { fail('Write callback failure'); return; }
            chunk.record.complete = performance.now();
            if (chunk.record.complete < chunk.record.start) { fail('Nonmonotonic write completion'); return; }
            outputHash.update(chunk.data); evidence.written += chunk.data.length; release(chunk); current = null;
            pump();
          });
          chunk.record.backpressure = blocked;
          if (blocked || row.pending >= 65536) source.pause();
        } catch { fail('Write threw'); }
      }
      source.on('data', data => {
        if (disposed) return;
        const arrived = performance.now(), offset = evidence.received;
        const record = { ordinal: evidence.chunks.length, offset, length: data.length, arrived, eligible: arrived + delay };
        const chunk = { data, record, released: false }; queue.push(chunk);
        evidence.received += data.length; inputHash.update(data); row.pending += data.length; report.pending += data.length;
        if (row.directions.reduce((sum, d) => sum + d.chunks.length, 0) >= 4096 || row.pending > cap || report.pending > totalCap) {
          fail('Buffer or evidence limit'); return;
        }
        evidence.chunks.push(record); if (row.pending >= 65536) source.pause(); pump();
      });
      destination.on('drain', () => { blocked = false; pump(); });
      destination.on('close', () => { if (!disposed && (queue.length || current)) fail('Destination closed before drain'); });
      source.on('end', () => { evidence.eof = true; pump(); });
      source.on('error', () => fail('Socket error'));
      source.on('close', hadError => {
        if (!disposed && (hadError || !evidence.eof)) fail('Premature socket close');
        row.closed++;
        if (row.closed === 2) {
          for (const d of directions) d.finalize(); active.delete(c);
        }
      });
      const d = { pump, dispose() {
        if (disposed) return; disposed = true; clearTimeout(timer);
        for (const chunk of [...queue, ...(current ? [current] : [])]) {
          if (!chunk.released) evidence.discarded += chunk.data.length; release(chunk);
        }
        queue.length = 0; current = null;
      }, finalize() {
        clearTimeout(timer); evidence.inputHash = inputHash.digest('hex'); evidence.outputHash = outputHash.digest('hex');
        if (!disposed && (evidence.received !== evidence.written || evidence.inputHash !== evidence.outputHash)) fail('Incomplete stream');
      } };
      directions.push(d);
    }
    direction(downstream, upstream, 'c2s', 0); direction(upstream, downstream, 's2c', 500);
    upstream.once('connect', () => { ready = true; for (const d of directions) d.pump(); });
  });
  server.on('error', () => fail('Listener error'));
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(listenPort, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
  async function stop() {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      stopping = true;
      const closed = new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); });
      for (const c of active) for (const d of c.row.directions) d.stopRequested = true;
      // pump needs no protocol knowledge: stopping drains each queue then requests FIN.
      const until = performance.now() + 2000;
      while (active.size && performance.now() < until) {
        for (const c of active) c.drain();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (active.size) { fail('Relay shutdown deadline'); await new Promise(resolve => setTimeout(resolve, 20)); }
      await closed; report.stopped = true;
      if (active.size || report.pending) fail('Owned sockets or bytes remain');
      return report;
    })(); return stopPromise;
  }
  return { address: server.address(), report, failure, stop };
}
