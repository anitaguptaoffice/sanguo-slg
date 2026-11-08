"""Fail closed on real Go JSON test evidence for the actual API bindings."""
import json
import sys

PACKAGE = 'github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1'
EXPECTED = {
    'TestRecruitV2Descriptors', 'TestRecruitV2ExactIntegerBoundaries',
    'TestRecruitV2WireAndPresence', 'TestRecruitV2UnknownFieldsAndOpaqueBytes',
}


def check(text):
    events = [json.loads(line) for line in text.splitlines() if line.strip()]
    if not events:
        raise ValueError('empty evidence')
    running, passed, package_pass = set(), set(), 0
    for event in events:
        if not isinstance(event, dict) or event.get('Package') != PACKAGE:
            raise ValueError('invalid event/package')
        action = event.get('Action')
        if action not in {'start', 'run', 'pause', 'cont', 'output', 'pass', 'bench'}:
            raise ValueError(f'failed/skipped/invalid event: {event}')
        name = event.get('Test')
        if name is not None and (not isinstance(name, str) or not name):
            raise ValueError('invalid test name')
        if action == 'run':
            if name is None or name in running:
                raise ValueError('invalid/duplicate run')
            running.add(name)
        if action == 'pass':
            if name is None:
                package_pass += 1
            elif name not in running or name in passed:
                raise ValueError('pass without unique run')
            else:
                passed.add(name)
    if package_pass != 1 or running != passed or not EXPECTED <= passed:
        raise ValueError(f'incomplete evidence: passed={passed}, running={running}')
    if events[-1].get('Action') != 'pass' or events[-1].get('Test') is not None:
        raise ValueError('package pass must be terminal')


def self_test():
    def event(action, name=None):
        result = {'Action': action, 'Package': PACKAGE}
        if name is not None:
            result['Test'] = name
        return result
    good = [event('start')]
    for name in sorted(EXPECTED):
        good += [event('run', name), event('pass', name)]
    good += [event('pass')]
    encode = lambda items: '\n'.join(json.dumps(x) for x in items)
    check(encode(good))
    bad = ['', '{', '[]', encode(good[:-1]), encode(good[3:]),
           encode([event('fail')]), encode(good + [event('output')]),
           encode([dict(x, Package='wrong') for x in good]),
           encode(good + [event('pass')])]
    for action in ('skip', 'fail', 'unknown'):
        changed = [dict(x) for x in good]
        changed[2]['Action'] = action
        bad.append(encode(changed))
    for text in bad:
        try:
            check(text)
        except (ValueError, TypeError):
            continue
        raise AssertionError(f'accepted invalid evidence: {text}')
    print(f'PASS: valid fixture and {len(bad)} negative controls')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
    else:
        with open(sys.argv[1], encoding='utf-8') as stream:
            check(stream.read())
        print('PASS: complete actual bindings test inventory, no skips/failures')
