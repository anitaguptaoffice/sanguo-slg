# CLT-RENDERER-LIFECYCLE-002 — Detached overlay guard

Follow-on review hardening for CLT-RENDERER-LIFECYCLE-001. Detach now releases the
layer reference as well as its keyed tags/anchors. A late asynchronous sync is a
no-op instead of rebuilding tags into a detached layer; reattach starts cleanly.
A focused regression observes the removed layer, invokes a late sync, checks zero
child mutations, then verifies a new layer can display the current building level.
This lifecycle edge is not attributed as the cause of prior renderer RSS growth.
