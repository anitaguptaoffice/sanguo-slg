# ART-ITEM-PRODUCTION-DELIVERY-001

Registration: https://github.com/anitaguptaoffice/sanguo-slg/issues/2477
Contract review: https://github.com/anitaguptaoffice/sanguo-slg/pull/2479

This independently scoped delivery adds 49 original item icons, IDs 2001–2049,
and 98 unchanged 64/128 RGBA PNGs. It does not merge the candidate PR or any
historical held content. No reference artwork, gameplay values or UI code changes.

Source: #1968 commit 91f3080ac50cc1abb961dac9f50e99c9266a2b6e,
docs/art/samples/art-item-icons-001/textures/{1x,2x}/items/.
Its INVENTORY.csv retains original-master and output SHA256 values.
All output bytes match both that immutable commit and its per-file SHA256 list.
Both resolutions originate independently from the same high-resolution master.
Metadata preserves the source 64px display size and 32/32 center anchor.
The existing maincity manifest receives 49 icon entries; all 139 earlier entries
and top-level metadata remain structurally unchanged. No schema change is needed.

Validation performed on this delivery: 49 SQL ID/code mappings; 98 exact output
hashes and source Git blobs; RGBA 64/128 dimensions; alpha padding >=4/8px;
full Draft2020-12 manifest schema and variant file existence. All passed.
Runtime names remain owned by client data; source art labels are not UI replacements.

Remaining gates: independent final source/visual review, contract acceptance,
applicable CI, and separate CLIENT full-host integration/acceptance. Existing
#2089 component/mock screenshots are not complete-host evidence for this tree.
The loader is optional for item.icon.<number>.v1; this delivery alone does not
mount bag icons on main. #1973 remains separate and held until its gates pass.
No production deployment or gameplay acceptance is claimed.

Rollback: remove only these 49 manifest entries to restore absent optional
resources. Do not change required assets or item behavior. PNG cleanup can follow
in an independently reviewed change; no destructive cleanup is required here.
