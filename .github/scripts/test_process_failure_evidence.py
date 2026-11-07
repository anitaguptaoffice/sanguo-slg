"""Synthetic protocol controls only, never Go/PG runtime evidence."""
import copy
import runpy
import sys
import hashlib
import io
import json
from pathlib import Path
import tarfile
from evidence_artifacts import json_lines, read_json_lines, pack, prepared, run_cli
parser = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('verify_api_process_failure.py')
check = runpy.run_path(str(parser))['check']
failures = []

root = 'TestPGRecruitCleanupFailureProcess'
files = {
    'server/evidence.log': b'PROCESS_FALLBACK 20 20 DEBUG:  logger shutting down\n',
    'source.txt': ('a' * 40 + '\n' + 'b' * 40 + '\n').encode(),
    'bootstrap.log': b'RECRUIT_CLEANUP_FAILURE_POINT bootstrap:fatal\nRECRUIT_CLEANUP_FAILURE_EXIT panic=<nil>\nRECRUIT_CLEANUP_FAILURE_BARRIER guard\n',
    'bootstrap.json': json.dumps({'reaped': True, 'exit': 1, 'result': 'cleanup-unverified'}).encode(),
    'container.json': json.dumps([{'Id': 'c' * 64, 'State': {'Running': False, 'ExitCode': 0, 'OOMKilled': False}}]).encode(),
}
settings = dict(logging_collector='on', log_destination='jsonlog', log_statement='all',
                log_directory='/tmp/process-failure-pg-log', log_filename='evidence.log',
                log_rotation_age='0', log_rotation_size='0', log_truncate_on_rotation='off',
                lc_messages='C', log_error_verbosity='default', log_line_prefix='PROCESS_FALLBACK %p %c ',
                log_min_messages='debug1', log_connections='on', log_disconnections='on', log_timezone='UTC')
files['settings.txt'] = '\n'.join(k + '=' + v for k, v in settings.items()).encode()
rows = []
sequences = {}
starts = {}

def record(message, pid=10, database='sanguo', start='2026-11-07 00:00:00 UTC'):
    sequences[pid] = sequences.get(pid, 0) + 1
    starts.setdefault(pid, start)
    row = dict(session_id=str(pid), line_num=sequences[pid], pid=pid, session_start=starts[pid], message=message)
    if database is not None:
        row['dbname'] = database
    rows.append(row)
    return row

def connect(pid, database, start='2026-11-07 00:00:00 UTC'):
    record('connection received: host=127.0.0.1', pid, None, start)
    record('connection authorized: user=sanguo database=' + database, pid, database, start)

def disconnect(pid, database):
    record('disconnection: session time: 1 seconds user=sanguo database=' + database, pid, database)

def statement(sql, pid=10, database='sanguo'):
    return record('statement: ' + sql, pid, database)

def dump_events(name, events):
    files[name + '.json'] = json_lines(dict(e, Package='api') for e in events)

record('database system is ready to accept connections')
statement("SELECT 'PROCESS_LOG_begin'; CREATE SCHEMA process_log_begin; DROP SCHEMA process_log_begin")
connect(50, 'process_bootstrap')
statement('CREATE SCHEMA "bootstrap"', 50, 'process_bootstrap')
disconnect(50, 'process_bootstrap')
statement("SELECT 'PROCESS_BOOTSTRAP_REAP_ABSENT'")
success_name = 'TestPGRecruitGenerationConstructorCleanupPanic'
dump_events('success', [{'Package': 'api', 'Action': 'start'}, {'Package': 'api', 'Action': 'run', 'Test': success_name},
                      {'Package': 'api', 'Action': 'output', 'Test': success_name, 'Output': 'verified primary/live/unknown/retained slot'},
                      {'Package': 'api', 'Action': 'pass', 'Test': success_name}, {'Package': 'api', 'Action': 'pass'}])
