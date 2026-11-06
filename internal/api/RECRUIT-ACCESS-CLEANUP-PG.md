# API-RECRUIT-ACCESS-CLEANUP-PG-001

Task [#2160](https://github.com/anitaguptaoffice/sanguo-slg/issues/2160) is now
copied-Access evidence only. Combined panic is separately registered under
[#2162](https://github.com/anitaguptaoffice/sanguo-slg/issues/2162).
Base b1d6d1c5916ff8df3ab45b0c343bd77afda3c00a,
tree c3de322a2b029bdc0b5b32fcdc4020387baf5dab; source d4ec3d7, basic b7f2e69.
Tests-first c5eb6d8fcdfd367b4cf71b68c18273f19b5d811e is static, not behavioral red.
Substitution checkpoint 96c3172c43aefd9c5fc7aa3f86e320a2f35ac4f8 is also unexecuted.
Combined checkpoint f84bb41 and rejected candidate 493069ad remain immutable
history. Independent review blocked their backend identity/Close-entry assertions;
the unpublished combined-panic file is removed here, not represented as approved.

Required official Go/PG17 ordinary AND race cases, zero unintended skips/failures:
- TestPGRecruitBundleCopiedAccessLifetime/commit
- TestPGRecruitBundleCopiedAccessLifetime/rollback
- TestPGRecruitBundleRejectsAccessSubstitution/foreign_binding
- TestPGRecruitBundleRejectsAccessSubstitution/zero_access

The actual initializer supplies all four concrete participants. Separate real owners
from its captured Binding exercise by-value Access copies after caller-wrapper
replacement. Every concrete Pin revalidates metadata; direct Scan also checks active
and ended access. Commit/Rollback close all retained copies with zero later SQL;
ErrInactive OR context.Canceled is valid. A fresh owner proves participants were not
retired and old transaction identity/lifetime cannot reopen. This proves bundle/owner
composition, NOT interception of initialize's private validation Access or admission.
Independent relation-lock probes and all-row/xmin/ctid plus explicit allocator
last_value/log_cnt/is_called snapshots verify release and unchanged fixture state.

Substitution cases use the original caller Binding around the same actual pool as
an independently begun foreign owner, or a non-nil zero Access beside a live owner.
Each concrete participant must return exactly ErrBinding under healthy bounded ctx,
with zero additional SQL. A direct metadata Scan also fails without changing output.
The actual owner remains usable under its proper Binding, then confirms one bounded
Rollback. Independent snapshots/lock probes exclude effects; a fresh correct owner
proves the four participants were not retired. No pool or private Owner state is
exposed, and no production interface or fake participant is added.

No Go compiler/gofmt, PostgreSQL, race or CI ran in this executor. Exact final combined
independent review, official Go/PG17 execution, full applicable packages and required
head/main CI remain gates. Wire lost-ack evidence is not added here.
#2162 double panic, shared enrollment, real business coordination,
V2 wire/journal, interoperability and deployment remain separate gates.
