# Native Recruit journal acceptance

The journal is the offline prepare, inspect and close component for #2382.
It uses the authenticated identity accessor, strict IndexedDB transactions,
fresh readback, and local digest validation. A recovered pending command is
reported as unknown. The caller must explicitly resolve or retry it through
the future network coordinator. Installing this module does not activate a
route or enroll a storage profile.

Run locally from the client directory with owned sandboxed Chromium:

    CHROMIUM_PATH=/usr/lib/chromium/chromium RECRUIT_JOURNAL_EVIDENCE=/tmp/recruit-journal-evidence node scripts/recruitJournal.native.mjs

The script boots an isolated loopback Vite fixture and a new Chromium process
with a disposable disk profile. It tracks outbound requests beyond known
module loads and page WebSockets. It records each case, build and file hashes,
profile and filesystem, browser arguments, storage persistence state, and
owned process exit status. No persistence permission is requested. The script
deletes only its temporary profile after the run.

Fault cases exercise the real IndexedDB/WebCrypto primitives, with named
method hooks for deterministic faults and a Chromium quota override. Concurrent
tabs race the same predecessor. Process tests terminate only the owned browser
and reopen the same disk profile before inspecting durable state. The fixture
supplies synthetic live identities to the adapter. Authentication, network
dispatch, acknowledgement loss, result persistence, and production storage
enrollment are separate integration work.