for color, modes in [('green', ['original:fatal', 'original:goexit', 'original:panic', 'spare:fatal', 'raw-close:fatal']),
                     ('red', ['original:fatal'])]:
    events = [{'Package': 'api', 'Action': 'start'}]
    if color == 'green':
        for name in ['TestRecruitFailureOwnershipRejectsIncomplete', 'TestRecruitFailureAbsenceRequiresReap',
                     'TestPGRecruitFailureAbsenceRejectsLiveBackend', 'TestRecruitPanicAbsenceRejectsInvalidIdentity',
                     'TestRecruitCleanupFailureGuard', 'TestRecruitCleanupFailureRunner']:
            events.append({'Package': 'api', 'Action': 'run', 'Test': name})
            if name in {'TestRecruitCleanupFailureGuard', 'TestRecruitCleanupFailureRunner'}:
                for mechanism in ['fatal', 'goexit', 'panic', 'return']:
                    child = name + '/' + mechanism
                    events += [{'Package': 'api', 'Action': 'run', 'Test': child}, {'Package': 'api', 'Action': 'pass', 'Test': child}]
            events.append({'Package': 'api', 'Action': 'pass', 'Test': name})
    events.append({'Package': 'api', 'Action': 'run', 'Test': root})
    for index, mode in enumerate(modes):
        pid = (100 if color == 'green' else 200) + index
        database = 'process_' + color
        name = root + '/' + mode.replace(':', '_')
        events.append({'Package': 'api', 'Action': 'run', 'Test': name})
        schema = f'api_return_{pid}_"Q'
        quoted = '"' + schema.replace('"', '""') + '"'
        original = {'PID': pid + 1000, 'Start': '2026-11-07T00:00:00.123456Z'}
        spares = [] if mode.startswith('original') else [{'PID': pid + 2000, 'Start': '2026-11-07T00:00:00.223456Z'}]
        owned = dict(Schema=schema, Original=original, Spares=spares, Verified='')
        connect(pid + 3000, database)
        statement('CREATE SCHEMA ' + quoted, pid + 3000, database)
        for identity in [original] + spares:
            connect(identity['PID'], database)
            statement('BEGIN' if identity == original else 'SELECT 1', identity['PID'], database)
        connect(pid, database, '2026-11-07 00:00:01 UTC')
        event = dict(Case=f'{pid}-{mode}', Stage='barrier-observed', Database=database,
                     Observer={'PID': pid, 'Start': '2026-11-07T00:00:01.123456Z'}, Owned=owned,
                     Barrier='guard' if color == 'green' else 'cleanup',
                     Live=[not mode.startswith('raw-close')] + [True] * len(spares),
                     SchemaLive=color == 'green', ExitCode=-1)
        drop = 'DROP SCHEMA IF EXISTS ' + quoted + ' CASCADE'
        if color == 'red':
            statement(drop, pid + 3000, database)
        if mode.startswith('raw-close'):
            disconnect(original['PID'], database)
        for stage in ['barrier-observed', 'reaped-backends-absent', 'case-end']:
            event['Stage'] = stage
            if stage != 'barrier-observed':
                event['ExitCode'] = 1
            payload = json.dumps(event)
            statement("SELECT 'RECRUIT_FAILURE_SQL " + payload.replace("'", "''") + "'", pid, database)
            events.append({'Package': 'api', 'Action': 'output', 'Test': name, 'Output': 'RECRUIT_FAILURE_EVENT ' + payload + '\n'})
            if stage == 'barrier-observed':
                for identity in [original] + spares:
                    if not (identity == original and mode.startswith('raw-close')):
                        disconnect(identity['PID'], database)
                disconnect(pid + 3000, database)
            if stage == 'reaped-backends-absent':
                statement(drop, pid, database)
        disconnect(pid, database)
        if color == 'red':
            events.append({'Package': 'api', 'Action': 'output', 'Test': name, 'Output': 'forbidden inherited fixture cleanup executed'})
        events.append({'Package': 'api', 'Action': 'pass' if color == 'green' else 'fail', 'Test': name})
    events += [{'Package': 'api', 'Action': 'pass' if color == 'green' else 'fail', 'Test': root},
               {'Package': 'api', 'Action': 'pass' if color == 'green' else 'fail'}]
    dump_events(color, events)
