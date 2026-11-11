"""Owned local Git fixtures and assertions for the project's fixed CI format."""
import os
from pathlib import Path
import re
import subprocess
import tempfile


class GitFixture:
    """Data/lifecycle helper, never a TestCase or a remote-operation interface."""
    def setup_repository(self, files):
        self.temporary = tempfile.TemporaryDirectory(dir=os.environ['TMPDIR'])
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / 'repo'
        try:
            self.root.mkdir()
            self.git('init', '-q', '--template=')
            self.git('config', 'user.name', 'Synthetic CI test')
            self.git('config', 'user.email', 'synthetic@example.invalid')
            for name, data in files.items():
                self.write(name, data)
            self.commit()
            self.initial = self.git('rev-parse', 'HEAD').strip()
        except BaseException:
            self.close()
            raise

    def git(self, *args):
        if self.root != self.base / 'repo' or self.root.resolve() != self.root or (self.root / '.git').is_symlink():
            raise ValueError('fixture repository alias')
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(self.base), 'TMPDIR': str(self.base),
               'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_NO_REPLACE_OBJECTS': '1'}
        return subprocess.check_output(['/usr/bin/git', '-C', str(self.root), '-c', 'core.hooksPath=/dev/null',
                                        '-c', 'core.fsmonitor=false', *args], env=env,
                                       stderr=subprocess.PIPE, timeout=15).decode()

    def write(self, name, data):
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*', name):
            raise ValueError('invalid fixture path')
        if any(part in ('.', '..') or part.lower() == '.git' for part in name.split('/')):
            raise ValueError('unsafe fixture path')
        path = self.root
        if path != self.base / 'repo' or path.resolve() != path:
            raise ValueError('fixture root alias')
        for part in name.split('/'):
            path = path / part
            if path.is_symlink():
                raise ValueError('fixture symlink')
        if path.exists() and (not path.is_file() or path.stat().st_nlink != 1):
            raise ValueError('fixture target type/link')
        payload = data.encode() if isinstance(data, str) else data
        if not isinstance(payload, bytes):
            raise TypeError('fixture bytes/text required')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    def commit(self):
        self.git('add', '.')
        self.git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic fixture')

    def restore(self):
        self.git('reset', '--hard', self.initial)
        self.git('clean', '-fdx')

    def close(self):
        self.temporary.cleanup()


def assert_receipt_workflow(test, text, paths, command, evidence):
    """The complete fixed head/read-only/success-receipt contract, for three real workflows."""
    test.assertEqual(text.count('      - '), 2 * len(paths) + 3)
    for name in paths:
        test.assertEqual(text.count('      - ' + name + '\n'), 2)
    head = "github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha"
    for fragment in ['  pull_request:', '  push:', '    branches: [main]', '  contents: read',
                     'persist-credentials: false', 'timeout-minutes: 5', 'set -euo pipefail', command,
                     'ref: ${{ ' + head + ' }}', 'EXPECTED_HEAD: ${{ ' + head + ' }}',
                     'test ! -e "$RUNNER_TEMP/' + evidence + '"',
                     'test -s "$RUNNER_TEMP/' + evidence + '/receipt.json"',
                     'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
                     'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
                     'path: ${{ runner.temp }}/' + evidence + '/receipt.json', 'if-no-files-found: error']:
        test.assertIn(fragment, text)
    test.assertEqual(text.count(head), 2)
    for forbidden in ['workflow_dispatch', 'pull_request_target', 'if: always()', 'services:', 'pip install', 'contents: write']:
        test.assertNotIn(forbidden, text)
