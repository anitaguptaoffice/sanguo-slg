"""Fail closed on real Go JSON test evidence for the actual API bindings."""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

PACKAGE = 'github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1'
EXPECTED = {
    'TestRecruitV2Descriptors', 'TestRecruitV2ExactIntegerBoundaries',
    'TestRecruitV2Descriptors/RecruitTroopV2Request',
    'TestRecruitV2Descriptors/RecruitTroopV2Response',
    'TestRecruitV2Descriptors/RecruitAcceptance',
    'TestRecruitV2WireAndPresence', 'TestRecruitV2UnknownFieldsAndOpaqueBytes',
}


OLD_GENERATED = '358306794b36ddc9c2caf157f927b20325d2004588096b13b8a1c8af653e102a'
OLD_MIRROR = '52257d4fa2cb5f3ff86f436c1e58211a464b58f3d7193add70bc015a1c123e31'


def classify(generated, mirror, tests, history, canonical):
    if generated == OLD_GENERATED and mirror == OLD_MIRROR and not tests and not history:
        return 'legacy'
    if generated != OLD_GENERATED and tests and canonical:
        return 'v2'
    raise ValueError('partial adoption or forbidden legacy rollback')


def state():
    def git(*args):
        return subprocess.check_output(['git', *args], text=True).strip()
    if git('rev-parse', '--is-shallow-repository') != 'false':
        raise ValueError('complete HEAD history required')
    base = 'internal/api/pb/sanguo/military/v1/'
    generated, tests = base + 'military.pb.go', base + 'recruit_v2_contract_test.go'
    mirror = 'internal/api/proto/sanguo/military/v1/military.proto'
    canonical = 'spec/proto/sanguo/military/v1/military.proto'
    paths = [generated, mirror, tests, canonical]
    entries = dict(line.split('\t', 1)[::-1] for line in git('ls-tree', 'HEAD', '--', *paths).splitlines())
    for path in paths:
        file = pathlib.Path(path)
        if path == tests and path not in entries and not file.exists() and not file.is_symlink():
            continue
        if path not in entries or not entries[path].startswith('100644 blob ') or file.is_symlink() or not file.is_file():
            raise ValueError('source must be tracked regular files')
    git('diff', '--exit-code', 'HEAD', '--', *paths)
    history = git('log', '--full-history', '--format=%H', 'HEAD', '--', tests)
    package = 'option go_package = "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/military/v1;militaryv1";'
    adapted, count = re.subn(r'^option go_package = .*;$', package, pathlib.Path(canonical).read_text(), flags=re.M)
    digest = lambda path: hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
    return classify(digest(generated), digest(mirror), tests in entries, bool(history),
                    count == 1 and adapted == pathlib.Path(mirror).read_text())


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
    legacy = (OLD_GENERATED, OLD_MIRROR, False, False, False)
    adopted = ('new', 'new', True, True, True)
    assert classify(*legacy) == 'legacy' and classify(*adopted) == 'v2'
    invalid = [('changed', *legacy[1:]), (OLD_GENERATED, 'changed', False, False, False),
               (*legacy[:3], True, False), (OLD_GENERATED, OLD_MIRROR, True, True, False),
               ('new', 'new', False, True, True), ('new', 'new', True, True, False)]
    for sample in invalid:
        try:
            classify(*sample)
        except ValueError:
            continue
        raise AssertionError('state guard accepted partial/rollback fixture')
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
           encode(good + [event('pass')]),
           encode([x for x in good if x.get('Test') != 'TestRecruitV2Descriptors/RecruitAcceptance'])]
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
    print(f'PASS: 6 state negatives and {len(bad)} JSON negatives')


if __name__ == '__main__':
    if sys.argv[1:] == ['--state']:
        print(state())
    elif sys.argv[1:] == ['--self-test']:
        self_test()
    else:
        with open(sys.argv[1], encoding='utf-8') as stream:
            check(stream.read())
        print('PASS: complete actual bindings test inventory, no skips/failures')
