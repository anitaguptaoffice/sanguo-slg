"""Complete PG input-protocol conformance against the actual full parser."""
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
from evidence_artifacts import json_lines, read_json_lines
from process_failure_fixture import EvidenceCase, seal


def run(context):
    files = context.files
    log = 'server/evidence.json'
    reject, mutate = context.reject, context.mutate
    start = len(context.labels)
    reject('missing session_start', log, lambda rs: [{k: v for k, v in r.items() if k != 'session_start'} for r in rs])
    reject('session line gaps', log, lambda rs: [dict(r, line_num=r['line_num'] * 2) for r in rs])
    reject('missing intermediate observer line', log, lambda rs: [r for r in rs if not (r['pid'] == 100 and r['line_num'] == 2)])
    reject('conflicting session_start', log, lambda rs: [dict(r, session_start='2020-01-01 00:00:00 UTC') for r in rs])
    reject('late red admin DROP', log, lambda rs:
           [r for r in rs[:-2] if r['pid'] != 3200] + [r for r in rs if r['pid'] == 3200] + rs[-2:])
    reject('ignored extra file', 'server/extra.log', lambda _: b'DROP SCHEMA forbidden;\n')
    reject('missing connection ending', log, lambda rs: [r for r in rs if not (r['pid'] == 1100 and 'disconnection:' in r['message'])])
    reject('missing shutdown', log, lambda rs: [r for r in rs if r['message'] != 'database system is shut down'])
    reject('missing positive control', log, lambda rs: [r for r in rs if 'PROCESS_LOG_end' not in r['message']])
    reject('hash mismatch', 'log-inventory.txt', lambda _: b'wrong hash')
    reject('corrupt archive', 'server.tar', lambda _: b'invalid tar')
    reject('logging disabled', 'settings.txt', lambda data: data.replace(b'log_statement=all', b'log_statement=none'))
    reject('missing red DROP', log, lambda rs: [r for r in rs if not (r['pid'] == 3200 and 'DROP SCHEMA' in r['message'])])
    reject('missing parent DROP', log, lambda rs: [r for r in rs if not (r['pid'] == 100 and 'DROP SCHEMA' in r['message'])])
    reject('bootstrap DROP', log, lambda rs: [dict(r, message=r['message'].replace('CREATE SCHEMA', 'DROP SCHEMA')) if r['pid'] == 50 else r for r in rs])

    def edit_rows(data, change):
        records = read_json_lines(data[log])
        change(records)
        data[log] = json_lines(records)
        seal(data)

    def prior_observer(data):
        data['green.json'] = data['green.json'].replace(b'2026-11-07T00:00:01.123456Z', b'2025-11-07T00:00:01.123456Z', 3)
        def change(records):
            for row in records:
                if row['pid'] == 100:
                    row['message'] = row['message'].replace('2026-11-07T00:00:01.123456Z', '2025-11-07T00:00:01.123456Z')
            prior = [dict(session_id='prior100', pid=100, line_num=i + 1,
                          session_start='2025-11-07 00:00:01 UTC', dbname='process_green', message=message)
                     for i, message in enumerate(['connection received: host=127.0.0.1',
                         'connection authorized: user=sanguo database=process_green', 'disconnection: session time: 1 seconds'])]
            records[:0] = prior
        edit_rows(data, change)

    def insert_unknown(records):
        index = next(i for i, r in enumerate(records) if r['pid'] == 100 and 'case-end' in r['message'])
        source = records[index]
        for row in records[index + 1:]:
            if row['session_id'] == source['session_id']:
                row['line_num'] += 1
        records.insert(index + 1, dict(source, line_num=source['line_num'] + 1, message="statement: SELECT 'RECRUIT_FAILURE_SQL {}'"))

    def archive_entry(data, name='process-failure-pg-log/evidence.json', kind=tarfile.REGTYPE):
        stream = io.BytesIO(data['server.tar'])
        with tarfile.open(fileobj=stream, mode='a') as archive:
            info = tarfile.TarInfo(name)
            info.type = kind
            raw = data[log] if kind == tarfile.REGTYPE else b''
            info.size = len(raw)
            archive.addfile(info, io.BytesIO(raw))
        data['server.tar'] = stream.getvalue()
        collector = json.loads(data['collector.json'])
        collector['archive_sha256'] = hashlib.sha256(data['server.tar']).hexdigest()
        data['collector.json'] = json.dumps(collector).encode()

    reject('omit complete green admin session', log, lambda rs: [r for r in rs if r['pid'] != 3100])
    mutate('observer marker uses different reused-PID session', prior_observer)
    mutate('unknown extra SQL event', lambda data: edit_rows(data, insert_unknown))
    reject('session changes database', log, lambda rs: [dict(r, dbname='other_database')
           if r['pid'] == 3100 and 'CREATE SCHEMA' in r['message'] else r for r in rs])
    mutate('duplicate archive member', archive_entry)
    reject('nonempty fallback', 'server/evidence.log', lambda _: b'DROP SCHEMA hidden;\n')
    mutate('truncated final JSON record', lambda data: (data.update({log: data[log][:-5] + b'\n'}), seal(data)))
    mutate('missing final newline', lambda data: (data.update({log: data[log].rstrip(b'\n')}), seal(data)))
    reject('missing startup', log, lambda rs: [r for r in rs if r['message'] != 'database system is ready to accept connections'])
    reject('missing logger EOF', log, lambda rs: [r for r in rs if r['message'] != 'logger shutting down'])
    reject('wrong logger EOF PID', log, lambda rs: [dict(r, pid=999) if r['message'] == 'logger shutting down' else r for r in rs])
    mutate('extra archive directory', lambda data: archive_entry(data, 'unexpected', tarfile.DIRTYPE))
    mutate('symlink archive entry', lambda data: archive_entry(data, 'link', tarfile.SYMTYPE))
    reject('wrong source hash', 'source.txt', lambda _: b'not a source\n')
    for key, value in [('container', 'd' * 64), ('stop_started_ns', 21), ('logger_exited_ns', 31),
                       ('archive_completed_ns', True), ('archive_sha256', 'bad'), ('logger_exit', 'killed')]:
        reject('collector ' + key, 'collector.json', lambda rs, k=key, v=value: [dict(rs[0], **{k: v})])
    for role, key, value in [('logger', 'parent', 99), ('logger', 'pid', 10), ('logger', 'start_ticks', 0),
                              ('postmaster', 'start_ticks', True), ('logger', 'state', 'Z')]:
        reject('collector ' + role + '/' + key, 'collector.json',
               lambda rs, r=role, k=key, v=value: [dict(rs[0], **{r: dict(rs[0][r], **{k: v})})])
    for key, value in [('Running', True), ('OOMKilled', True), ('ExitCode', 137)]:
        reject('container ' + key, 'container.json', lambda rs, k=key, v=value:
               [[dict(rs[0][0], State=dict(rs[0][0]['State'], **{k: v}))]])

    def protocol_change(data, change):
        for color in ['green', 'red']:
            events = read_json_lines(data[color + '.json'])
            for event in events:
                if event.get('Output', '').startswith('RECRUIT_FAILURE_EVENT '):
                    value = json.loads(event['Output'].removeprefix('RECRUIT_FAILURE_EVENT '))
                    change(value)
                    event['Output'] = 'RECRUIT_FAILURE_EVENT ' + json.dumps(value) + '\n'
            data[color + '.json'] = json_lines(events)
        def sql_change(records):
            for row in records:
                prefix = "statement: SELECT 'RECRUIT_FAILURE_SQL "
                if row['message'].startswith(prefix):
                    value = json.loads(row['message'][len(prefix):-1].replace("''", "'"))
                    change(value)
                    row['message'] = prefix + json.dumps(value).replace("'", "''") + "'"
        edit_rows(data, sql_change)

    for key, value in [('Stage', 'unknown'), ('Database', 'other'), ('ExitCode', 0), ('Live', []), ('Barrier', 'unknown')]:
        mutate('protocol ' + key, lambda data, k=key, v=value: protocol_change(data, lambda e: e.update({k: v})))
    for key, value in [('PID', 0), ('Start', '0001-01-01T00:00:00Z'), ('Start', '2026-11-07T00:00:09.123456Z')]:
        mutate('owned identity ' + key + str(value), lambda data, k=key, v=value:
               protocol_change(data, lambda e: e['Owned']['Original'].update({k: v})))
    reject('SQL marker duplicate', log, lambda rs: rs + [next(r for r in rs if 'RECRUIT_FAILURE_SQL' in r['message'])])
    reject('postmaster shutdown before EOF', log, lambda rs: rs[:-2] + list(reversed(rs[-2:])))

    def move_record(data, select, target, after=0):
        def change(records):
            moved = next(r for r in records if select(r))
            records.remove(moved)
            records.insert(next(i for i, r in enumerate(records) if target(r)) + after, moved)
            counters = {}
            for row in records:
                sid = row['session_id']
                counters[sid] = counters.get(sid, 0) + 1
                row['line_num'] = counters[sid]
        edit_rows(data, change)

    mutate('parent DROP before reap', lambda data: move_record(data,
           lambda r: r['pid'] == 100 and 'DROP SCHEMA' in r['message'],
           lambda r: r['pid'] == 100 and 'reaped-backends-absent' in r['message']))
    mutate('bootstrap absence before connection', lambda data: move_record(data,
           lambda r: 'PROCESS_BOOTSTRAP_REAP_ABSENT' in r['message'], lambda r: r['pid'] == 50))
    mutate('owned original aliases observer', lambda data:
           protocol_change(data, lambda e: e['Owned'].update(Original=copy.deepcopy(e['Observer']))))
    for role in ['logger', 'postmaster']:
        for key in ['exit_code', 'parent', 'start_code', 'end_code']:
            reject('missing ' + role + '/' + key, 'collector.json', lambda rs, r=role, k=key:
                   [dict(rs[0], **{r: {name: value for name, value in rs[0][r].items() if name != k}})])
        for fields in [dict(state=''), dict(state='not-a-process-state'), dict(start_code=1), dict(start_code=True),
                       dict(end_code=1), dict(end_code=4096), dict(end_code=False),
                       dict(start_code=1, end_code=1)]:
            reject('invalid snapshot ' + role + repr(fields), 'collector.json', lambda rs, r=role, v=fields:
                   [dict(rs[0], **{r: dict(rs[0][r], **v)})])
    for pid, stage in [(1100, 'reaped-backends-absent'), (1104, 'barrier-observed')]:
        delayed = copy.deepcopy(files)
        move_record(delayed, lambda r: r['pid'] == pid and 'disconnection:' in r['message'],
                    lambda r: r['pid'] == pid - 1000 and stage in r['message'], after=1)
        context.positive(delayed, 'delayed disconnect ' + str(pid))
    capture = json.loads(files['collector.json'])
    capture.update(logger_exit='zero-exit-zombie', logger_after=dict(capture['logger'], state='Z', exit_code=0))
    mutate('historically permitted zombie is not disappearance', lambda data: data.update({'collector.json': json.dumps(capture).encode()}))
    for key, value in [('pid', 99), ('start_ticks', 999), ('state', 'S'), ('exit_code', 1)]:
        bad = copy.deepcopy(capture)
        bad.update(logger_exit='absent', logger_after=dict(bad['logger_after'], **{key: value}))
        mutate('zombie ' + key, lambda data, v=bad: data.update({'collector.json': json.dumps(v).encode()}))
    reject('duplicate setting', 'settings.txt', lambda raw: raw + b'\nlog_statement=all')
    directory_archive = copy.deepcopy(files)
    archive_entry(directory_archive, 'process-failure-pg-log', tarfile.DIRTYPE)
    context.positive(directory_archive, 'optional archive directory')
    offset_identity = copy.deepcopy(files)
    protocol_change(offset_identity, lambda e: e['Observer'].update(Start=e['Observer']['Start'].replace('Z', '+00:00')))
    context.positive(offset_identity, 'timezone identity')
    for value in [b'', b'PROCESS_FALLBACK 99 20 DEBUG:  logger shutting down\n', files['server/evidence.log'] * 2]:
        reject('fallback exact bytes ' + repr(value), 'server/evidence.log', lambda raw, v=value: v)
    reject('multiple collector lifecycles', log, lambda rs: rs + [dict(rs[-1], pid=21, session_id='21')])
    for key, value in [('pid', 1), ('pid', 10), ('pid', 20), ('start_ticks', 101), ('collector', 'on'),
                       ('ready', False), ('reaped', False), ('exit', 1), ('fresh_logs', False), ('exit', True)]:
        reject('initialization ' + key + repr(value), 'initialization.json', lambda rs, k=key, v=value: [dict(rs[0], **{k: v})])
    for key in ['pid', 'start_ticks', 'collector', 'ready', 'reaped', 'exit', 'fresh_logs']:
        reject('missing initialization ' + key, 'initialization.json', lambda rs, k=key: [{name: value for name, value in rs[0].items() if name != k}])
    mutate('owned aliases observer session with different microseconds', lambda data: protocol_change(data,
           lambda e: e['Owned'].update(Original=dict(e['Observer'], Start=e['Observer']['Start'].replace('123456', '123457')))))
    for message in ['ending log output to stderr', 'database system is ready to accept connections']:
        reject('missing startup boundary ' + message, log, lambda rs, m=message: [r for r in rs if r['message'] != m])
        reject('duplicate startup boundary ' + message, log, lambda rs, m=message:
               rs + [dict(next(r for r in rs if r['message'] == m), pid=99, session_id='99', line_num=1)])
    for key, value in [('pid', 99), ('session_id', '99'), ('error_severity', 'WARNING'),
                       ('backend_type', 'client backend'), ('hint', None), ('hint', 'wrong destination')]:
        reject('startup identity ' + key + repr(value), log, lambda rs, k=key, v=value: [dict(r, **{k: v})
               if r['message'] == 'ending log output to stderr' else r for r in rs])
    for target in ['database system is ready to accept connections', 'PROCESS_LOG_begin']:
        mutate('late startup redirect ' + target, lambda data, t=target: move_record(data,
               lambda r: r['message'] == 'ending log output to stderr', lambda r: t in r['message'], after=1))
    for value in [files['server/evidence.log'] + b'unknown\n', files['server/evidence.log'].split(b'\n', 1)[1],
                  b'\n'.join(reversed(files['server/evidence.log'].splitlines())) + b'\n']:
        reject('startup fallback bytes ' + repr(value), 'server/evidence.log', lambda raw, v=value: v)
    context.inventory(start, 123, '6a438b842ca9c12c11192d9550e906264e832192deefe1d2dc25c025247c4f07')


if __name__ == '__main__':
    parser = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('verify_api_process_failure.py')
    context = EvidenceCase(parser)
    context.positive(context.files, 'baseline')
    run(context)
    assert context.positives == ['baseline', 'delayed disconnect 1100', 'delayed disconnect 1104', 'optional archive directory', 'timezone identity']
    context.finish()
