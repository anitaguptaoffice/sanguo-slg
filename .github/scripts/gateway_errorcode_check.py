"""Fail closed on incomplete Go JSON; baseline red is evidence, not a pass."""
import json
import pathlib
import re
import sys

GATEWAY = 'github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway'
BINDINGS = GATEWAY + '/pb/sanguo/common/v1'
CANONICAL = 'TestEnvelopeCanonicalErrorCodes'
OLD = {'TestHandshakeAndPing', 'TestAuthRequired', 'TestAccessDenyList',
       'TestReconnectReplacesSession', 'TestRateLimit', 'TestStress3000Connections',
       'TestDecodeEncodeRoundTrip', 'TestRouterDispatch'}
WIRE = {'legacy_client', 'legacy_server', 'intent_conflict', 'unknown_positive',
        'unknown_negative', 'default_client', 'default_server'}


def inventory(root):
    source = (root / 'spec/proto/sanguo/common/v1/envelope.proto').read_text()
    enums = re.findall(r'^\s*([A-Z][A-Z_0-9]*) = [0-9]+;', source, re.M)
    assert len(enums) == len(set(enums)) == 55, 'canonical inventory drift'
    old = set()
    for path in (root / 'internal/platform/gateway').glob('*_test.go'):
        old.update(re.findall(r'^func (Test\w+)\(t \*testing.T\)', path.read_text(), re.M))
    assert old == OLD, 'old inventory drift needs explicit review'
    new = {CANONICAL, 'TestEnvelopeMessageDescriptors', 'TestEnvelopeWireCompatibility'}
    new.update(CANONICAL + '/' + name for name in enums)
    new.update('TestEnvelopeWireCompatibility/' + name for name in WIRE)
    assert len(new) == 65
    return {(GATEWAY, name) for name in old} | {(BINDINGS, name) for name in new}


def check(text, expected, baseline=False):
    starts, terminal, packages, completed, outputs = set(), {}, set(), {}, []
    for line in text.splitlines():
        event = json.loads(line)
        assert isinstance(event, dict), 'non-object JSON event'
        action, package, name = event.get('Action'), event.get('Package'), event.get('Test')
        assert package in {p for p, _ in expected}, 'unexpected package'
        assert action in {'start', 'run', 'output', 'pass', 'fail', 'skip'}, 'unknown action'
        assert package not in completed, 'event after package completion'
        if name:
            assert package in packages, 'test before package start'
            assert action != 'start', 'invalid test start'
            key = (package, name)
            assert key in expected, 'unexpected test'
            if action == 'run':
                assert key not in starts, 'duplicate test run'
                starts.add(key)
            elif action in {'pass', 'fail', 'skip'}:
                assert key in starts and key not in terminal, 'invalid test completion'
                terminal[key] = action
            elif action == 'output':
                assert key in starts and key not in terminal, 'output outside test lifetime'
                outputs.append((key, event.get('Output', '')))
        elif action == 'start':
            assert package not in packages, 'duplicate package start'
            packages.add(package)
        elif action in {'pass', 'fail', 'skip'}:
            assert package in packages, 'package did not start'
            completed[package] = action
        else:
            assert action == 'output', 'invalid package event'
    assert starts == set(terminal) == expected, 'missing or unfinished tests'
    assert packages == set(completed) == {p for p, _ in expected}, 'unfinished package'
    desired = 'fail' if baseline else 'pass'
    assert set(terminal.values()) == set(completed.values()) == {desired}, 'wrong test/package result'
    if baseline:
        needle = 'canonical/generated cardinality: source=55 descriptor=36 names=36 values=36'
        assert sum(needle in output for key, output in outputs if key == (BINDINGS, CANONICAL)) == 1, 'wrong baseline failure'
    return {'tests': len(terminal), 'packages': len(completed), 'result': desired}


if __name__ == '__main__':
    mode, log, exit_file, root = sys.argv[1:]
    assert mode in {'baseline', 'fixed'}
    baseline = mode == 'baseline'
    assert int(pathlib.Path(exit_file).read_text()) == (1 if baseline else 0), 'unexpected go exit'
    expected = {(BINDINGS, CANONICAL)} if baseline else inventory(pathlib.Path(root))
    print(json.dumps(check(pathlib.Path(log).read_text(), expected, baseline), sort_keys=True))
