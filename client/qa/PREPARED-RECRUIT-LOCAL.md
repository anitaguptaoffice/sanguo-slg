# Prepared recruit in the local game

Use the separately owned loopback Go runtime configured in
[Local prepared first city](../../internal/platform/runtime/FIRST-CITY-PREPARED-LOCAL.md).
Set `VITE_PREPARED_RECRUIT=1` and point `VITE_GATEWAY_WS_URL` to its local
`/ws` when starting the client. Use one browser origin for this owned
database and keep both across restarts. The opted-in browser requires the
prepared WebSocket acknowledgement before login.

Run the [local recovery guard](../scripts/RECRUIT-RECOVERY-GUARD.md) and pass
its exact `VITE_PREPARED_RECRUIT_GUARD_URL` and `VITE_PREPARED_RECRUIT_GUARD_ID`
to the client. An interrupted reservation holds the next send until the
independent local owner reconciles the original attempt. A grant permits
only that command, and the game still requires the explicit retry action.

In the military panel, choose a unit and quantity and select 募兵. The
server checks the effective costs. If the result is unknown after an
interruption, reenter the same account and server and select 重试上次募兵.
This recovers the persisted command independently of the current form.
Once accepted, the game refreshes the wallet and ready garrison via
GetCityState. Historical acceptance is shown as 募兵已受理. Completion is
observed from a later stock read.

Local acceptance uses a Chromium persistent profile, a real Go process,
owned PostgreSQL 17 and Redis, and the existing first-city path. Observe
the debit and pending job independently of the browser. Withhold a
committed reply, close both processes, reenter with the same profile, and
verify identical request bytes and one committed debit/receipt. Advance
only the fixture's owned schedule and verify one credit in PostgreSQL
and the military UI. The military and queue panels read the current pending
jobs from the same city-state path. They distinguish waiting, training, empty
and unavailable. Verify that the promoted job shows the new live finish and
that reopening the game restores the pending set or committed ready stock.
An elapsed finish does not remove a job from either panel.

Restart the guard as well. An unapproved retry must
send zero requests, including after contradictory browser evidence and
failure of both quarantine writes. See #3115 for the exact runs.
