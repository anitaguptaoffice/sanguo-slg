# Retained Recruit manifest candidates

DATA-RECRUIT-MANIFEST-001 / #1844. Format: [rule evidence contract](../../rules/MIL_RECRUIT_RULE_EVIDENCE.md).
This directory is append-only release-source history, not an automatic runtime
configuration path or authority to activate durable Recruit. No existing seed,
unit, price, duration, DATA-003 or paid SKU is changed by this artifact.

The initial file is:
`recruit-v1-eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f.json`.
Its version field uses `recruit-v1:` (colon); the portable filename uses a hyphen.
Raw file SHA-256: `90499740432ff308e3b7a6f2bd9f54ff5af127d98acc091a4c13af18fc561262`.
Canonical version: `recruit-v1:eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f`.

Values reproduce only the four-unit recruit fields of
[DefaultUnitCatalog at the recorded source commit](https://github.com/anitaguptaoffice/sanguo-slg/blob/11dd9ee9ae645faa0e744638ca4d9faeb3949d7e/internal/military/march/units.go).
Generated cfg_unit SQL has no recruit-cost/time columns. This is not a claim that
an arbitrary running instance uses those defaults; current selection must be
explicit and source-reviewed. The accepted typed registry has no default fallback.

Offline verification from repository root:

```sh
python3 tools/data/validate_recruit_manifest.py spec/data/recruit_manifests/recruit-v1-eba0b17092787c8e796ce47af01d956e74885f8dd71d45b76a25d333447b728f.json
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/data -p test_validate_recruit_manifest.py
```

The tool rejects original duplicate keys before normalization, wrong shape/types,
non-integral number tokens, invalid bounds/order/version, trailing data and invalid
UTF-8. It also verifies filename/version agreement and never writes or repairs input.
The 64 KiB input bound is an offline resource limit, not a gameplay/queue limit.
A successful checksum check proves integrity only, not release approval or provenance.

Keep every version referenced by retained jobs/receipts/origins, even after selecting
a newer current version. Never overwrite or delete an old version to force repricing.
Back up the reviewed artifact inventory coherently with identity/data/fence evidence;
missing or untrusted history makes recovery unavailable, not a guessed replacement.
No runtime file reader, raw-JSON Go decoder, database mutation, role/permission
change, through-commit certificate or production deployment is implemented here.
A future loader must use fixed reviewed release inputs, not client/job JSON or an
arbitrary path/URL, and must independently establish source trust before activation.
