# API-MARCH-RETURNED binding

The reviewed canonical contract adds numeric `MARCH_PHASE_RETURNED=5`. Values0–4,
summary field numbers, history and pagination remain unchanged. Binding generation
alone does not activate emission; the MIL transition, explicit API mapping and
client consumers must be reviewed and accepted together before deployment.

The copied proto preserves the API-owned `go_package`. The common types import is
mapped to the existing account binding. Regenerate; do not hand-edit generated Go:

```sh
protoc -I internal/api/proto -I spec/proto \
  --go_out=internal/api/pb --go_opt=paths=source_relative \
  --go_opt=Msanguo/common/v1/types.proto=github.com/anitaguptaoffice/sanguo-slg/internal/account/pb/sanguo/common/v1 \
  internal/api/proto/sanguo/military/v1/military.proto
```

Generation used installed protoc3.13.0 and protoc-gen-go1.36.5. Regenerating the
unchanged baseline first reproduced the existing file byte-for-byte except its
compiler-version header (formerly3.21.12); the new header truthfully records3.13.0.
The contract and binding tests preserve numeric5 and unknown127 on field9 and
produce an actual Go ListMarches wire fixture for production-H5 decoder checks.

This does not establish new-phase natural return acceptance, military persistence,
or atomic/durable hero release. Old retained phase1 rows remain ambiguous and are
not rewritten or inferred complete from timestamps.
