# CLIENT-REPORT-NARRATIVE

Bounded closure after CLIENT-REPORT-READABILITY: native
`33-native-report1-losses-visible.png` shows dark narrative ink on the dark detail
surface. Art-off/missing art also leaves title, description and filter labels dark.
Only those labels and `.report-detail > pre` are changed; report text/data, table
rules, gameplay, other panels and scroll hosts are untouched.

Labels use brown ink only with `data-report-paper-skin`, recomputed by the report
skin wrapper from an actually installed filled border image. Art-off or unavailable
image/metadata without an existing fill use ivory over an explicit opaque dark
surface. Retained fills remain paper even if art is subsequently requested off;
removed/restored fill is covered. Narrative is always ivory-on-dark, 14px/1.5,
wrapping without changing its text. Title remains 15px; labels are 14px.

Run focused/full client tests with `--maxWorkers=2`, then build. Run serially
`QA_OUT=/tmp/report-narrative node qa/reportNarrativeReadability.browser.mjs`.
`QA_BASELINE=1` records metrics without requiring repaired label/narrative contrast.
The fixture uses the unchanged recorded real report, production component/layout/
CSS and art at1280/1600 with on/off/missing-image/missing-metadata; it verifies
>=4.5 contrast, effective font, no horizontal overflow, unchanged table/highlight,
scroll reachability and reopen text. This is not live backend acceptance.
