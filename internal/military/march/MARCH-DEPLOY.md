# Prepared march troop debit

`RecruitParticipant.DebitMarchTroops` consumes normalized, distinct unit
stacks from the owned prepared city. The caller authenticates the actor,
holds the account, wallet and WORLD barriers in order and pins the MIL
source on the same Access. The participant revalidates the source and
reads the complete marker, stock and pending Recruit evidence.

Only selected ready counts decrease. Wounded troops, queued recruits and
retained acceptance evidence stay intact. Stock or pending inconsistencies
make deployment unavailable. An otherwise valid request that exceeds the
ready counts returns insufficient troops before the first write.

The caller creates the order and army through `MarchStore.Create` on that
Access and rolls back every error. Returned counts are provisional until
the outer commit. This component does not publish a march or open a route.
