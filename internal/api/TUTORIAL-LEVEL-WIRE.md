# API-WIRE-ONBOARD-001 — ClaimQuestRewardResponse wire mirror

Mirrors merged contract #1763 (`spec/rules/onboarding.md` §4), ordinary proto3
`int32 player_level = 4`; existing fields remain `quest`, `chain`, `granted_rewards`.
Zero means unknown/legacy, not a level reset. Positive persisted levels (including
20) survive unchanged; same-actor/session monotonic application belongs to clients.
No handler, reward, proof, persistence or deployment changes are included here.

## Pinned generation and verification

Official `protoc-gen-go v1.36.5` (matches go.mod), `libprotoc 3.13.0`, Go 1.23.0.
The header changes from protoc 3.21.12 to the actual 3.13.0 used; no manual generated edits.

```sh
protoc -I internal/api/proto -I spec/proto --go_out=internal/api/pb \
  --go_opt=paths=source_relative \
  --go_opt=Msanguo/common/v1/types.proto=github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1 \
  sanguo/quest/v1/quest.proto
go test -race -v ./internal/api/pb/sanguo/quest/v1 | tee /tmp/quest-wire.log
go test -short ./internal/api/...
node internal/api/pb/sanguo/quest/v1/testdata/claim_reward_wire.cjs \
  ./client/node_modules/protobufjs /tmp/quest-wire.log
```

Regeneration must be byte-identical. The Go test uses a self-contained old descriptor
(no live import resolver), checks old fields and the complete unchanged quest schema,
old decoding of new bytes, new decoding of a frozen old reply, zero omission, exact
field-4 bytes, signed int32 limits and persisted level 20. protobufjs independently
consumes actual Go bytes and compares the current mirror with the canonical schema.
Negative values are wire-only coverage, not permission to apply an invalid level.

## Immutable legacy provenance

Old source commit: `e767d1b12efed49d826badd32d93cf20b0243f98`.
Both the API quest source and canonical common dependency are extracted from that
commit, not copied from the mutable current tree. Reproduce from repo root:

```sh
old=e767d1b12efed49d826badd32d93cf20b0243f98; root=$(mktemp -d)
mkdir -p "$root/sanguo/quest/v1" "$root/sanguo/common/v1"
git show "$old:internal/api/proto/sanguo/quest/v1/quest.proto" > "$root/sanguo/quest/v1/quest.proto"
git show "$old:spec/proto/sanguo/common/v1/types.proto" > "$root/sanguo/common/v1/types.proto"
fixtures=internal/api/pb/sanguo/quest/v1/testdata
protoc -I "$root" --include_imports --descriptor_set_out="$fixtures/claim_reward_legacy.pb" sanguo/quest/v1/quest.proto
protoc -I "$root" --encode=sanguo.quest.v1.ClaimQuestRewardResponse sanguo/quest/v1/quest.proto < "$fixtures/claim_reward_legacy.textproto" > "$fixtures/claim_reward_legacy.bin"
```

SHA-256 (descriptor and reply hashes are also enforced in both test runtimes):

| Input | SHA-256 |
|---|---|
| Old API quest.proto | `cb25fc56925ce9a41bdf17cc136c546b76e4d7d18d5e2f8e58e7a800dccc4173` |
| Old common types.proto | `746d03c49e6f43e1f7e87f2d9ac1df6c6434db2e6e0b55143644ad69726141d3` |
| claim_reward_legacy.pb | `0cfa3795de294ea732c0285f404f34e45672e39effa840533776b6ed25b867aa` |
| claim_reward_legacy.bin | `28b07ae5231f8261626188841061b51791ab0400c9a730bd6f8a8bbb18215d15` |
| claim_reward_legacy.textproto | `735eb39e04ddc155340b4b41a12970230cb9dfce22bf1e7deba9f6d9fb4b3699` |
