# Dormant Recruit V2 API bindings

Card [#2348](https://github.com/anitaguptaoffice/sanguo-slg/issues/2348)
adopts SPEC [#2340](https://github.com/anitaguptaoffice/sanguo-slg/pull/2340).
Base main: `34bfa7c6a56ed4c0c44598ffe98c871bf15da85c`.
Only the API mirror, complete generated military binding, contract tests and this
record change. No handler or route activates V2. TRANSPORT activation gates remain.

## Complete official generation

Diagnostic [#2343](https://github.com/anitaguptaoffice/sanguo-slg/pull/2343)
artifact `13623931068` supplied the unmodified `candidate/api-generated.pb.go`.
Official tools: Go 1.23.12, protoc 3.21.12, protoc-gen-go 1.36.5.
Generated SHA-256: `9f16771d8559fd008f91fa6b3fe1f862bb41a418b92294e01d24704578d51daa`.
Mirror SHA-256: `59ca5a7db044790abcaf042b848c6817b1c0e2d9571879f8b95c5537cf944e37`.
The mirror equals canonical military.proto except its preserved API go_package.
The artifact's complete SHA256SUMS was checked locally. Preserve artifact logs,
full baseline/candidate diff and source mapping with final delivery evidence.
Baseline generation differs from tracked output only in protoc version header
(3.13.0 to 3.21.12); no generated code was edited or descriptor mechanically split.
The one-time user size exception covers only this generated file (+431/-88).
All mirror, test and documentation changes together remain below 400 lines.

From the repository root, using those exact official tool versions:

```sh
protoc -I internal/api/proto -I spec/proto \
  --go_out=internal/api/pb --go_opt=paths=source_relative \
  --go_opt=Msanguo/common/v1/types.proto=github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1 \
  internal/api/proto/sanguo/military/v1/military.proto
# Compare the entire generated output byte-for-byte against the submitted file.
go test -count=1 ./internal/api/pb/sanguo/military/v1
go test -race -count=1 ./internal/api/pb/sanguo/military/v1
```

## Test contract and limits

`TestRecruitV2Descriptors` checks every added message's field names/numbers/types,
cardinality and presence, plus the response's acceptance type. Removing only the
three added messages from the full Go FileDescriptorProto must recover SHA-256
`bc439780937d510ea216be20b1d817228c84cd87b782c5ec7fda78df82b26d84`.
That hash comes from the complete baseline generated raw descriptor, preserving
all legacy messages/enums/options/imports, not a newly invented expected schema.
Other tests exercise real protobuf marshal/unmarshal, fixed request/receipt/legacy
bytes, every int64 field at signed and exact-JavaScript boundaries, full uint32
versions, int32/status boundaries, absent versus present-empty acceptance,
truncated frames, opaque bytes and retained unknown uint64 fields.
Go proto3 omits scalar zero on encoding; waiting status zero remains valid.

Codec acceptance is not semantic validation. Invalid IDs, unsupported versions,
negative amounts and malformed catalog/digest values remain representable.
A future application validator must enforce the adopted immutable-receipt rules.
No retry, legacy fallback, journal, shared controller or production activation is
provided here. Local Go/protoc are unavailable; local static/hash checks are not
runtime PASS. Independent exact-head review, official byte regeneration,
formatting/compile/ordinary/race tests, applicable full API regressions and all
required CI remain mandatory before coordinator-controlled merge.
