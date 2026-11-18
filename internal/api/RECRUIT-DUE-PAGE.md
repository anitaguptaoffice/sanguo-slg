# Durable recruit due page

`completeDuePage` is a private worker component. It samples the bound PostgreSQL
clock, reads at most the requested number of active due jobs, and ends the read
transaction before calling the existing single-job completion transaction.
Its count reports confirmed credits, including any committed before a later
candidate failed. It does not publish stock or enqueue another pass.

Generation closure or request cancellation withholds scanned candidates.
Unconfirmed transaction cleanup keeps admission closed and counts as undrained.
The component has no runtime scheduler or route registration.

The PG17 tests advance only owned fixture schedules and use explicit
transaction hooks for closure, cancellation, and backend termination.
