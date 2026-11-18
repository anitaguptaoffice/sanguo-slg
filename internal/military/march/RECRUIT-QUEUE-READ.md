# Prepared current Recruit queue projection

The application holds the authenticated WORLD city row and MIL pins for the
transaction. `ReadCurrentRecruitQueue` reuses the complete pending query,
catalog, FIFO/capacity and retained origin/receipt validation. It returns
at most 64 copied pending jobs and reports whether there are more. The
projection bound has no effect on admission or completion.

The live status and finish come from `work_queue`. A due active job remains
active until committed completion, and a promoted job exposes its actual
finish in the next read. No command keys, paid costs or immutable receipt
estimates are published. The application still owns rollback and
unavailable-versus-empty publication. The projection writes no data and
allocates no identifiers.
