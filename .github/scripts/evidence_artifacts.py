"""Byte-only helpers for artifact tests; never an evidence acceptance oracle."""
from contextlib import contextmanager
import hashlib
import io
import json
from pathlib import Path, PurePosixPath, PureWindowsPath
import subprocess
import tarfile
import tempfile
import unicodedata


def relative_name(name):
    """Require one unambiguous portable relative path, without normalizing it."""
    if not isinstance(name, str) or not name:
        raise ValueError('artifact name must be a nonempty string')
    parts = name.split('/')
    if (PurePosixPath(name).is_absolute() or PureWindowsPath(name).drive or '\\' in name
            or any(part in {'', '.', '..'} for part in parts)
            or unicodedata.normalize('NFC', name) != name
            or any(ord(char) < 32 or ord(char) == 127 for char in name)):
        raise ValueError('unsafe or noncanonical artifact name: ' + repr(name))
    return name


def snapshot(files):
    """Validate all names/conflicts/types before any filesystem write."""
    copied = {}
    for name, value in files.items():
        relative_name(name)
        if not isinstance(value, bytes):
            raise TypeError('artifact content must be bytes')
        copied[name] = value
    for name in copied:
        if any(str(parent) in copied for parent in PurePosixPath(name).parents):
            raise ValueError('artifact file/directory conflict')
    return dict(sorted(copied.items()))


def json_lines(values):
    return ''.join(json.dumps(value, ensure_ascii=False, allow_nan=False) + '\n' for value in values).encode('utf-8')


def invalid_constant(value):
    raise ValueError('non-JSON constant: ' + value)


def read_json_lines(raw):
    if not raw:
        return []
    lines = raw.decode('utf-8').split('\n')
    if lines[-1] == '':
        lines.pop()  # A single terminal LF ends the final record; blank records remain errors.
    return [json.loads(line, parse_constant=invalid_constant) for line in lines]


def pack(files, prefix):
    """Return deterministic regular-file tar bytes and sorted sha256sum bytes."""
    copied = snapshot(files)
    relative_name(prefix)
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode='w', format=tarfile.PAX_FORMAT) as archive:
        for name, value in copied.items():
            info = tarfile.TarInfo(prefix + '/' + name)
            info.size = len(value)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(value))
    inventory = ''.join(hashlib.sha256(value).hexdigest() + '  ' + name + '\n' for name, value in copied.items())
    return stream.getvalue(), inventory.encode('utf-8')


@contextmanager
def prepared(files):
    """Enter fully prepared evidence before catching a parser rejection."""
    copied = snapshot(files)
    with tempfile.TemporaryDirectory(prefix='evidence-case-') as directory:
        root = Path(directory)
        for name, value in copied.items():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(value)
        yield root


def run_cli(command, directory):
    """Launch an explicit argv, append the evidence path, return the raw result.

    Launch errors propagate. Nonzero status is not classified as evidence rejection.
    Call only after preparation; the caller owns every acceptance assertion.
    """
    return subprocess.run([*command, str(directory)], capture_output=True, text=True, check=False)
