# Actual Recruit admission and replay evidence

Card: #2167 / API-RECRUIT-ATTEMPT-PG-001. Calls #2163's actual dormant `admit`; no production hook or fake coordinator.
Frozen composition: `b8e8c592001bf4b0b0eb3967d5c8cceb50a442ea`, tree `5328f95a9658f20e8a863055e3015b3e29492092`; normal merge of approved admission `495a7dd` with source/owner evidence `9bf5fc7`.
Tests-first: `dad1d023de287dbbea057625699fbba8f64e3516`; unexecuted, not a behavioral-red claim. Missing helper symbols are not behavioral evidence.
The #2157 bootstrap seeds the exact cohort marker, four legal stock rows and an unrelated type1 job. Fixture-only sequence reservation starts at 100. Test prices use distinct nonzero four-field costs and independently computed canonical manifest/rule hashes, never request authority.
Independent observer verifies the exact debit with gold preserved, one new job/origin/receipt, immutable acceptance, legal times and one allocation. Whole relation/allocator snapshots preserve all unrelated state and all replay state, including xmin/ctid and sequence log_cnt.
Frozen SQL bytes plus exact transaction/pin/business ordering require one same-backend READ COMMITTED Begin/Commit; replay cannot debit, allocate, insert, or lock current city/stock. Current-owner and missing-readiness interventions are isolated fixture changes, not supported production writers.
Official gate: owned PostgreSQL 17 plus host psql and DATABASE_URL; `go test ./internal/api -run '^(TestPGRecruitAttemptAdmissionAndReplay|TestRecruitAttemptPGSQLClassification)$' -count=1 -v`, repeated with `-race`, then all applicable packages and required exact-head CI. A database skip is not acceptance.
Local Go/PG execution remains unperformed; no runtimes installed. Final independent source/combination review, exhaustive conflict/failure/serialization/lifetime/network evidence and actual Recruit/Return interoperability remain separate gates.
No startup/routes, shared source-controller certification, caller journal, completion, production enrollment or deployment; #77/#82/#108 holds remain excluded.
