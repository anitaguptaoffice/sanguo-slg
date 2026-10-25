# API-WIRE-REPAIR-001 — GetCityState wire mirror

Mirrors merged contract #1753 (`spec/proto/GARRISON-READ.md`). Fields 1–3 are
unchanged; field 4 has message presence. Nil is unknown, non-nil empty is an
empty ready set. ReadyTroopCount deliberately has no wounded/queue fields.
This card does not populate the handler or provide military persistence.

Generation uses official protoc-gen-go v1.36.5 (go.mod version), protoc 3.13.0:

```sh
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.5
protoc -I internal/api/proto -I spec/proto --go_out=internal/api/pb \
  --go_opt=paths=source_relative \
  --go_opt=Msanguo/common/v1/types.proto=github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1 \
  sanguo/domestic/v1/extra.proto
go test -race ./internal/api/pb/sanguo/domestic/v1
go test -short ./internal/api/...
```

Legacy testdata/get_city_state_legacy.pb is a protoc descriptor set generated
without imports from the actual API extra.proto at baseline 1c5a0912, not a
handmade old schema. Reproduce with `git show 1c5a0912:internal/api/proto/sanguo/domestic/v1/extra.proto`
in a separate include root, then `protoc -I <legacy-root> -I spec/proto
--descriptor_set_out=<fixture> sanguo/domestic/v1/extra.proto`.
Tests load that legacy descriptor, check unchanged fields, legacy decode of new
bytes, exact empty-presence bytes and ready/int32-limit round trips.
