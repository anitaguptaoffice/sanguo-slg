import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import protobuf from 'protobufjs';
import { WebSocketServer } from 'ws';

// Deliberately controlled protocol peer, not an implementation of V2 authority.
export async function startPeer(client) {
  const root = new protobuf.Root();
  for (const file of ['common/v1/envelope', 'common/v1/types', 'account/v1/account', 'world/v2/first_city']) {
    protobuf.parse(readFileSync(resolve(client, '../spec/proto/sanguo', `${file}.proto`), 'utf8'), root, { keepCase: true });
  }
  root.resolveAll();
  const type = name => root.lookupType(`sanguo.${name}`);
  const encode = (name, value) => type(name).encode(type(name).fromObject(value)).finish();
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const peer = { mode: 'success', packets: [], errors: [], effects: [], url: `ws://127.0.0.1:${server.address().port}` };
  const base = { realm_id: '11111111-1111-4111-8111-111111111111', server_id: 1,
    player_id: '9007199254740993', account_id: '9223372036854775807' };
  const record = (scope, proposal, terminal = false) => ({
    canonical: { scope, proposal, operation: 'world.first_city', operation_version: 2, canonical_version: 1 },
    template: { template_version: 'qa1', rules_version: 'qa1', catalog_version: 'qa1',
      content_encoding_version: 1, content_sha256: new Uint8Array(32) },
    ...(terminal ? { succeeded: { city_id: '9223372036854775807', server_id: scope.server_id,
      player_id: scope.player_id, is_capital: true, wall_level: 1, morale: 100 } } : { pending: {} }),
  });
  const waiting = [];
  server.on('connection', (socket, req) => {
    const scope = { ...base }, actor = new URL(req.url, peer.url).searchParams.get('actor');
    if (actor === 'realm') scope.realm_id = '44444444-4444-4444-8444-444444444444';
    if (actor === 'shard') scope.server_id = 2;
    if (actor === 'player') scope.player_id = '9007199254740992';
    if (actor === 'account') scope.account_id = '9007199254740993';
    socket.on('message', (bytes, binary) => {
      try {
        if (!binary) throw Error('Unexpected text frame');
        const packet = type('common.v1.ClientPacket').decode(bytes), route = packet.route;
        const reply = value => {
          const data = encode(`${route}Response`, value);
          if (route.startsWith('world.v2.')) peer.packets.push({ direction: 'response', route, trace: packet.trace_id, data: Buffer.from(data).toString('hex') });
          socket.send(encode('common.v1.ServerPacket', { data, trace_id: packet.trace_id }));
        };
        if (route === 'account.v1.Login') return reply({ session_id: 'qa-synthetic-session' });
        if (!route.startsWith('world.v2.')) throw Error(`Unexpected route ${route}`);
        const request = type(`${route}Request`).toObject(type(`${route}Request`).decode(packet.payload), { longs: String });
        peer.packets.push({ direction: 'request', route, trace: packet.trace_id, data: Buffer.from(packet.payload).toString('hex') });
        if (route.endsWith('DiscoverFirstCityIntent')) return reply({ scope, head: { empty: {} } });
        const id = request.proposal?.command_id ?? request.command_id;
        if (route.endsWith('GetFirstCityResult')) return reply({ outcome: { scope, kind: 4, requested_command_id: id, head: { empty: {} } } });
        peer.effects.push({ route, request });
        if (peer.mode === 'drop') return;
        if (peer.mode === 'race') {
          waiting.push({ scope, request, reply });
          if (waiting.length === 2) {
            const winner = record(waiting[0].scope, waiting[0].request.proposal);
            waiting.splice(0).forEach((entry, index) => entry.reply({ outcome: { scope: entry.scope,
              kind: index ? 3 : 1, requested_command_id: entry.request.proposal.command_id,
              ...(index ? {} : { command: winner }), head: { command: winner } } }));
          }
          return;
        }
        const command = record(scope, request.proposal, true);
        reply({ outcome: { scope, kind: 1, requested_command_id: id, command, head: { command } } });
      } catch (error) { peer.errors.push(String(error.stack)); socket.close(); }
    });
  });
  peer.close = async () => {
    for (const socket of server.clients) socket.terminate();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    peer.closed = server.clients.size === 0;
  };
  return peer;
}
