import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { withHeroRuntime, redact, deadlineRace } from './live_hero_layout_runtime.mjs';
import { InfrastructureError, withProbe, installProbe, validate, trials, preparation, directions, cityRoute } from './live_hero_focus_probe.mjs';
class ValidationError extends Error {}
const pure = (stage, value, expected) => { try { validate(stage, value, expected); } catch (cause) { throw new ValidationError(`${stage}: ${cause.message}`); } };
const freeze = value => { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return value; };
export function lifetime(deadline, now = Date.now) {
  let terminal;
  const stop = reason => { terminal ||= new InfrastructureError(String(reason)); };
  const guard = () => { if (now() >= deadline) stop('Absolute A deadline elapsed'); if (terminal) throw terminal; };
  const operation = async run => { guard(); const value = await run(); guard(); return value; };
  const write = run => { guard(); return run(); };
  return { stop, guard, operation, write };
}
function bindStop(life, emitter, event) {
  const stop = () => life.stop(event);
  emitter.once(event, stop);
  return () => emitter.removeListener(event, stop);
}
export async function ordinary(run, life, record) {
  try { await run(); life.guard(); }
  catch (error) { if (!(error instanceof ValidationError)) throw error; life.write(() => record(redact(error.message))); }
}
const objects = {
  baseline: { head: 'a7cd2a0fdee5dc2f88c90c1b8f5049afd40dcbe4', tree: '3b0acf7b911042976ebb8873e7ffdac909740c25', parents: ['757e43a9f40d7c92ded6a536ec334de94d69ff6f'] },
  fixed: { head: '8377286caa24e39defb2d8bbaa867c07f4b948bb', tree: '46a579e4baac2e40ec38223384ec630b26b8389e', parents: ['a7cd2a0fdee5dc2f88c90c1b8f5049afd40dcbe4'] },
  runtime: { head: '7dc5939f9753a8aa59c94f7101c62a8e4a8eda79', tree: 'dc151c5513ea2a2d937e45d4dee12d9f59792c7e', parents: ['757e43a9f40d7c92ded6a536ec334de94d69ff6f'] },
};
function gitObject(cwd) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 2000 }).trim();
  return { head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), parents: git('show', '-s', '--format=%P', 'HEAD').split(' '), clean: !git('status', '--porcelain', '--untracked-files=no') };
}
async function verify(h, life) {
  const { page, panel, hero, report, save, responseAfter, settled } = h;
  const { guard, operation: op, write } = life, variant = process.env.QA_FOCUS_VARIANT;
  const identity = { product: process.env.QA_PRODUCT, productObject: gitObject('..'), runtimeObject: gitObject('../../runtime-source'), qaObject: gitObject('../../qa-source') };
  const expected = { product: 'standalone', productObject: { ...objects[variant], clean: true }, runtimeObject: { ...objects.runtime, clean: true }, qaObject: { ...identity.qaObject, head: process.env.QA_HEAD, clean: true } };
  const session = { schemaVersion: 1, variant, viewport: { width: report.width, height: report.height }, provenance: identity, trials: [], directions: [], screenshots: [] };
  const publish = () => write(() => { report.focus = freeze(structuredClone(session)); save(); });
  const unbindPage = bindStop(life, page, 'close');
  const boundary = () => { guard(); const rows = report.requests.map(({ id, route, sentAt, receivedAt, code }) => ({ id, route, sentAt, receivedAt, code })); return { wall: Date.now(), rows, watermark: rows.at(-1)?.id ?? 0 }; };
  const snapshot = handle => op(() => handle.evaluate(probe => probe.snapshot()));
  async function capture(handle, label) {
    const before = await snapshot(handle); publish();
    await op(() => page.screenshot({ path: path.join(process.env.QA_OUT, `${label}.png`), timeout: 5000 }));
    const after = await snapshot(handle); write(() => session.screenshots.push({ label, before, after })); publish();
  }
  async function native(handle, key, from, open) {
    guard(); const start = Date.now(), before = await snapshot(handle);
    pure('before-input', before, [from, open]);
    await op(() => key === 'click' ? panel.locator('[data-role="hero-recruit-host"] > summary').click({ timeout: 2000 }) : page.keyboard.press(key));
    const after = await snapshot(handle); guard(); const end = Date.now();
    return { key, start, end, before, after, enclosure: [start, end] };
  }
  try {
    await ordinary(async () => {
      pure('identity', session, expected); publish();
      await withProbe(() => page.evaluateHandle(installProbe), async handle => {
      await capture(handle, 'initial-before-detail');
      const response = await op(() => responseAfter(() => { guard(); return panel.locator(`li[data-hero-id="${hero}"] .hero-list-row-primary`).click({ timeout: 2000 }); }, 'hero.v1.GetHeroDetail'));
      await op(() => h.action('hero-expr-finish').waitFor()); await op(settled);
      const loaded = await op(() => h.action('hero-expr-finish').count()) === 1;
      const closed = await op(() => panel.locator('[data-role="hero-recruit-host"]').evaluate(node => !node.open));
      write(() => session.preparation = { hero, response: structuredClone(response), loaded, closed });
      pure('preparation', session.preparation); publish(); await capture(handle, 'initial-after-detail');
      }, guard, life.stop);
      guard();
      for (const name of trials) {
        await op(() => responseAfter(async () => { guard(); }, cityRoute)); await op(settled);
        await withProbe(() => page.evaluateHandle(installProbe), async handle => {
          const t = { name, inputs: [] }; await capture(handle, `${name}-before`);
          try {
            let previous;
            for (const [index, key] of preparation[name].entries()) {
              const record = await native(handle, key, previous, index !== 0);
              const target = index === 0 ? 'summary' : name === 'outside' ? 'outside' : index === 1 ? 'templates' : 'select';
              write(() => t.inputs.push(record));
              pure('input', record, [key, index === 0 ? record.before.active : previous, target, true]);
              previous = target;
            }
            const left = boundary(), before = await op(() => handle.evaluate(probe => probe.arm()));
            const after = await snapshot(handle), right = boundary(); write(() => t.arm = { left, before, after, right }); pure('arm', t);
            const response = await op(() => responseAfter(async () => { guard(); }, cityRoute));
            if (!await op(() => handle.evaluate(probe => probe.wait()))) throw new InfrastructureError('First close/frame wait exhausted');
            const evidence = await op(() => handle.evaluate(probe => probe.read()));
            write(() => Object.assign(t, evidence, { responseId: response.id, requests: boundary().rows, outcome: variant === 'baseline' && name !== 'outside' ? 'expected-baseline-defect' : 'scoped-focus-pass' }));
            pure('trial', t, session); write(() => session.trials.push(freeze(structuredClone(t)))); publish();
            await capture(handle, `${name}-after`);
            if (name === 'outside') {
              for (const [index, key] of directions.entries()) {
                const left = boundary();
                pure('proof-boundary', [session.directions[0]?.left ?? left, left]);
                const record = await native(handle, key, ['outside', 'summary', 'summary', 'summary', 'captive'][index], index === 2), right = boundary();
                pure('input', record, [key, ['outside', 'summary', 'summary', 'summary', 'captive'][index], ['summary', 'summary', 'summary', 'captive', 'summary'][index], index === 1]);
                write(() => session.directions.push({ ...record, left, right }));
                pure('direction-prefix', session.directions);
              }
              pure('directions', session.directions); publish(); await capture(handle, 'directions-after');
            }
          } catch (error) {
            const evidence = await op(() => handle.evaluate(probe => probe.read()));
            write(() => session.failureEvidence = freeze(structuredClone({ trial: t, evidence }))); publish(); throw error;
          }
        }, guard, life.stop);
        guard();
      }
      pure('complete', session, expected); publish();
    }, life, error => { report.errors.push(error); publish(); });
  } finally { unbindPage(); }
}
async function main() {
  const life = lifetime(Date.now() + 300000);
  const unbind = ['SIGINT', 'SIGTERM'].map(event => bindStop(life, process, event));
  try { await withHeroRuntime(h => verify(h, life)); }
  finally { life.stop('A completed, fulfilled does not imply success'); unbind.forEach(remove => remove()); }
}
async function selfTest() {
  let checks = 0;
  const check = (id, fn) => { fn(); checks++; console.log(`PASS ${id}`); };
  for (const event of ['SIGINT', 'SIGTERM', 'close']) {
    const life = lifetime(Infinity), emitter = new EventEmitter(), unbind = bindStop(life, emitter, event);
    emitter.emit(event); unbind();
    check(event === 'close' ? 'N53' : `N52-${event}`, () => assert.throws(life.guard, InfrastructureError));
  }
  let now = 0, life = lifetime(5, () => now), inputs = 0, writes = 0;
  const late = life.operation(async () => { now = 6; });
  await assert.rejects(late, InfrastructureError);
  await assert.rejects(life.operation(async () => inputs++), InfrastructureError);
  check('N50-late-operation', () => { assert.throws(() => life.write(() => writes++)); assert.equal(inputs + writes, 0); });
  let releaseOperation, releaseScreenshot, enterScreenshot;
  now = 0; life = lifetime(5, () => now);
  const blocked = life.operation(() => new Promise(resolve => { releaseOperation = resolve; }));
  const screenshotStarted = new Promise(resolve => { enterScreenshot = resolve; });
  let pageOpen = true, runtimeFinished = false;
  const fakeA = deadlineRace(() => blocked, 5, new AbortController()).catch(async () => {
    enterScreenshot(); await new Promise(resolve => { releaseScreenshot = resolve; });
  }).finally(() => { pageOpen = false; runtimeFinished = true; });
  await screenshotStarted; now = 6; releaseOperation();
  await assert.rejects(blocked, InfrastructureError);
  check('N55-A-screenshot-gap-page-open-promise-unsettled', () => {
    assert.ok(pageOpen && !runtimeFinished);
    assert.throws(() => life.write(() => inputs++)); assert.equal(inputs, 0);
  });
  releaseScreenshot(); await fakeA;
  for (const error of [new Error('transport'), new assert.AssertionError({ message: 'wait timeout' }), new InfrastructureError('acquire')]) {
    await assert.rejects(ordinary(async () => { throw error; }, lifetime(Infinity), () => writes++), candidate => candidate === error);
    check('N58-infrastructure-never-ordinary', () => assert.equal(writes, 0));
  }
  for (const phase of ['operation', 'disposal']) {
    const controller = new AbortController(), owner = lifetime(Infinity); let returned = false;
    const handle = { evaluate: async () => phase === 'disposal' ? new Promise(() => {}) : undefined, dispose: async () => {} };
    await assert.rejects(deadlineRace(async () => {
      await ordinary(() => withProbe(async () => handle, async () => { if (phase === 'operation') await new Promise(() => {}); }, owner.guard, owner.stop), owner, () => writes++);
      returned = true;
    }, 10, controller)); owner.stop('A backstop');
    check(phase === 'operation' ? 'N48' : 'N49', () => { assert.equal(returned, false); assert.equal(writes, 0); });
  }
  let cleaned = false;
  await ordinary(() => withProbe(async () => ({ evaluate: async () => { cleaned = true; }, dispose: async () => {} }), async () => { throw new ValidationError('pure'); }, () => {}, () => {}), lifetime(Infinity), () => { assert.ok(cleaned); writes++; });
  check('N59-settled-validation-final-DB-route', () => assert.equal(writes, 1));
  const stopped = lifetime(Infinity); stopped.stop('runtime caught and fulfilled');
  check('N54-runtime-fulfillment-stop', () => assert.throws(stopped.guard));
  check('N60-terminal-all-consumer-writes', () => { for (const effect of ['input', 'save', 'report', 'evidence', 'success']) assert.throws(() => stopped.write(() => assert.fail(effect))); });
  console.log(`${checks} runner actual-helper controls passed`);
}
if (process.argv.includes('--self-test')) await selfTest(); else await main();
