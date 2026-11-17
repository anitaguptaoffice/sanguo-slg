# 生成说明

从 `spec/proto` 生成账号域 protobuf（勿手改 `*.pb.go`）：

```bash
protoc -I spec/proto \
  --go_out=internal/account/pb --go_opt=paths=source_relative \
  --go_opt=Msanguo/common/v1/types.proto=github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1 \
  spec/proto/sanguo/common/v1/types.proto \
  spec/proto/sanguo/account/v1/account.proto
```

## Authenticated account identity (ACCOUNT-AUTH-IDENTITY-BINDINGS-001)

Use Go 1.23.12, protoc 3.21.12 and protoc-gen-go v1.36.5. The command above
uses canonical schemas and the existing common-package mapping; never create
an account.proto mirror or edit generated Go. `account_id` is field 6 only.
See `spec/proto/AUTH-ACCOUNT-IDENTITY.md` for the authenticated producer contract.
Generated int64 representation does not validate positivity or authenticate a
session. Missing/zero remains identity unavailable; this binding does not enable
V2 or make the current production handler emit identity.

Before adopting a generated artifact, regenerate the pre-SPEC canonical schema
at 722d56bf10a5edc555873c0e4dac7a9545c9c60b with the exact tools and command above.
Require whole-file byte equality to that commit's account and common bindings.
Generate the adopted schema separately, retain tool versions, source SHAs and
artifact hashes, and require common/types.pb.go to remain byte-identical.
Include the complete account.pb.go difference in the card's 400-line budget.

Run actual generated-package tests in both modes, without skips:

```bash
go test ./internal/account/pb/sanguo/account/v1 -count=1
go test -race ./internal/account/pb/sanguo/account/v1 -count=1
```

The six `TestAccountIdentity*` tests pin the baseline descriptor, all five legacy
fields, wire fixtures, signed64 boundaries, legacy/unknown-field roundtrips,
zero/default handling and malformed input. Existing full ACCOUNT PostgreSQL
ordinary/race regressions remain separate and mandatory. Local unavailable
Go/protoc is not a test PASS; official generation and CI must supply evidence.

Adopted generation evidence: [run 42521659695](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42521659695),
artifact 13633736707, canonical candidate 33575215f9f66e9d535db40840e918afe5a2bcba.
The complete generated account file SHA256 is
`6a880bce646e3607f656dfc22696fed0b7f1f62ef14d334cf02fa3cd62098c05`.
The independently audited run proves baseline/common equality and compilation;
it does not substitute for the new contract tests or PostgreSQL acceptance.
