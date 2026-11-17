"""Validate actual ACCOUNT binding Go JSON; mutate real logs as negative controls."""
import json
import pathlib
import sys

PACKAGE = 'github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/account/v1'
EXPECTED = {'TestAccountIdentity' + name for name in (
    'Descriptor', 'LegacyWire', 'Int64Wire', 'ZeroDefault', 'UnknownWire', 'MalformedWire')}
EXPECTED |= {'TestAccountIdentityInt64Wire/' + value for value in (
    '1', '9007199254740991', '9007199254740992', '9007199254740993',
    '9223372036854775807', '-1', '-9223372036854775808')}
EXPECTED |= {'TestAccountIdentityMalformedWire/' + value for value in (
    '30', '3080', '30808080808080808080', '308080808080808080808002')}


def check(text):
    events = [json.loads(line) for line in text.splitlines() if line.strip()]
    running, passed, paused = set(), set(), set()
    started = ended = False
    for event in events:
        if not isinstance(event, dict) or event.get('Package') != PACKAGE or ended:
            raise ValueError('invalid package/event or event after terminal pass')
        action, name = event.get('Action'), event.get('Test')
        if action not in {'start', 'run', 'pause', 'cont', 'output', 'pass'}:
            raise ValueError('failed, skipped or unknown action')
        if name is not None and (not isinstance(name, str) or not name):
            raise ValueError('invalid test name')
        if action == 'start':
            if started or name is not None:
                raise ValueError('duplicate/invalid package start')
            started = True
        elif not started:
            raise ValueError('missing package start')
        elif action == 'run':
            if name is None or name in running:
                raise ValueError('missing/duplicate test run')
            running.add(name)
        elif action in {'pause', 'cont'}:
            if name is None or name not in running or name in passed:
                raise ValueError('pause/continue requires active test')
            if action == 'pause':
                if name in paused:
                    raise ValueError('duplicate pause')
                paused.add(name)
            else:
                if name not in paused:
                    raise ValueError('continue without pause')
                paused.remove(name)
        elif action == 'pass':
            if name is None:
                ended = True
            elif name not in running or name in passed or name in paused:
                raise ValueError('pass without unique run')
            else:
                passed.add(name)
        elif name is not None and (name not in running or name in passed):
            raise ValueError('test event before run')
    if not ended or paused or running != passed or not EXPECTED <= passed:
        raise ValueError(f'incomplete evidence: missing={EXPECTED - passed}')
    return events


def negatives(text, destination):
    events = check(text)
    encode = lambda items: '\n'.join(json.dumps(x) for x in items) + '\n'
    cases = {'empty': '', 'malformed': '{', 'non-object': '[]',
             'missing-start': encode(events[1:]), 'truncated': encode(events[:-1]),
             'duplicate-terminal': encode(events + [events[-1]]),
             'wrong-package': encode([dict(x, Package='wrong') for x in events])}
    for name in sorted(EXPECTED):
        cases['missing-' + name.replace('/', '_')] = encode([x for x in events if x.get('Test') != name])
    index = next(i for i, x in enumerate(events) if x['Action'] == 'pass' and x.get('Test'))
    for action in ('skip', 'fail', 'unknown'):
        altered = [dict(x) for x in events]
        altered[index]['Action'] = action
        cases[action] = encode(altered)
    cases['duplicate-test-pass'] = encode(events[:index] + [events[index]] + events[index:])
    run = next(x for x in events if x['Action'] == 'run')
    cases['duplicate-test-run'] = encode(events[:1] + [run] + events[1:])
    cases['unfinished-test'] = encode(events[:-1] + [dict(run, Test='TestUnfinished')] + events[-1:])
    for action in ('pause', 'cont', 'output'):
        if action != 'output':
            cases[action + '-without-test'] = encode(events[:-1] + [dict(Action=action, Package=PACKAGE)] + events[-1:])
        cases[action + '-after-pass'] = encode(events[:-1] + [dict(run, Action=action)] + events[-1:])
    run_index = next(i for i, x in enumerate(events) if x['Action'] == 'run')
    for name, actions in {'duplicate-pause': ['pause', 'pause'],
                          'continue-without-pause': ['cont'],
                          'pass-while-paused': ['pause']}.items():
        cases[name] = encode(events[:run_index + 1] + [dict(run, Action=a) for a in actions] + events[run_index + 1:])
    root = pathlib.Path(destination)
    root.mkdir(parents=True, exist_ok=True)
    for name, sample in cases.items():
        (root / (name + '.json')).write_text(sample)
        try:
            check(sample)
        except (ValueError, TypeError):
            continue
        raise AssertionError('accepted negative: ' + name)
    print(f'PASS: {len(cases)} rejected mutations of genuine passing Go JSON')


if __name__ == '__main__':
    text = pathlib.Path(sys.argv[1]).read_text()
    check(text)
    print('PASS: six identity roots, eleven subcases, complete package; zero skips/fails')
    if len(sys.argv) == 3:
        negatives(text, sys.argv[2])
