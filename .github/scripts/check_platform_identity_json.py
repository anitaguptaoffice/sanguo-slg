"""Strict complete-shard Go JSON evidence, including a real tests-first baseline."""
import json
import pathlib
import sys

PACKAGE = 'github.com/anitaguptaoffice/sanguo-slg/internal/platform/shard'
AUTH = 'TestEnterGameServerAuthenticatedIdentity'
REJECT = 'TestEnterGameServerRejectsUnauthenticatedIdentity'
SUCCESS = {AUTH + '/' + name for name in (
    'first_login', 'relogin', 'other_shard_missing_wallet',
    'different_account_max_int64', 'renewed_session')}
REJECTIONS = {REJECT + '/' + name for name in (
    'missing', 'malformed', 'unknown', 'expired', 'zero', 'negative',
    'expiry_boundary', 'malformed_payload', 'missing_server', 'unknown_server',
    'maintenance', 'stopped', 'no_player')}
EXPECTED = {AUTH, REJECT} | SUCCESS | REJECTIONS
INVALID_IDS = {REJECT + '/zero', REJECT + '/negative'}
BASELINE_FAILURES = {AUTH, REJECT} | SUCCESS | INVALID_IDS
FATAL_MARKERS = ('WARNING: DATA RACE', 'race detected during execution of test',
                 'panic:', 'fatal error:', '[build failed]')


def check(text, baseline=False):
    events = [json.loads(line) for line in text.splitlines() if line.strip()]
    if not events or not all(isinstance(e, dict) for e in events):
        raise ValueError('empty or malformed evidence')
    running, terminal, failed, output = set(), {}, set(), {}
    starts, package_end = 0, []
    for e in events:
        if e.get('Package') != PACKAGE:
            raise ValueError('wrong package')
        action, name = e.get('Action'), e.get('Test')
        if action not in {'start', 'run', 'output', 'pass', 'fail'}:
            raise ValueError('skip, parallel lifecycle or unknown action')
        if name is not None and (not isinstance(name, str) or not name):
            raise ValueError('invalid test name')
        if package_end:
            raise ValueError('event after terminal package result')
        if action == 'start':
            if name is not None or starts or running:
                raise ValueError('invalid package start')
            starts += 1
        elif starts != 1:
            raise ValueError('event before package start')
        if name is not None and action != 'run' and (name not in running or name in terminal):
            raise ValueError('test event outside its active run')
        if action == 'run':
            if name is None or name in running:
                raise ValueError('missing or duplicate run')
            if '/' in name:
                parent = name.rsplit('/', 1)[0]
                if parent not in running or parent in terminal:
                    raise ValueError('child run without active parent')
            running.add(name)
        if action in {'pass', 'fail'}:
            if name is None:
                package_end.append(action)
            elif name not in running or name in terminal:
                raise ValueError('terminal result without unique run')
            else:
                if any(child.startswith(name + '/') and child not in terminal for child in running):
                    raise ValueError('parent finished with an active descendant')
                terminal[name] = action
                if action == 'fail':
                    failed.add(name)
        if action == 'output':
            value = e.get('Output')
            if not isinstance(value, str):
                raise ValueError('invalid output')
            output[name] = output.get(name, '') + value
    if starts != 1 or running != terminal.keys() or not EXPECTED <= running:
        raise ValueError('missing required run/result or incomplete package')
    if package_end != ['fail' if baseline else 'pass']:
        raise ValueError('missing or wrong package result')
    if any(marker in ''.join(output.values()) for marker in FATAL_MARKERS):
        raise ValueError('race/panic/build failure in evidence')
    if baseline:
        if failed != BASELINE_FAILURES:
            raise ValueError('baseline lacks expected behavioral failures')
        for name in SUCCESS:
            if 'entry=' not in output.get(name, '') or ' want=' not in output[name]:
                raise ValueError('baseline did not reach response comparison')
        for name in INVALID_IDS:
            if 'rejection leaked success:' not in output.get(name, ''):
                raise ValueError('baseline did not reach identity rejection assertion')
    elif failed:
        raise ValueError('candidate test failure')
    return len(running), len(failed)