statement("SELECT 'PROCESS_LOG_end'; CREATE SCHEMA process_log_end; DROP SCHEMA process_log_end")
record('database system is shut down')
record('logger shutting down', 20, None)
files['server/evidence.json'] = json_lines(rows)

def seal(data):
    data['server.tar'], data['log-inventory.txt'] = pack({k[7:]: v for k, v in data.items() if k.startswith('server/')}, 'process-failure-pg-log')
    if 'collector.json' in data:
        collector = json.loads(data['collector.json'])
        collector['archive_sha256'] = hashlib.sha256(data['server.tar']).hexdigest()
        data['collector.json'] = json.dumps(collector).encode()


def run(data):
    with prepared(data) as base:
        check(base)

def mutate(label, change):
    changed = copy.deepcopy(files)
    change(changed)
    with prepared(changed) as base:  # Setup and cleanup failures are outside the parser-only assertion.
        try:
            check(base)
        except (AssertionError, KeyError, ValueError, TypeError, tarfile.TarError):
            print('REJECTED:', label)
        else:
            failures.append(label)
            print('FALSE GREEN:', label)


def reject(label, filename, transform):
    def change(data):
        original = data.get(filename, b'')
        value = read_json_lines(original) if filename.endswith('.json') else original
        result = transform(value)
        data[filename] = json_lines(result) if filename.endswith('.json') else result
        if filename.startswith('server/'):
            seal(data)
    mutate(label, change)


files['collector.json'] = json.dumps(dict(
    container='c' * 64, stop_started_ns=10, logger_exited_ns=20, archive_completed_ns=30,
    postmaster=dict(pid=10, start_ticks=100, parent=1, state='S', exit_code=0, start_code=4096, end_code=8192),
    logger=dict(pid=20, start_ticks=101, parent=10, state='S', exit_code=0, start_code=4096, end_code=8192),
    logger_after=None, logger_exit='absent')).encode()
files['initialization.json'] = json.dumps(dict(pid=5, start_ticks=50, collector='off', ready=True, reaped=True, exit=0, fresh_logs=True)).encode()
seal(files)
run(files)
log = 'server/evidence.json'
reject('missing session_start', log, lambda rs: [{k: v for k, v in r.items() if k != 'session_start'} for r in rs])
reject('session line gaps', log, lambda rs: [dict(r, line_num=r['line_num'] * 2) for r in rs])
reject('missing intermediate observer line', log, lambda rs: [r for r in rs if not (r['pid'] == 100 and r['line_num'] == 2)])
reject('conflicting session_start', log, lambda rs: [dict(r, session_start='2020-01-01 00:00:00 UTC') for r in rs])
reject('late red admin DROP', log, lambda rs:
       [r for r in rs[:-2] if r['pid'] != 3200] + [r for r in rs if r['pid'] == 3200] + rs[-2:])
