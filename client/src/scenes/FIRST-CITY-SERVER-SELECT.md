# ServerSelect dormant V2 first-city probe

CLIENT-FIRST-CITY-ENTRY-001 ([#2539](https://github.com/anitaguptaoffice/sanguo-slg/issues/2539)) adds an explicit
**Discover** button after a no-city existing-account login on local/dev gateways only (`permitsFirstCityV2Probe`).
It runs `FirstCityController.discover` via `runFirstCityDiscoverProbe` and shows retained-knowledge status text.
The probe is allowed only on loopback `ws://` without credentials in the URL; `wss:` and remote `ws:` hide the UI.
No v1 `createCity`, no automatic Submit/Continue, no `mainCity` navigation, and no claim of production backend activation.
Registration and demo entry behavior are unchanged.
