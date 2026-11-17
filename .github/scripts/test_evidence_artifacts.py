"""Independent byte-level expectations; no production evidence parser imports."""
import io
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import evidence_artifacts as artifacts


class ArtifactsTest(unittest.TestCase):
    def test_exact_inventory_and_members(self):
        archive, inventory = artifacts.pack({'z': b'', 'a': b'abc'}, 'capture')
        self.assertEqual(inventory, (
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  a\n'
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  z\n').encode())
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            self.assertEqual(tar.getnames(), ['capture/a', 'capture/z'])
            for member, value in zip(tar.getmembers(), [b'abc', b'']):
                self.assertTrue(member.isfile())
                self.assertEqual((member.uid, member.gid, member.mtime, member.mode), (0, 0, 0, 0o644))
                self.assertEqual(tar.extractfile(member).read(), value)

    def test_deterministic_and_content_sensitive(self):
        first = artifacts.pack({'z': b'', 'a': b'abc'}, 'capture')
        self.assertEqual(first, artifacts.pack({'a': b'abc', 'z': b''}, 'capture'))
        changed = artifacts.pack({'a': b'abd', 'z': b''}, 'capture')
        self.assertNotEqual(first[0], changed[0])
        self.assertNotEqual(first[1], changed[1])

    def test_unicode_binary_empty_and_nested_bytes(self):
        files = {'子/é.bin': b'\x00\xff\r\n', 'empty': b'', 'broken.json': b'{'}
        archive, _ = artifacts.pack(files, 'capture')
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            self.assertEqual(tar.extractfile('capture/子/é.bin').read(), b'\x00\xff\r\n')
            self.assertEqual(tar.extractfile('capture/broken.json').read(), b'{')
        with artifacts.prepared(files) as directory:
            for name, value in files.items():
                self.assertEqual((directory / name).read_bytes(), value)
            saved = directory
        self.assertFalse(saved.exists())
        self.assertEqual(files['broken.json'], b'{')

    def test_bad_names_before_writes(self):
        names = ['', '/', '/absolute', '../escape', 'a/../b', './a', 'a//b', 'a/',
                 'C:/escape', 'C:relative', '\\escape', 'a\\b', 'a\x00b', 'a\nb', 'e\u0301']
        for name in names:
            with self.subTest(name=name):
                with patch.object(artifacts.tempfile, 'TemporaryDirectory') as temporary:
                    with self.assertRaises(ValueError):
                        with artifacts.prepared({name: b'bad'}):
                            self.fail('unsafe input reached body')
                    temporary.assert_not_called()
                with self.assertRaises(ValueError):
                    artifacts.pack({'safe': b'good'}, name)

    def test_conflicts_and_types(self):
        for files in [{'a': b'', 'a/b': b''}, {'a/b': b'', 'a': b''},
                      {'é': b'', 'e\u0301': b''}, {'a': b'', './a': b''}]:
            with self.subTest(files=files), self.assertRaises(ValueError):
                artifacts.pack(files, 'capture')
        for content in ['text', bytearray(b'bytes'), None, 5]:
            with self.subTest(content=content), self.assertRaises(TypeError):
                artifacts.snapshot({'name': content})
        with self.assertRaises(ValueError):
            artifacts.snapshot({1: b''})

    def test_json_lines_independent_expected_bytes(self):
        expected = b'{"a": 1}\n[true, null]\n'
        self.assertEqual(artifacts.json_lines([{'a': 1}, [True, None]]), expected)
        self.assertEqual(artifacts.read_json_lines(expected), [{'a': 1}, [True, None]])
        self.assertEqual(artifacts.json_lines([]), b'')
        self.assertEqual(artifacts.read_json_lines(b''), [])
        self.assertEqual(artifacts.json_lines(['é']), '"é"\n'.encode())

    def test_json_lines_literal_unicode_separators(self):
        raw = b'"\xc2\x85"\n"\xe2\x80\xa8"\n"\xe2\x80\xa9"\n'
        values = ['\u0085', '\u2028', '\u2029']
        self.assertEqual(artifacts.read_json_lines(raw), values)
        self.assertEqual(artifacts.json_lines(values), raw)
        self.assertEqual(artifacts.read_json_lines(b'1\r\n2\r\n'), [1, 2])
        self.assertEqual(artifacts.read_json_lines(b'1\n2'), [1, 2])
        self.assertEqual(artifacts.read_json_lines(b'1'), [1])

    def test_json_lines_only_lf_is_record_boundary(self):
        for raw in [b'1\x0b2\n', b'1\x0c2\n', b'1\x1c2\n',
                    b'1\xe2\x80\xa82\n', b'1\xe2\x80\xa92\n', b'1\xc2\x852\n', b'1\r2\n']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                artifacts.read_json_lines(raw)
        for raw in [b'\n', b'1\n\n', b'1\n\n2\n']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                artifacts.read_json_lines(raw)

    def test_json_failures_are_not_swallowed(self):
        for raw in [b'{\n', b'\xff', b'\n', b'NaN\n', b'Infinity\n']:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                artifacts.read_json_lines(raw)
        with self.assertRaises(ValueError):
            artifacts.json_lines([float('nan')])
        with self.assertRaises(TypeError):
            artifacts.json_lines([object()])

    def test_preparation_failure_cannot_enter_rejection_assertion(self):
        reached_parser = False
        created = []
        def failed_write(path, value):
            created.append(path.parent)
            raise OSError('write failed')
        with patch.object(Path, 'write_bytes', failed_write):
            with self.assertRaisesRegex(OSError, 'write failed'):
                with artifacts.prepared({'a': b''}):
                    reached_parser = True
                    with self.assertRaises(AssertionError):
                        raise AssertionError('parser rejection')
        self.assertFalse(reached_parser)
        self.assertEqual(len(created), 1)
        self.assertFalse(created[0].exists())

    def test_callback_exception_cleanup_only_owned_directory(self):
        with tempfile.TemporaryDirectory() as outside:
            sentinel = Path(outside) / 'keep'
            sentinel.write_bytes(b'unrelated')
            with self.assertRaisesRegex(RuntimeError, 'parser failed'):
                with artifacts.prepared({'a': b''}) as directory:
                    saved = directory
                    raise RuntimeError('parser failed')
            self.assertFalse(saved.exists())
            self.assertEqual(sentinel.read_bytes(), b'unrelated')

    def test_cli_raw_status_and_launch_failure(self):
        code = 'import pathlib,sys; print(pathlib.Path(sys.argv[1], "a").read_text()); sys.exit(7)'
        with artifacts.prepared({'a': b'evidence'}) as directory:
            result = artifacts.run_cli([sys.executable, '-c', code], directory)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (7, 'evidence\n', ''))
            good = artifacts.run_cli([sys.executable, '-c', 'print("ok")'], directory)
            self.assertEqual((good.returncode, good.stdout), (0, 'ok\n'))
            with self.assertRaises(FileNotFoundError):
                artifacts.run_cli([str(directory / 'nonexistent-tool')], directory)


if __name__ == '__main__':
    unittest.main()