def self_test():
    def event(action, name=None, **extra):
        e = dict(Action=action, Package=PACKAGE, **extra)
        if name is not None:
            e['Test'] = name
        return e
    def fixture(baseline=False):
        events = [event('start')]
        for root in (AUTH, REJECT):
            events.append(event('run', root))
            for name in sorted(n for n in EXPECTED if n.startswith(root + '/')):
                events.append(event('run', name))
                if baseline and name in SUCCESS | INVALID_IDS:
                    text = 'entry=old want=identity' if name in SUCCESS else 'rejection leaked success:'
                    events.append(event('output', name, Output=text))
                events.append(event('fail' if baseline and name in BASELINE_FAILURES else 'pass', name))
            events.append(event('fail' if baseline else 'pass', root))
        return events + [event('fail' if baseline else 'pass')]
    encode = lambda events: '\n'.join(json.dumps(e) for e in events)
    good, old = fixture(), fixture(True)
    assert check(encode(good)) == (20, 0)
    assert check(encode(old), True) == (20, 9)
    bad = [(False, ''), (False, '{'), (False, '[]'), (True, encode(good)),
           (False, encode(old)), (False, encode(good[:-1])),
           (False, encode(good[1:])), (False, encode(good + [event('pass')])),
           (False, encode([dict(e, Package='wrong') for e in good])),
           (False, encode(good[:1] + good)),
           (False, encode(good[:2] + [good[1]] + good[2:])),
           (False, encode(good[:3] + [good[2]] + good[3:])),
           (False, encode([event('start'), event('pass')])),
           (True, encode([event('start'), event('fail')])),
           (False, encode([good[0], event('output', 'unknown', Output='bad')] + good[1:])),
           (False, encode([good[0], event('pause')] + good[1:])),
           (False, encode([good[0], event('cont', 'unknown')] + good[1:])),
           (False, encode([good[0], event('output', Output=42)] + good[1:]))]
    for baseline, fixture_events in ((False, good), (True, old)):
        for marker in FATAL_MARKERS:
            bad.append((baseline, encode([fixture_events[0], event('output', Output=marker)] + fixture_events[1:])))
        for root in (AUTH, REJECT):
            end = next(e for e in fixture_events if e.get('Test') == root and e['Action'] in {'pass', 'fail'})
            without_end = [e for e in fixture_events if e is not end]
            position = next(i for i, e in enumerate(without_end) if e.get('Test') == root and e['Action'] == 'run') + 1
            for offset in (0, 1):
                changed = without_end[:position + offset] + [end] + without_end[position + offset:]
                bad.append((baseline, encode(changed)))
            for actions in (('cont',), ('pause',), ('pause', 'pause'), ('pause', 'cont')):
                changed = fixture_events[:position] + [event(a, root) for a in actions] + fixture_events[position:]
                bad.append((baseline, encode(changed)))
        first_result = next(e for e in fixture_events if e.get('Test') and e['Action'] in {'pass', 'fail'})
        position = fixture_events.index(first_result)
        bad.append((baseline, encode(fixture_events[:position] + [first_result] + fixture_events[position:])))
        bad.append((baseline, encode([fixture_events[0], fixture_events[2], fixture_events[1]] + fixture_events[3:])))
        for name in EXPECTED:
            bad.append((baseline, encode([e for e in fixture_events if e.get('Test') != name])))
    for name in EXPECTED:
        for action in ('skip', 'fail', 'unknown'):
            changed = [dict(e, Action=action) if e.get('Test') == name and e['Action'] == 'pass' else e for e in good]
            bad.append((False, encode(changed)))
    for name in EXPECTED - BASELINE_FAILURES:
        bad.append((True, encode([dict(e, Action='fail') if e.get('Test') == name and e['Action'] == 'pass' else e for e in old])))
    for name in SUCCESS | INVALID_IDS:
        bad.append((True, encode([e for e in old if not (e.get('Test') == name and e['Action'] == 'output')])))
        bad.append((True, encode([dict(e, Action='pass') if e.get('Test') == name and e['Action'] == 'fail' else e for e in old])))
    for baseline, sample in bad:
        try:
            check(sample, baseline)
        except (ValueError, TypeError):
            continue
        raise AssertionError('accepted invalid evidence')
    print(f'PASS: candidate/baseline positives and {len(bad)} evidence negatives')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
    else:
        if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] != '--baseline'):
            raise SystemExit('usage: check_platform_identity_json.py FILE [--baseline]')
        count, failures = check(pathlib.Path(sys.argv[1]).read_text(), len(sys.argv) == 3)
        print(f'PASS: {count} complete tests/subtests; {failures} expected failures; zero skips')
        print('\n'.join(sorted(EXPECTED)))
