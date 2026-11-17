# City-chief mutation recovery

CLIENT-CITY-CHIEF-RECOVERY-001, issue #2041. Client-only repair; no server or protocol changes.

SetCityChief and ClearCityChief errors do not prove vacancy or rollback. The server can reject a busy replacement before changing the incumbent, or fail partway through multiple writes. Helpers now return no chief snapshot on failure. The current scene performs one existing read-only GetCityChief to recover authority, including a genuine hero_id zero. It never replays the mutation or labels a failed request successful merely because the read returns its desired state.

If recovery also fails, the panel retains the last-known chief, labels the line as pending verification, and disables both mutations. With no prior snapshot it shows unknown rather than vacancy. Reopening the hall uses the existing read-only refresh path; successful refresh clears uncertainty. There is no automatic loop or new RPC. Already dispatched commands cannot be canceled, and a read is a point-in-time observation, not proof that an uncertain in-flight server operation cannot settle later.

A context captures actor/session, city, panel identity and scene generation. Superseded context objects are irrevocably invalid, including city A → B → A transitions. Mutation submission invalidates older refreshes; same-context mutations and refreshes are blocked until its response/recovery settles. Actor/city/scene changes reject old responses and prevent dispatching recovery under a new actor. Read failures retain uncertainty, and only the latest read may change phase or state.

Validation uses actual scene methods and mounted panel DOM: failed replacement and clear, old/new/zero authoritative reads, failed recovery/read-only retry, mutation serialization, refresh ordering, actor/city/relogin/scene invalidation, and successful original behavior. On base, the focused reproduction has 3 failures and 2 controls passing; after repair all 39 focused tests and build pass. Full suite, independent review, exact-head CI and temporary held #2000 combination are recorded in PR evidence. Mounted DOM is not native browser/live-server acceptance; no deployment or hold release is claimed.

Independent review found a superseded-context resurrection edge case; two reproductions were added before fixing ownership identity. Both now pass.
