# Explicit account registration

The server selection form has two distinct actions: submit logs in; the separate registration button sends one Register request. Legacy demo entry is labeled separately. Registration requires encrypted transport except for local development, clears the password before awaiting the request and never authenticates, logs in, or creates a city.

A valid receipt confirms account creation only. Errors, malformed receipts, dismissal, leaving, connection loss and identity changes retain an unknown result: the account may exist. One registration attempt is permitted per scene instance, including reentry. No automatic retry or credential persistence occurs. A page reload permits another deliberate action; it is not an outcome check or safe automatic retry.

After registration, the user must reenter their password and explicitly log in. The existing server login wrapper can create a player; existing-mode bootstrap never creates a city. Empty city lists remain an honest unavailable-first-city state. Full new-player playable entry is not complete; city recovery research and historical holds remain unchanged.

Mounted regression tests cover the product boundary. Native registration, PostgreSQL corroboration, both viewport layouts and final independent review are separate mandatory release gates, not replaced by these tests.
