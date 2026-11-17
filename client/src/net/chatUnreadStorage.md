# CLIENT-CHAT-READ-STORAGE-001

Chat unread persistence is optional. The browser can throw while merely
acquiring localStorage, before getItem or setItem is called. Default store
resolution now catches that failure and uses the existing null-store path.
This prevents eager ChatUnreadTracker construction from crashing GameApp
before the server-selection screen can appear.

Explicit injected stores and explicit null remain unchanged. Existing
getItem/setItem guards still contain access and quota failures. Read marks,
monotonic timestamps, counts and notifications continue in memory. No global
storage is replaced, no permissions are requested, and nothing is deleted.
Without persistence, a later app instance may show previously read messages
as unread; this is not a server-side read cursor or delivery receipt.

Tests cover denied/missing default storage, injected/null storage, read/write
failures, malformed data and ordinary persistence. The actual GameApp,
MainCityScene constructor and ServerSelectScene run with controlled assets,
gateway and frame-platform seams. They reach an available server without
automatically submitting authentication or mutations.

The startup case denies only localStorage while sessionStorage remains
available. Other sessionStorage callers and wholly storage-disabled gameplay
are not covered. These are controlled application tests, not native browser
storage-policy acceptance. Run `npm test` and `npm run build` in `client/`.
