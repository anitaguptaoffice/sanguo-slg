# First-city rejection recovery

Issue #3075. A validated current rejection now explains terrain or coordinate occupancy and permits an explicit new placement. The new UUID names a new immutable command whose predecessor is the exact rejected head; the old command is never replayed or edited.

Unknown local submissions, incomplete/unavailable evidence, and pending or succeeded heads cannot authorize a new Submit. Historical rejected results may explain the old failure but cannot authorize replacing a newer head. Continue remains the existing pending-command path. No automatic new placement, backend/schema change or production acceptance is introduced.

Regression evidence includes a native PG17 rejection at70,70. Source tests cover both reasons, exact predecessor, retained intent bytes, unknown local successor, newer pending/successful heads and historical Get results. Native recovery and final full-client validation are recorded in the PR, not inferred from these unit tests.
