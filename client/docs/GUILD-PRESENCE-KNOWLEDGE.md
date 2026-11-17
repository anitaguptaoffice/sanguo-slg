# Guild presence knowledge

CLIENT-GUILD-ONLINE-KNOWLEDGE-001, issue #2290. Baseline: 757e43a9f40d7c92ded6a536ec334de94d69ff6f.

The production GuildMember, GuildSummary and ListGuildMembersResponse schemas contain no presence fields. Absence is not offline. The header now says `在线未知 / 共 N 人`; each existing recursive duty segment says `本组在线 未知/N`. Role ordering, counts, expansion and RPCs are unchanged. No session-based presence inference is made.

A row count is known only when every row supplies an actual boolean flag. A whole-guild count additionally requires the member population to equal the reported total. An empty complete population is zero; an empty page with a positive total is unknown. Optional explicit online hints remain supported only for nonnegative integers no greater than the total. A valid zero is preserved. Invalid hints fall back to complete row evidence, not fabricated zero.

The regression uses production schema encode/decode and the actual mounted SocialPanels join/refresh path with a gateway double. It asserts the summary and all eight nested duty segments, partial flags, confirmed offline/online, empty/incomplete populations, invalid hints and unchanged role counts/expansion. On the original baseline, seven of eleven initial cases fail, including the actual mounted false-zero summary. These are protocol/component tests, not a live-server or native browser result.

Required before merge: independent final review, full client tests/build and required exact-head CI, plus native visual acceptance of unknown text on the actual guild panel. Verify readable summary and role residual text, both expanded/collapsed groups, refresh and panel reopen with real production guild responses. No native browser acceptance has yet been performed. Historical reference/art/VERIFY holds remain excluded; no production deployment.