reject('ignored extra file', 'server/extra.log', lambda _: b'DROP SCHEMA forbidden;\n')
reject('duplicate test pass', 'green.json', lambda es: es[:-1] + [next(e for e in es if e['Action'] == 'pass')] + es[-1:])
reject('unknown Go action', 'green.json', lambda es: es[:-1] + [{'Package': 'api', 'Action': 'invented'}] + es[-1:])
reject('missing connection ending', log, lambda rs: [r for r in rs if not (r['pid'] == 1100 and 'disconnection:' in r['message'])])
reject('missing shutdown', log, lambda rs: [r for r in rs if r['message'] != 'database system is shut down'])
reject('missing positive control', log, lambda rs: [r for r in rs if 'PROCESS_LOG_end' not in r['message']])
reject('bootstrap not reaped', 'bootstrap.json', lambda rs: [dict(rs[0], reaped=False)])
reject('output after terminal', 'green.json', lambda es: es + [{'Package': 'api', 'Action': 'output', 'Output': 'late'}])
reject('subtest after parent terminal', 'green.json', lambda es: es[:-1] + [{'Package': 'api', 'Action': 'run', 'Test': root + '/late'}] + es[-1:])
reject('hash mismatch', 'log-inventory.txt', lambda _: b'wrong hash')
reject('corrupt archive', 'server.tar', lambda _: b'invalid tar')
reject('logging disabled', 'settings.txt', lambda data: data.replace(b'log_statement=all', b'log_statement=none'))
reject('missing red DROP', log, lambda rs: [r for r in rs if not (r['pid'] == 3200 and 'DROP SCHEMA' in r['message'])])
reject('missing parent DROP', log, lambda rs: [r for r in rs if not (r['pid'] == 100 and 'DROP SCHEMA' in r['message'])])
reject('bootstrap DROP', log, lambda rs: [dict(r, message=r['message'].replace('CREATE SCHEMA', 'DROP SCHEMA')) if r['pid'] == 50 else r for r in rs])
reject('race diagnostic', 'green.json', lambda es: es[:-1] + [{'Package': 'api', 'Action': 'output', 'Output': 'WARNING: DATA RACE'}] + es[-1:])
reject('failed original success', 'success.json', lambda es: [dict(e, Action='fail') if e['Action'] == 'pass' else e for e in es])

# Independent review regressions preserve the original 5216642 false-green semantics.
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
reject('bootstrap race and release-timeout diagnostics', 'bootstrap.log', lambda raw: raw + b'WARNING: DATA RACE\nfailure barrier release timed out\n')

# Per-file inventory and independently resealed semantic capture failures.
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

# Exact Go lifecycle/inventory, diagnostics, and raw bootstrap protocol.
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

# Matching output and SQL mutation prevents an inventory mismatch masking semantic errors.
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
for name in sorted({e['Test'] for e in read_json_lines(files['green.json']) if 'Test' in e}):
    reject('missing required ' + name, 'green.json', lambda es, n=name: [e for e in es if e.get('Test') != n])
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
    run(delayed)

# Positive protocol variants exercise permitted serialization, not PostgreSQL execution.
capture = json.loads(files['collector.json'])
capture.update(logger_exit='zero-exit-zombie', logger_after=dict(capture['logger'], state='Z', exit_code=0))
mutate('historically permitted zombie is not disappearance', lambda data: data.update({'collector.json': json.dumps(capture).encode()}))
for key, value in [('pid', 99), ('start_ticks', 999), ('state', 'S'), ('exit_code', 1)]:
    bad = copy.deepcopy(capture)
    bad.update(logger_exit='absent', logger_after=dict(bad['logger_after'], **{key: value}))
    mutate('zombie ' + key, lambda data, v=bad: data.update({'collector.json': json.dumps(v).encode()}))
fragmented = copy.deepcopy(files)
events = []
for event in read_json_lines(fragmented['green.json']):
    if event.get('Output', '').startswith('RECRUIT_FAILURE_EVENT '):
        middle = len(event['Output']) // 2
        events.extend([dict(event, Output=event['Output'][:middle]), dict(event, Output=event['Output'][middle:])])
    else:
        events.append(event)
fragmented['green.json'] = json_lines(events)
run(fragmented)
with prepared(files) as base:
    result = run_cli([sys.executable, str(parser.resolve())], base)
    assert result.returncode == 0, result.stderr
reject('duplicate setting', 'settings.txt', lambda raw: raw + b'\nlog_statement=all')
reject('wrong package', 'green.json', lambda es: [dict(e, Package='other') for e in es])
reject('bootstrap nonboolean reap', 'bootstrap.json', lambda rs: [dict(rs[0], reaped=1)])
directory_archive = copy.deepcopy(files)
archive_entry(directory_archive, 'process-failure-pg-log', tarfile.DIRTYPE)
run(directory_archive)
offset_identity = copy.deepcopy(files)
protocol_change(offset_identity, lambda e: e['Observer'].update(Start=e['Observer']['Start'].replace('Z', '+00:00')))
run(offset_identity)
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
print('Synthetic conformance failures:', failures)
assert not failures, 'unresolved false greens: ' + ', '.join(failures)
