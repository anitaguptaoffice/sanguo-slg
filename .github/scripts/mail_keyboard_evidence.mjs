import { isDeepStrictEqual } from 'node:util';
import { createMailStateOracle } from './mail_keyboard_state.mjs';
const requireValue = (value, code = 'MAIL_TRACE_INVALID') => { if (!value) throw new Error(code); };
const same = (a, b) => isDeepStrictEqual(a, b);
const listRoute = 'content.v1.ListPlayerMail', readRoute = 'content.v1.MarkPlayerMailRead';
// Keep every feasible alternative: PostgreSQL COUNT and SELECT are separate statements.
export function verifyMailObservations(states, changes, lists) {
  let feasible = [changes.map(({ sent, received }) => [sent, received])];
  const valid = bounds => {
    for (let i = 1; i < bounds.length; i++) bounds[i][0] = Math.max(bounds[i][0], bounds[i - 1][0]);
    for (let i = bounds.length - 2; i >= 0; i--) bounds[i][1] = Math.min(bounds[i][1], bounds[i + 1][1]);
    return bounds.every(([low, high]) => low <= high);
  };
  requireValue(states.length === changes.length + 1 && feasible[0].every(([a, b]) => Number.isFinite(a) && a <= b));
  for (const list of lists) {
    requireValue(Number.isFinite(list.sent) && Number.isFinite(list.received) && list.sent <= list.received);
    const pages = states.map(rows => rows.filter(row => !list.input.filter || row.status === 0));
    const options = [];
    for (let count = 0; count < states.length; count++) for (let rows = count; rows < states.length; rows++) {
      if (list.output.total_count === pages[count].length && same(list.output.mails, pages[rows].slice(0, list.input.page_size))) options.push([count, rows]);
    }
    const next = new Map();
    for (const prior of feasible) for (const option of options) {
      const bounds = prior.map(pair => [...pair]);
      for (const state of option) {
        if (state) bounds[state - 1][1] = Math.min(bounds[state - 1][1], list.received);
        if (state < changes.length) bounds[state][0] = Math.max(bounds[state][0], list.sent);
      }
      if (valid(bounds)) next.set(JSON.stringify(bounds), bounds);
    }
    requireValue(next.size > 0 && next.size <= 10000, 'MAIL_TRACE_CONCURRENCY');
    feasible = [...next.values()];
  }
}
export function createMailVerifier({ protoRoot, fixtureSpec }) {
  const pending = new Map(), seen = new Set(), counts = {}, observations = [], mutations = [], steps = [];
  let lastTime = -Infinity, phase = 'startup', startup = 0, session = '', identity = {};
  let oracle, step = null, lists = [], reads = [], fixtureWindows = [], sealed = false, poisoned = false;
  const type = name => protoRoot.lookupType(`sanguo.${name}`);
  const decode = (name, bytes) => {
    requireValue(bytes instanceof Uint8Array);
    const schema = type(name), message = schema.decode(bytes);
    // Reject unknown fields, duplicate fields and noncanonical encodings, including nested messages.
    requireValue(Buffer.from(schema.encode(message).finish()).equals(Buffer.from(bytes)));
    return schema.toObject(message, { longs: String, defaults: true });
  };
  const normalizeRows = rows => rows.map(row => {
    const schema = type('content.v1.PlayerMail');
    return schema.toObject(schema.fromObject(row), { longs: String, defaults: true });
  });
  const guard = fn => (...args) => {
    try { requireValue(!sealed && !poisoned); return fn(...args); }
    catch { poisoned = true; throw new Error('MAIL_TRACE_REJECTED'); }
  };
  const time = value => { requireValue(Number.isFinite(value) && value >= lastTime); lastTime = value; };
  const quiescent = () => requireValue(pending.size === 0);
  const expectedStartup = ['account.v1.Login', 'account.v1.Register', 'account.v1.Login', 'account.v1.EnterGameServer', 'world.v1.ListPlayerCities', 'world.v1.CreateCity', 'domestic.v1.GetCityState'];
  const requestPolicy = (route, input) => {
    if (route === 'account.v1.ListGameServers') return requireValue(phase === 'startup' && startup === 0 && !counts[route] && same(input, { page: 1, page_size: 50 }));
    if (phase === 'startup') {
      requireValue(route === expectedStartup[startup] && pending.size === 0 && counts['account.v1.ListGameServers'] === 1);
      if (route === 'account.v1.Login') requireValue(same(input, { login_name: 'demo', password: 'demo123', server_id: 1 }));
      else if (route === 'account.v1.Register') requireValue(same(input, { login_name: 'demo', password: 'demo123' }));
      else if (route === 'account.v1.EnterGameServer') requireValue(same(input, { server_id: 1 }));
      else if (route === 'world.v1.ListPlayerCities') requireValue(same(input, { city_ids: [] }));
      else if (route === 'world.v1.CreateCity') requireValue(same(input, { server_id: 1, name: '主城', x: 60, y: 60 }));
      else requireValue(same(input, { city_id: identity.city_id }));
      return;
    }
    const fixed = {
      'domestic.v1.GetCityState': { city_id: identity.city_id },
      'world.v1.ListPlayerCities': { city_ids: [] },
      'military.v1.ListMarches': { city_id: identity.city_id, limit: 20, offset: 0 },
      'military.v1.ListBattleReports': { limit: 20, offset: 0 },
      'hero.v1.ListPlayerHeroes': { server_id: 1, page_size: 50, page_offset: 0 },
      'hero.v1.GetCityChief': { server_id: 1, city_id: identity.city_id },
      'content.v1.ListPlayerBag': { server_id: 1 },
      'quest.v1.ListPlayerQuests': { server_id: 1, chain_id: 400, include_completed: true },
      'chat.v1.ListChatMessages': { server_id: 1, channel: 1, guild_id: '0', peer_player_id: '0', before_message_id: '0', limit: 30 },
    };
    if (route === listRoute) requireValue(input.server_id === 1 && input.page_offset === 0 &&
      ((input.filter === 0 && input.page_size === 50) || (input.filter === 1 && [1, 50].includes(input.page_size))));
    else if (route === readRoute) requireValue(phase === 'step' && step.expectedReadId && reads.length === 0 && same(input, { server_id: 1, mail_id: step.expectedReadId }));
    else requireValue(Object.hasOwn(fixed, route) && same(input, fixed[route]));
  };
  const acceptOutputs = rows => { for (const row of rows) observations[row.observation].mail = structuredClone(row.output); };
  const api = {
    observeSent: guard((bytes, at) => {
      time(at); const packet = decode('common.v1.ClientPacket', bytes), route = packet.route;
      requireValue(packet.trace_id && !seen.has(packet.trace_id));
      requireValue(packet.server_id === (session ? 1 : 0) && packet.session_id === session);
      const input = decode(`${route}Request`, packet.payload); requestPolicy(route, input);
      const observation = { id: observations.length + 1, route, sent: at };
      if ([listRoute, readRoute].includes(route)) observation.request = structuredClone(input);
      observations.push(observation);
      const row = { route, input, sent: at, observation: observations.length - 1 }; pending.set(packet.trace_id, row); seen.add(packet.trace_id);
      if (route === readRoute) reads.push(row);
      counts[route] = (counts[route] ?? 0) + 1;
    }),
    observeReceived: guard((bytes, at) => {
      time(at); const packet = decode('common.v1.ServerPacket', bytes), row = pending.get(packet.trace_id);
      requireValue(row && at >= row.sent); pending.delete(packet.trace_id); row.received = at;
      Object.assign(observations[row.observation], { received: at, code: packet.code });
      if (phase === 'startup' && startup === 0 && row.route === 'account.v1.Login') {
        requireValue(packet.code === 20001 && packet.data.length === 0); startup++; return;
      }
      requireValue(packet.code === 0); row.output = decode(`${row.route}Response`, packet.data);
      const output = row.output;
      if (row.route === 'account.v1.ListGameServers') {
        requireValue(output.servers.some(server => server.shard?.server_id === 1)); return;
      }
      if (phase === 'startup') {
        if (row.route === 'account.v1.Register') { requireValue(BigInt(output.account_id) > 0n); identity.account_id = output.account_id; }
        if (row.route === 'account.v1.Login' || row.route === 'account.v1.EnterGameServer') {
          requireValue(output.session_id && output.player?.server_id === 1 && BigInt(output.player.player_id) > 0n);
          if (session) requireValue(output.session_id === session && output.player.player_id === identity.player_id && output.account_id === identity.account_id && output.server_id === 1);
          session = output.session_id; identity = { ...identity, server_id: 1, player_id: output.player.player_id };
        }
        if (row.route === 'world.v1.ListPlayerCities') requireValue(output.cities.length === 0);
        if (row.route === 'world.v1.CreateCity') {
          requireValue(output.city && BigInt(output.city.city_id) > 0n && output.city.x === 60 && output.city.y === 60 && output.city.name === '主城');
          identity.city_id = output.city.city_id;
        }
        startup++; if (startup === expectedStartup.length) phase = 'idle';
      } else if (row.route === listRoute) lists.push(row);
      else if (row.route === 'world.v1.ListPlayerCities') requireValue(output.cities.length === 1 && output.cities[0].city_id === identity.city_id);
    }),
    identity: guard(() => { requireValue(startup === expectedStartup.length); return structuredClone(identity); }),
    beginFixtures: guard(snapshot => {
      requireValue(phase === 'idle' && !oracle); quiescent();
      oracle = createMailStateOracle({ identity, fixtureSpec }); oracle.beginFixtures(snapshot);
      verifyMailObservations([[]], [], lists); acceptOutputs(lists); lists = []; phase = 'fixtures';
    }),
    acceptFixture: guard((receipt, sent, received) => {
      requireValue(phase === 'fixtures' && fixtureWindows.length < 4 && Number.isFinite(sent) && Number.isFinite(received) && sent <= received);
      if (fixtureWindows.length) requireValue(sent >= fixtureWindows.at(-1).received);
      fixtureWindows.push({ receipt, sent, received });
    }),
    finishFixtures: guard(snapshot => {
      requireValue(phase === 'fixtures' && fixtureWindows.length === 4); quiescent();
      const result = oracle.finishFixtures(snapshot, fixtureWindows.map(row => row.receipt));
      const final = normalizeRows(result.after);
      const states = [[], ...[1, 2, 3, 4].map(n => final.slice(4 - n))];
      verifyMailObservations(states, fixtureWindows, lists); acceptOutputs(lists);
      mutations.push(...fixtureWindows.map(({sent, received}, index) => ({kind: 'fixture', index, sent, received}))); lists = []; phase = 'ready'; return result;
    }),
    beginStep: guard(({ expectedReadId = null }) => {
      requireValue(phase === 'ready'); quiescent();
      requireValue(expectedReadId === null || Object.values(oracle.ids()).includes(expectedReadId));
      step = { expectedReadId, firstObservation: observations.length + 1 }; reads = []; phase = 'step';
    }),
    endStep: guard(snapshot => {
      requireValue(phase === 'step'); quiescent();
      requireValue(reads.length === (step.expectedReadId ? 1 : 0));
      const result = oracle.advance(snapshot, step.expectedReadId);
      const before = normalizeRows(result.before), after = normalizeRows(result.after);
      if (reads.length) requireValue(same(reads[0].output.mail, after.find(row => row.mail_id === step.expectedReadId)));
      verifyMailObservations(reads.length ? [before, after] : [before], reads, lists);
      steps.push({ ...step, lastObservation: observations.length, before, after });
      acceptOutputs([...lists, ...reads]); mutations.push(...reads.map(({sent, received}) => ({kind: 'read', id: step.expectedReadId, sent, received})));
      lists = []; reads = []; step = null; phase = 'ready'; return result;
    }),
    finish: guard(snapshot => {
      requireValue(phase === 'ready'); quiescent();
      const result = oracle.advance(snapshot, null);
      verifyMailObservations([normalizeRows(result.after)], [], lists); acceptOutputs(lists); oracle.finish(snapshot); sealed = true;
      return { resultKind: 'mail-trace-verified', nativeAcceptance: false, counts: { ...counts } };
    }),
    ids: guard(() => oracle.ids()),
    get pendingCount() { return pending.size; },
    evidence: () => ({ phase: poisoned ? 'rejected' : phase, complete: sealed, nativeAcceptance: false, counts: { ...counts }, observations: structuredClone(observations), mutations: structuredClone(mutations), steps: structuredClone(steps) }),
  };
  return api;
}
