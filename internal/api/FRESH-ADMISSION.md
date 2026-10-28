# Fresh source admission (private mechanism)

This dormant mechanism tracks a single generation and its exact Binding pointer;
its constructor and counters do not validate a source, participants, enrollment,
external exclusions, or a PostgreSQL transaction. A later fixed APP coordinator
must own those validations and classify actual transaction endings before marking
work ended. Only confirmed commit, confirmed rollback, or failure before Begin
can resolve a lease; an uncertain ending must use `unknown`. The first completion
wins across copies, so callers must not optimistically call `ended` for uncertainty.

Close blocks new work but is not drain. Existing known work must finish; unknown
work permanently prevents drain and closes admission. Cancellation of acquisition
or a waiter is not transaction termination. There is no reopen or unknown-clear path.
A successful local drain is not evidence of external writer exclusion or server
termination beyond the coordinator's verified classifications. Deployment owners
must maintain exclusions and independently establish server resolution as required
by `spec/rules/FRESH_CITY_PARTICIPANTS.md` section 2. This code installs no live
caller and provides no production activation evidence.
