"""Protocol v5 reference artifacts and parser invocation context, never an oracle."""
import copy
import hashlib
import json
from pathlib import Path
import runpy
import tarfile
from evidence_artifacts import json_lines, read_json_lines, pack, prepared


def build_fixture():
    root = 'TestPGRecruitCleanupFailureProcess'
    files = {
        'server/evidence.log': (b'PROCESS_FALLBACK 10 10 LOG:  ending log output to stderr\n'
                                b'PROCESS_FALLBACK 10 10 HINT:  Future log output will go to log destination "jsonlog".\n'
                                b'PROCESS_FALLBACK 20 20 DEBUG:  logger shutting down\n'),
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

    record('ending log output to stderr').update(error_severity='LOG', backend_type='postmaster',
                                                hint='Future log output will go to log destination "jsonlog".')
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
    files['collector.json'] = json.dumps(dict(
        container='c' * 64, stop_started_ns=10, logger_exited_ns=20, archive_completed_ns=30,
        postmaster=dict(pid=10, start_ticks=100, parent=1, state='S', exit_code=0, start_code=4096, end_code=8192),
        logger=dict(pid=20, start_ticks=101, parent=10, state='S', exit_code=0, start_code=4096, end_code=8192),
        logger_after=None, logger_exit='absent')).encode()
    files['initialization.json'] = json.dumps(dict(pid=5, start_ticks=50, collector='off', ready=True, reaped=True, exit=0, fresh_logs=True)).encode()
    seal(files)
    return files


def seal(data):
    data['server.tar'], data['log-inventory.txt'] = pack({k[7:]: v for k, v in data.items() if k.startswith('server/')}, 'process-failure-pg-log')
    if 'collector.json' in data:
        collector = json.loads(data['collector.json'])
        collector['archive_sha256'] = hashlib.sha256(data['server.tar']).hexdigest()
        data['collector.json'] = json.dumps(collector).encode()


class EvidenceCase:
    def __init__(self, parser):
        self.parser = Path(parser)
        self.check = runpy.run_path(str(self.parser))['check']
        self.files = build_fixture()
        self.original = copy.deepcopy(self.files)
        self.labels, self.positives, self.failures = [], [], []

    def positive(self, data, label):
        with prepared(data) as base:
            self.check(base)
        self.positives.append(label)

    def mutate(self, label, change):
        changed = copy.deepcopy(self.files)
        change(changed)
        with prepared(changed) as base:
            try:
                self.check(base)
            except (AssertionError, KeyError, ValueError, TypeError, tarfile.TarError):
                print('REJECTED:', label)
            else:
                self.failures.append(label)
        self.labels.append(label)

    def reject(self, label, filename, transform):
        def change(data):
            original = data.get(filename, b'')
            value = read_json_lines(original) if filename.endswith('.json') else original
            result = transform(value)
            data[filename] = json_lines(result) if filename.endswith('.json') else result
            if filename.startswith('server/'):
                seal(data)
        self.mutate(label, change)

    def inventory(self, start, count, digest):
        labels = self.labels[start:]
        actual = hashlib.sha256(json.dumps(sorted(labels)).encode()).hexdigest()
        assert len(labels) == len(set(labels)) == count and actual == digest, 'case inventory changed'
        assert self.files == self.original, 'shared baseline mutated'

    def finish(self):
        assert not self.failures, 'false greens: ' + ', '.join(self.failures)
