# Server entry safety

Task CLIENT-SERVER-ENTRY-SAFETY-001 / #2011. Existing list/enter controls only.

- A selected server must be present in the latest list, have a positive integer ID and known available status (1 flowing / 2 busy). Maintenance (0), stopped (3), unknown and invalid rows cannot submit. Keep valid choice across refresh; otherwise choose the first available row or none.
- A list failure clears unverified rows and disables entry, rather than inventing S1. Refresh remains retryable. No pagination or new login/account configuration.
- List requests and entry are single-flight, with actions frozen while busy. Enter captures the selected ID once and calls the existing bootstrap unchanged. A failure permits explicit retry; no automatic replay.
- Leaving invalidates connect/list/entry presentation and scene transitions. An already started bootstrap cannot be canceled and may still perform its existing server commands. Its lock survives re-entry until it settles; stale completion must not switch scenes or display errors on the new mount.

Regression tests drive actual scene DOM events and mock the existing bootstrap boundary. Four red-first cases reproduced invalid default selection, disappeared selection submission, fictitious S1 after error and duplicate bootstrap. Coverage includes retries, unavailable-only lists, selection preservation, connect/list/entry leave-and-reenter, and original Esc/focus behavior. These are executable client integration tests, not live login or browser acceptance. No authentication, backend, protocol, deployment or historical HOLD behavior is changed.
