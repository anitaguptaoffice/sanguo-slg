# FCT1 canonical and independent-parser audit

This companion owns positive semantic fidelity and canonical determinism.
It consumes the four literal adopted fixtures without regenerating expected hex:
52, 493, 115 and 242 bytes, with their frozen SHA-256 values. Typed expectations
include all seven first-release catalog entries, independently of DefaultCatalog.
The current-default digest is
`d277302125bd6b8574e451a7a75a2052d6271b0bb6f2fb789d095d5ae4dbab14`.

A separate checked byte-arithmetic parser shares no production parser, encoder,
snapshot validator or default catalog. Both parsers must produce the same exact
typed fixtures and 194801-byte structural maximum. The oracle checks counts,
signed ranges, UTF-8, order, references, metadata, digest and complete EOF.
Deterministic generated roundtrips preserve unused catalog entries, full int64
values, byte-distinct Unicode, insertion order independence and nil/empty jobs.
Actor changes leave content unchanged; decoded maps and buffers remain isolated.
Unknown semantic labels are parseable data, never evidence of APP manifest support.

Depends on the complete pure codec/source contract-test component. The hostile
companion reuses these literal fixtures and independent parser for differential
validation; all three components must be reviewed and verified together before
any merge. This audit is not PG recovery, source enrollment or startup activation.
