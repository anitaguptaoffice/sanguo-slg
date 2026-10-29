package march

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/recruittx"
	"github.com/jackc/pgx/v5"
)

// RecruitCandidate is a copied discovery identity, never authorization.
type RecruitCandidate struct {
	ServerID                  int32
	PlayerID, CityID, QueueID int64
}

// CompletionHint returns 0, 1 or 2 for one exact linked candidate without row locks or writes.
func (p *RecruitParticipant) CompletionHint(ctx context.Context, a *recruittx.Access, c RecruitCandidate) (int16, error) {
	x, err := p.recruitCandidateRead(ctx, a, c, "")
	if err != nil {
		return 0, err
	}
	if !recruitCandidateEvidence(p, x, c) {
		return 0, ErrRecruitUnavailable
	}
	return x.q.status, nil
}

// DoneHistory locks queue then receipt, revalidates one exact done candidate, and requires no ownership.
func (p *RecruitParticipant) DoneHistory(ctx context.Context, a *recruittx.Access, c RecruitCandidate) error {
	x, err := p.recruitCandidateRead(ctx, a, c, " FOR UPDATE OF q")
	if err != nil {
		return err
	}
	if !recruitCandidateIdentity(x.q, c) || x.q.status != 2 {
		return ErrRecruitUnavailable
	}
	if x, err = p.recruitCandidateRead(ctx, a, c, " FOR UPDATE OF r"); err != nil {
		return err
	}
	if !recruitCandidateEvidence(p, x, c) {
		return ErrRecruitUnavailable
	}
	return nil
}

func (p *RecruitParticipant) recruitCandidateRead(ctx context.Context, a *recruittx.Access, c RecruitCandidate, suffix string) (x recruitCandidateRow, err error) {
	if a == nil {
		return x, ErrRecruitUnavailable
	}
	access := *a
	s, err := p.recruitCandidateSource(ctx, &access, c)
	if err != nil {
		return x, err
	}
	err = recruitHistoryRead(ctx, &access, s, recruitCandidateSQL(s, suffix), []any{c.ServerID, c.QueueID}, x.dest()...)
	x.q.startAt, x.q.finishAt, x.r.acceptedAt, x.r.startAt, x.r.finishAt = x.q.startAt.UTC(), x.q.finishAt.UTC(), x.r.acceptedAt.UTC(), x.r.startAt.UTC(), x.r.finishAt.UTC()
	return x, err
}

func (p *RecruitParticipant) recruitCandidateSource(ctx context.Context, a *recruittx.Access, c RecruitCandidate) (*freshMilitarySource, error) {
	if p == nil || p.source == nil || p.source.binding == nil || p.catalog == nil || ctx == nil || a == nil || p.source.retired.Load() ||
		c.ServerID <= 0 || c.ServerID != p.source.profile.ServerID || c.PlayerID <= 0 || c.CityID <= 0 || c.QueueID < 1 || c.QueueID > 9007199254740991 {
		return nil, ErrRecruitUnavailable
	}
	s := p.source
	ids := []uint32{s.profile.Objects["mil_city_origin"].OID, s.profile.Objects["city_troop"].OID, s.profile.Objects["work_queue"].OID, s.profile.Objects["mil_recruit_origin"].OID, s.profile.Objects["mil_recruit_receipt"].OID}
	var pins int
	err := a.Scan(ctx, s.binding, `SELECT pg_catalog.count(*) FROM pg_catalog.unnest($1::pg_catalog.oid[]) e(oid) WHERE EXISTS(SELECT FROM pg_catalog.pg_locks l WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid() AND l.granted AND l.locktype OPERATOR(pg_catalog.=) 'relation' AND l.relation OPERATOR(pg_catalog.=) e.oid AND l.mode OPERATOR(pg_catalog.=) 'RowExclusiveLock')`, []any{ids}, &pins)
	if err != nil {
		return nil, errors.Join(ErrRecruitUnavailable, s.failure(err))
	}
	if pins != 5 {
		return nil, ErrRecruitUnavailable
	}
	if err = s.failure(validateRecruitSource(ctx, a, s)); err != nil {
		return nil, errors.Join(ErrRecruitUnavailable, err)
	}
	if s.retired.Load() {
		return nil, ErrRecruitUnavailable
	}
	return s, nil
}

type recruitCandidateRow struct {
	q         recruitHistoryQueue
	r         recruitHistoryReceipt
	playerID  int64
	operation int16
	command   []byte
}

func (x *recruitCandidateRow) dest() []any {
	return []any{&x.q.serverID, &x.q.queueID, &x.q.playerID, &x.q.cityID, &x.q.queueType, &x.q.payload, &x.q.startAt, &x.q.finishAt, &x.q.status, &x.playerID, &x.operation, &x.command, &x.r.serverID, &x.r.queueID, &x.r.intentVersion, &x.r.cityID, &x.r.unitCfgID, &x.r.count, &x.r.food, &x.r.wood, &x.r.iron, &x.r.stone, &x.r.durationSec, &x.r.catalogVersion, &x.r.ruleDigest, &x.r.acceptedAt, &x.r.startAt, &x.r.finishAt, &x.r.initialStatus}
}

func recruitCandidateIdentity(q recruitHistoryQueue, c RecruitCandidate) bool {
	return q.serverID == c.ServerID && q.queueID == c.QueueID && q.playerID == c.PlayerID && q.cityID != nil && *q.cityID == c.CityID && q.queueType == 3
}

func recruitCandidateCommand(b []byte) bool { return len(b) == 16 && !bytes.Equal(b, make([]byte, 16)) }

func recruitCandidateEvidence(p *RecruitParticipant, x recruitCandidateRow, c RecruitCandidate) bool {
	if !recruitCandidateIdentity(x.q, c) || x.q.status < 0 || x.q.status > 2 || x.playerID != c.PlayerID || x.operation != 1 ||
		!recruitCandidateCommand(x.command) || x.r.serverID != int64(c.ServerID) || x.r.queueID != c.QueueID ||
		x.r.cityID != c.CityID || x.r.intentVersion != 1 || (x.r.initialStatus != 0 && x.r.initialStatus != 1) {
		return false
	}
	payload, err := decodeRecruitPayload(x.q.payload, p.catalog)
	return err == nil && payload.Unit == x.r.unitCfgID && payload.Count == x.r.count && payload.Cost == (recruitPayloadCost{Food: x.r.food, Wood: x.r.wood, Iron: x.r.iron, Stone: x.r.stone}) && payload.Seconds == x.r.durationSec && payload.Catalog == string(x.r.catalogVersion) && payload.Digest == hex.EncodeToString(x.r.ruleDigest) && recruitHistoryEvolution(x.q, x.r)
}

func recruitCandidateSQL(s *freshMilitarySource, suffix string) string {
	table := func(name string) string { return pgx.Identifier{s.profile.SchemaName, name}.Sanitize() }
	return `SELECT q.*,o.player_id,o.operation,o.command_id,r.* FROM ` + table("work_queue") + ` q JOIN ` + table("mil_recruit_origin") + ` o ON o.server_id OPERATOR(pg_catalog.=) q.server_id AND o.queue_id OPERATOR(pg_catalog.=) q.queue_id JOIN ` + table("mil_recruit_receipt") + ` r ON r.server_id OPERATOR(pg_catalog.=) q.server_id AND r.queue_id OPERATOR(pg_catalog.=) q.queue_id WHERE q.server_id OPERATOR(pg_catalog.=) $1 AND q.queue_id OPERATOR(pg_catalog.=) $2` + suffix
}
