# Immutable pre-garrison wire fixture (CONTRACT-TEST-001 / #1757)

Both files are byte-for-byte `git show` exports from commit
`e767d1b12efed49d826badd32d93cf20b0243f98`, not hand-written minimal schemas:

| Fixture | Original path | Git blob SHA-1 |
|---|---|---|
| extra.proto.txt | internal/api/proto/sanguo/domestic/v1/extra.proto | f7bda68d325cf7ada0ca2a16c2492f13d6279056 |
| types.proto.txt | spec/proto/sanguo/common/v1/types.proto | e5db68e2abd5d3999c3bbd7b641a4abb24365124 |

The active extra imported canonical common types at that baseline. Both bytes are
pinned here; the legacy loader permits only these two import names, with no fallback.
`.proto.txt` excludes the fixtures from canonical protoc compilation and duplicate
message discovery. SHA-256 digests are verified by `garrison-wire.cjs` before loading:

- extra: `967c51027f5eb05034bfc5ab8f62619502325e0f22ed6a8ebf4fa5656cf2fbd2`
- types: `746d03c49e6f43e1f7e87f2d9ac1df6c6434db2e6e0b55143644ad69726141d3`

Run from repository root using installed client dependencies (or PROTOBUFJS_PATH):

```sh
node spec/proto/tests/garrison-wire.cjs
```

The legacy decoder remains fixed after API-WIRE-REPAIR-001. Separately, the mutable
active adapter must have exactly the legacy response shape or exactly the canonical
new response shape, including nested DTO shapes. Both contexts retain fields 1–3,
and the post-mirror context must preserve field 4 presence and bytes. The optional
`ACTIVE_PROTO_ROOT=/absolute/path/internal/api/proto` selects another real adapter
checkout for before/after testing; its missing shared imports use this checkout's
canonical spec, as the normal active adapter does. This override never changes the
legacy resolver or fixture hashes. This supersedes GARRISON-READ.md's earlier note
that the old decoder is read directly from the mutable active adapter.
