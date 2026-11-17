// Package world owns maps, cities, wilderness tiles, and pathfinding.
// Maps are 500×500 tiles loaded in ChunkSize chunks via Loader (not full-grid resident).
// The dormant RecruitCityLocker.LockReturnOrigin companion returns owner-checked
// coordinates from one source-validated, shard-qualified FOR UPDATE row read.
// Coordinates include zero and exclude MapSize. It writes nothing and does not
// own transaction end. ReturnOrigin is copied data, never authorization; source
// enrollment, prior actor/wallet locks and the fixed APP call graph remain external.
package world
