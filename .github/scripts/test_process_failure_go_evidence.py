"""Complete Go input-protocol conformance against the actual full parser."""
import copy
from pathlib import Path
import sys
from evidence_artifacts import json_lines, read_json_lines
from process_failure_fixture import EvidenceCase


def run(context):
    files = context.files
    root = 'TestPGRecruitCleanupFailureProcess'
    reject, mutate = context.reject, context.mutate
    start = len(context.labels)
    reject('duplicate test pass', 'green.json', lambda es: es[:-1] + [next(e for e in es if e['Action'] == 'pass')] + es[-1:])
    reject('unknown Go action', 'green.json', lambda es: es[:-1] + [{'Package': 'api', 'Action': 'invented'}] + es[-1:])
    reject('bootstrap not reaped', 'bootstrap.json', lambda rs: [dict(rs[0], reaped=False)])
    reject('output after terminal', 'green.json', lambda es: es + [{'Package': 'api', 'Action': 'output', 'Output': 'late'}])
    reject('subtest after parent terminal', 'green.json', lambda es: es[:-1] + [{'Package': 'api', 'Action': 'run', 'Test': root + '/late'}] + es[-1:])
    reject('race diagnostic', 'green.json', lambda es: es[:-1] + [{'Package': 'api', 'Action': 'output', 'Output': 'WARNING: DATA RACE'}] + es[-1:])
    reject('failed original success', 'success.json', lambda es: [dict(e, Action='fail') if e['Action'] == 'pass' else e for e in es])
    reject('bootstrap race and release-timeout diagnostics', 'bootstrap.log', lambda raw: raw + b'WARNING: DATA RACE\nfailure barrier release timed out\n')
    for color in ['green', 'red', 'success']:
        reject(color + ' missing package start', color + '.json', lambda es: es[1:])
        reject(color + ' missing package terminal', color + '.json', lambda es: es[:-1])
        reject(color + ' duplicate run', color + '.json', lambda es: es[:2] + [es[1]] + es[2:])
        reject(color + ' unknown skip', color + '.json', lambda es: [dict(e, Action='skip') if e['Action'] in {'pass', 'fail'} else e for e in es])
    for diagnostic in ['build failed', 'panic: test timed out after 1m', 'WARNING: DATA RACE']:
        reject('red diagnostic ' + diagnostic, 'red.json', lambda es, d=diagnostic:
               es[:-1] + [{'Package': 'api', 'Action': 'output', 'Output': d}] + es[-1:])
    reject('red wrong assertion', 'red.json', lambda es: [dict(e, Output='unrelated failure')
           if 'forbidden inherited' in e.get('Output', '') else e for e in es])
    reject('marker attributed to package', 'green.json', lambda es: [{k: v for k, v in e.items() if k != 'Test'}
           if 'RECRUIT_FAILURE_EVENT' in e.get('Output', '') else e for e in es])
    for marker in [b'POINT bootstrap:fatal', b'EXIT panic=<nil>', b'BARRIER guard']:
        reject('bootstrap missing ' + marker.decode(), 'bootstrap.log', lambda raw, m=marker: raw.replace(m, b'missing'))
        reject('bootstrap duplicate ' + marker.decode(), 'bootstrap.log', lambda raw, m=marker: raw + b'RECRUIT_CLEANUP_FAILURE_' + m + b'\n')
    for diagnostic in [b'RECRUIT_CLEANUP_PANIC_OWNED {}', b'FORBIDDEN_CLEANUP', b'failure barrier release timed out']:
        reject('bootstrap contradiction ' + diagnostic.decode(), 'bootstrap.log', lambda raw, d=diagnostic: raw + d + b'\n')
    reject('bootstrap success exit', 'bootstrap.json', lambda rs: [dict(rs[0], exit=0)])
    reject('bootstrap wrong result', 'bootstrap.json', lambda rs: [dict(rs[0], result='success')])
    for name in sorted({e['Test'] for e in read_json_lines(files['green.json']) if 'Test' in e}):
        reject('missing required ' + name, 'green.json', lambda es, n=name: [e for e in es if e.get('Test') != n])
    fragmented = copy.deepcopy(files)
    events = []
    for event in read_json_lines(fragmented['green.json']):
        if event.get('Output', '').startswith('RECRUIT_FAILURE_EVENT '):
            middle = len(event['Output']) // 2
            events.extend([dict(event, Output=event['Output'][:middle]), dict(event, Output=event['Output'][middle:])])
        else:
            events.append(event)
    fragmented['green.json'] = json_lines(events)
    context.positive(fragmented, 'fragmented Go output')
    reject('wrong package', 'green.json', lambda es: [dict(e, Package='other') for e in es])
    reject('bootstrap nonboolean reap', 'bootstrap.json', lambda rs: [dict(rs[0], reaped=1)])
    context.inventory(start, 58, 'a4946a91710d07d175eb1ae669c521a4963e60b482b81da1e26e7df1aae96a9d')


if __name__ == '__main__':
    parser = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('verify_api_process_failure.py')
    context = EvidenceCase(parser)
    context.positive(context.files, 'baseline')
    run(context)
    assert context.positives == ['baseline', 'fragmented Go output']
    context.finish()
