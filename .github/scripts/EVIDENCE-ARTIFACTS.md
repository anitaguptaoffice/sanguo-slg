# Byte-level artifact test tools

`evidence_artifacts.py` has no PG/Go interpretation and imports no production evidence parser. Run its independent tests with `PYTHONDONTWRITEBYTECODE=1 python3 .github/scripts/test_evidence_artifacts.py`.

`pack(files, prefix)` returns deterministic regular-file tar bytes and sorted SHA256 inventory bytes for an explicit relative-name→bytes mapping. It does not modify the mapping or a collector manifest. The caller owns filename selection, manifest binding and every semantic assertion. No hash establishes source completeness.

`prepared(files)` validates all names/content types before writing inside its own new temporary directory; it yields that fully prepared directory and cleans only that directory afterward. Enter this context **outside** any expected-parser-rejection exception handler. Importing a parser, constructing mutations, encoding, packing, and entering preparation are setup, never proof of a correct rejection. Only the actual parser call belongs inside the narrowly typed rejection assertion. Cleanup errors must propagate outside that assertion.

Paths must be nonempty NFC-normalized portable relative names with no absolute/drive/backslash, empty/dot/parent component or control character. File/directory conflicts fail before writes. Inputs are bytes, not paths to existing local files; external files/symlinks are never followed.

`json_lines` and `read_json_lines` encode/decode UTF-8 JSON Lines, using physical LF boundaries only (CRLF works through JSON whitespace), rejecting blank records and invalid JSON/nonfinite constants; they do not interpret events. Arbitrary malformed artifact bytes remain supported through the original file mapping. Construct intentionally malformed tar directly with standard-library tools: `pack` never pretends to manufacture a duplicate-member/symlink archive.

`run_cli(argv, directory)` runs explicit argv plus the evidence directory, preserving stdout/stderr/returncode. Launch errors propagate. Nonzero exit is **not** automatically a valid parser rejection; imports, missing inputs and infrastructure failures also fail. The caller must distinguish them. No subprocess shell, package installation, network access or default parser is provided.

The complete process conformance fixture, required names, protocol mutations, acceptance decisions, collector binding and historical failure provenance remain owned by #2239. This component may be tested independently; its passing unit tests do not approve any process evidence or runtime.
