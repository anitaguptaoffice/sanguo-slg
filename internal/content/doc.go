// Package content provides items, quests, shop, and live-ops features.
//
// Bag and item definitions are driven by seed JSON (see seed/catalog.json),
// aligned with spec/data/source/items.yml via SPEC-004.
//
// Reward grants use the JSON schema in spec/rules/content.md (Service.Grant,
// ParseRewardJSON, ProcessGrant for reward_grant_queue sync consumption).
package content
