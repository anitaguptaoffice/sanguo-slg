"""Support facility controls and its fixed, standalone exact-head unittest entry."""
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.append(str(Path(__file__).absolute().parent))
import ci_test_support as support

OWN = ('.github/scripts/ci_test_support.py', '.github/scripts/test_ci_test_support.py',
       '.github/scripts/CI-TEST-SUPPORT.md', '.github/workflows/ci-test-support.yml')
NAMES = ('test_lifecycle', 'test_owned_writes', 'test_setup_cleanup_and_git_errors',
         'test_ambient_git_isolation', 'test_workflow_assertion', 'test_own_bootstrap')


def source_records(root, head):
    def git(*args):
        return subprocess.check_output(['/usr/bin/git', '-C', str(root), '-c', 'core.fsmonitor=false', *args],
                                       env={'PATH': '/usr/bin:/bin', 'HOME': str(root), 'GIT_CONFIG_NOSYSTEM': '1',
                                            'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_NO_REPLACE_OBJECTS': '1',
                                            'GIT_OPTIONAL_LOCKS': '0'}, stderr=subprocess.PIPE, timeout=15).decode().strip()
    if root != root.resolve() or not re.fullmatch('[0-9a-f]{40}', head):
        raise ValueError('canonical root and event head required')
    if git('rev-parse', '--show-toplevel') != str(root) or git('rev-parse', 'HEAD') != head:
        raise ValueError('wrong source root/head')
    for args in [('diff',), ('diff', '--cached')]:
        git(*args, '--quiet', '--no-ext-diff', '--no-textconv', head, '--', *OWN)
    records = {}
    for name in OWN:
        path = root / name
        if any(p.is_symlink() for p in (path, *path.parents)) or not path.is_file() or path.stat().st_nlink != 1:
            raise ValueError('source alias/missing')
        mode, kind, blob, actual = git('ls-tree', head, '--', name).split()
        if actual != name or kind != 'blob' or mode != ('100755' if path.stat().st_mode & 0o111 else '100644'):
            raise ValueError('source mode/inventory')
        if git('hash-object', '--no-filters', '--', name) != blob:
            raise ValueError('source blob')
        records[name] = {'mode': mode, 'blob': blob, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    return {'head': head, 'tree': git('rev-parse', 'HEAD^{tree}'), 'files': records}


def self_check(root, head, evidence):
    if evidence != evidence.resolve() or root in evidence.parents:
        raise ValueError('private evidence location')
    evidence.mkdir(mode=0o700)
    before = source_records(root, head)
    if Path(support.__file__).absolute() != root / OWN[0] or Path(__file__).absolute() != root / OWN[1]:
        raise ImportError('wrong support/test import')
    with (evidence / 'unittest.txt').open('x') as output, contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
        try:
            loader = unittest.TestLoader()
            suite = loader.loadTestsFromModule(sys.modules[__name__])
            def flatten(tests):
                return [name for test in tests for name in (flatten(test) if isinstance(test, unittest.TestSuite) else [test.id()])]
            expected = sorted(__name__ + '.SupportTests.' + name for name in NAMES)
            if loader.errors or sorted(flatten(suite)) != expected:
                raise ValueError('incomplete/extra support inventory')
            result = unittest.TextTestRunner(stream=output, verbosity=2).run(suite)
            if result.testsRun != len(expected) or not result.wasSuccessful() or result.skipped or result.expectedFailures or result.unexpectedSuccesses:
                raise ValueError('support tests rejected')
        finally:
            after = source_records(root, head)
            if before != after:
                raise ValueError('support source changed')
    (evidence / 'source-records.json').write_text(json.dumps({'before': before, 'after': after}, sort_keys=True) + '\n')


class SupportTests(unittest.TestCase):
    def fixture(self, files=None):
        fixture = support.GitFixture()
        fixture.setup_repository({'pkg/data': b'original\n'} if files is None else files)
        self.addCleanup(fixture.close)
        return fixture

    def test_lifecycle(self):
        original = {'pkg/data': b'original\n', 'text': 'unicode \u2603\n'}
        fixture = self.fixture(original)
        self.assertEqual((fixture.root / 'text').read_text(), original['text'])
        fixture.write('pkg/data', 'changed\n')
        fixture.write('untracked', b'temporary')
        fixture.restore()
        self.assertEqual((fixture.root / 'pkg/data').read_bytes(), original['pkg/data'])
        self.assertFalse((fixture.root / 'untracked').exists())
        fixture.write('pkg/data', 'committed\n')
        fixture.commit()
        self.assertNotEqual(fixture.git('rev-parse', 'HEAD').strip(), fixture.initial)
        self.assertEqual(original['pkg/data'], b'original\n')
        fixture.close()
        fixture.close()
        self.assertFalse(fixture.base.exists())

    def test_owned_writes(self):
        fixture = self.fixture()
        sentinel = fixture.base / 'sentinel'
        sentinel.write_bytes(b'untouched')
        for name in ('', '/absolute', '../sentinel', 'pkg/../../sentinel', './x', 'a//b', '.git/config', 'a/.GIT/x', 'a\\b', None):
            with self.subTest(name=name), self.assertRaises(ValueError):
                fixture.write(name, 'forbidden')
        (fixture.root / 'alias').symlink_to(fixture.base, target_is_directory=True)
        (fixture.root / 'linked').symlink_to(sentinel)
        os.link(sentinel, fixture.root / 'hardlink')
        for name in ('alias/sentinel', 'linked', 'hardlink', 'pkg'):
            with self.assertRaises(ValueError):
                fixture.write(name, 'forbidden')
        with self.assertRaises(TypeError):
            fixture.write('invalid-data', object())
        self.assertFalse((fixture.root / 'invalid-data').exists())
        self.assertEqual(sentinel.read_bytes(), b'untouched')
        with patch.object(fixture, 'root', fixture.base), self.assertRaises(ValueError):
            fixture.restore()

    def test_setup_cleanup_and_git_errors(self):
        for files in ({'../escape': 'bad'}, {}):
            fixture = support.GitFixture()
            with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                fixture.setup_repository(files)
            self.assertFalse(fixture.base.exists())
        fixture = support.GitFixture()
        with patch.object(support.subprocess, 'check_output', side_effect=subprocess.TimeoutExpired('git', 15)):
            with self.assertRaises(subprocess.TimeoutExpired):
                fixture.setup_repository({'data': b'x'})
        self.assertFalse(fixture.base.exists())
        fixture = self.fixture()
        with self.assertRaises(subprocess.CalledProcessError):
            fixture.git('rev-parse', '--verify', 'missing-ref')

    def test_ambient_git_isolation(self):
        first = self.fixture()
        before = {str(p.relative_to(first.base)): p.read_bytes() for p in first.base.rglob('*') if p.is_file()}
        ambient = {'GIT_DIR': str(first.root / '.git'), 'GIT_WORK_TREE': str(first.root),
                   'GIT_INDEX_FILE': str(first.root / '.git/index'), 'GIT_OBJECT_DIRECTORY': str(first.root / '.git/objects'),
                   'GIT_TEMPLATE_DIR': str(first.root), 'GIT_CONFIG_GLOBAL': str(first.root / 'text'),
                   'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'core.worktree', 'GIT_CONFIG_VALUE_0': str(first.root)}
        with patch.dict(os.environ, ambient):
            second = self.fixture({'other': b'isolated'})
            second.write('other', 'changed')
            second.commit()
            second.restore()
            self.assertEqual(second.git('rev-parse', '--show-toplevel').strip(), str(second.root))
        after = {str(p.relative_to(first.base)): p.read_bytes() for p in first.base.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        self.assertEqual((second.root / 'other').read_bytes(), b'isolated')

    def test_workflow_assertion(self):
        head = "github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha"
        text = ('  pull_request:\n      - pkg/file\n  push:\n    branches: [main]\n      - pkg/file\n'
                '  contents: read\n      - checkout\n      - test\n      - upload\npersist-credentials: false\n'
                'timeout-minutes: 5\nset -euo pipefail\ncommand\nref: ${{ ' + head + ' }}\nEXPECTED_HEAD: ${{ ' + head + ' }}\n'
                'test ! -e "$RUNNER_TEMP/evidence"\ntest -s "$RUNNER_TEMP/evidence/receipt.json"\n'
                'actions/checkout@11d5960a326750d5838078e36cf38b85af677262\n'
                'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n'
                'path: ${{ runner.temp }}/evidence/receipt.json\nif-no-files-found: error\n')
        support.assert_receipt_workflow(self, text, ('pkg/file',), 'command', 'evidence')
        for fragment in text.splitlines():
            with self.subTest(fragment=fragment), self.assertRaises(AssertionError):
                support.assert_receipt_workflow(self, text.replace(fragment, 'REMOVED'), ('pkg/file',), 'command', 'evidence')
        for forbidden in ('workflow_dispatch', 'pull_request_target', 'if: always()', 'services:', 'pip install', 'contents: write'):
            with self.assertRaises(AssertionError):
                support.assert_receipt_workflow(self, text + forbidden, ('pkg/file',), 'command', 'evidence')
        actual = (Path(__file__).absolute().parents[2] / OWN[-1]).read_text()
        for path in OWN:
            self.assertEqual(actual.count('      - ' + path + '\n'), 2)
        self.assertEqual(actual.count(head), 2)
        self.assertEqual(actual.count('      - '), 2 * len(OWN) + 3)
        for fragment in ('  pull_request:', '  push:', '    branches: [main]', 'contents: read', 'persist-credentials: false', 'timeout-minutes: 5', 'set -euo pipefail',
                         'python3 -I -B .github/scripts/test_ci_test_support.py "$EXPECTED_HEAD"',
                         'test ! -e "$RUNNER_TEMP/ci-test-support"', 'test -s "$RUNNER_TEMP/ci-test-support/source-records.json"',
                         'test -s "$RUNNER_TEMP/ci-test-support/unittest.txt"', 'if-no-files-found: error',
                         '${{ runner.temp }}/ci-test-support/source-records.json', '${{ runner.temp }}/ci-test-support/unittest.txt'):
            self.assertIn(fragment, actual)
        for action in ('checkout@11d5960a326750d5838078e36cf38b85af677262', 'upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'):
            self.assertIn('actions/' + action, actual)
        for forbidden in ('workflow_dispatch', 'pull_request_target', 'if: always()', 'services:', 'contents: write'):
            self.assertNotIn(forbidden, actual)

    def test_own_bootstrap(self):
        root = Path(__file__).absolute().parents[2]
        files = {name: (root / name).read_bytes() for name in OWN}
        fixture = self.fixture(files)
        prefix = files[OWN[1]].decode().rsplit("\n\nif __name__ == '__main__':", 1)[0]
        entry = files[OWN[1]].decode()[len(prefix):]
        for variant in ('pass', 'zero', 'extra', 'duplicate', 'failure', 'error', 'skip', 'xfail', 'xpass', 'not_run', 'mutation', 'import'):
            fixture.restore()
            body = 'self.assertTrue(True)'
            if variant in ('failure', 'xfail'):
                body = 'self.fail("controlled")'
            if variant == 'error':
                body = 'raise RuntimeError("controlled")'
            if variant == 'mutation':
                body = 'Path(__file__).write_text("# persistent mutation")'
            decorator = '@unittest.skip("controlled")\n    ' if variant == 'skip' else '@unittest.expectedFailure\n    ' if variant in ('xfail', 'xpass') else ''
            synthetic = '\nclass SupportTests(unittest.TestCase):\n' + ''.join('    ' + decorator + 'def ' + n + '(self):\n        ' + body + '\n' for n in NAMES)
            if variant == 'extra':
                synthetic += '    def test_extra(self):\n        pass\n'
            if variant in ('zero', 'duplicate'):
                synthetic += '\ndef load_tests(loader, tests, pattern):\n    return unittest.TestSuite(' + ('[]' if variant == 'zero' else '[tests, tests]') + ')\n'
            if variant == 'not_run':
                synthetic += '\nclass Partial(unittest.TestSuite):\n    def run(self, result, debug=False):\n        return result\ndef load_tests(loader, tests, pattern):\n    return Partial(tests)\n'
            if variant == 'import':
                synthetic += '\nsupport.__file__ = "/wrong/support.py"\n'
            fixture.write(OWN[1], prefix + synthetic + entry)
            fixture.commit()
            directory = fixture.base / variant
            directory.mkdir()
            env = {'PATH': '/usr/bin:/bin', 'TMPDIR': str(directory), 'RUNNER_TEMP': str(directory)}
            result = subprocess.run([sys.executable, '-I', '-B', str(fixture.root / OWN[1]), fixture.git('rev-parse', 'HEAD').strip()],
                                    env=env, capture_output=True, timeout=15)
            records = directory / 'ci-test-support/source-records.json'
            self.assertEqual(result.returncode == 0, variant == 'pass', result.stderr.decode())
            self.assertEqual(records.exists(), variant == 'pass')
            if variant == 'pass':
                data = json.loads(records.read_text())
                self.assertEqual(data['before'], data['after'])
                self.assertEqual(set(data['before']['files']), set(OWN))
                self.assertIn('Ran 6 tests', records.with_name('unittest.txt').read_text())
                self.assertEqual(stat.S_IMODE(records.stat().st_mode), 0o600)
                with self.assertRaises(FileExistsError):
                    self_check(fixture.root, fixture.initial, records.parent)
        for change in ('head', 'dirty', 'missing', 'mode', 'blob'):
            fixture.git('config', 'core.filemode', 'true')
            fixture.restore()
            path = fixture.root / OWN[0]
            head = fixture.initial
            if change == 'head':
                head = '0' * 40
            elif change == 'missing':
                path.unlink()
            elif change == 'mode':
                fixture.git('config', 'core.filemode', 'false')
                path.chmod(0o755)
            else:
                if change == 'blob':
                    fixture.git('update-index', '--assume-unchanged', OWN[0])
                path.write_text('# altered')
            with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                source_records(fixture.root, head)


if __name__ == '__main__':
    os.umask(0o077)
    if not sys.flags.isolated or not sys.dont_write_bytecode or len(sys.argv) != 2:
        raise ValueError('isolated fixed event-head invocation required')
    self_check(Path(__file__).absolute().parents[2], sys.argv[1], Path(os.environ['RUNNER_TEMP']).absolute() / 'ci-test-support')
