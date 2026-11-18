# Durable ready garrison

`RecruitParticipant.ReadReadyGarrison` reads a fresh-cohort city's marker and
complete stock in one PostgreSQL snapshot after checking the bound source and
existing military pins. Counts are ordered by unit ID 1 through 4. A valid
all-zero city differs from unavailable evidence. Wounded counts are validated
and excluded from ready stock.

Application callers still own current WORLD authorization, transaction ending,
and compatible writer fences. The read acquires no row locks and performs no
mutation, completion, or Hub publication. Its result reflects the caller's
transaction and cannot stand in for a commit receipt.
