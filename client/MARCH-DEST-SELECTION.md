# Destination deep-link visibility

CLIENT-MARCH-DEST-VISIBLE-001, issue #2053. Client-only military-list selection repair.

World city A selection activates a world destination filter. Clicking city B's inbound-march count then selects a B march without changing the world selection. Previously the military panel opened with B selected internally while the old A filter hid its row. An incompatible phase chip could also hide the selected march.

For a matching destination deep link, only incompatible filters are reconciled: a different destination (or unavailable world grid) becomes an explicit manual target, and an excluding phase becomes All. ETA sorting and compatible filters remain unchanged. World selection itself is not modified. A missing or invalid target remains a no-op. Subsequent manual filter choices are respected; an authoritative refresh can change the phase or remove the march, and no row is fabricated. This does not make a previously compatible phase filter permanently follow the selection across future phase transitions.

Mounted tests cover production WorldPanels count-button dispatch, world/manual filters, phase chips and sorting, matching filters, no target, transitions after reconciliation and authoritative disappearance. Full client tests/build, independent review, exact-head CI and main verification are required. No protocol/backend/command changes, native/live acceptance, deployment or hold release are claimed.
