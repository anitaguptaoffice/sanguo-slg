package api

import (
	"bytes"
	"context"
	"errors"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
)

func firstCityCanonicalMessage(scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal) (*worldv1.FirstCityCanonical, error) {
	if scope == nil || proposal == nil {
		return nil, errors.New("input")
	}
	return &worldv1.FirstCityCanonical{
		Scope: scope, Operation: "world.first_city", OperationVersion: 2, CanonicalVersion: 1,
		Proposal: proposal,
	}, nil
}

func firstCityC1FromProto(c *worldv1.FirstCityCanonical) ([]byte, error) {
	derived, ok := actorFromFirstCityScope(c.GetScope())
	if !ok {
		return nil, errFirstCityDerivedScope
	}
	req, ok := requestFromProposal(c.GetProposal())
	if !ok {
		return nil, errFirstCityInput
	}
	out, err := newFirstCityCanonical(derived, derived, req)
	if err != nil {
		return nil, err
	}
	return out.bytes(), nil
}

func firstCityCanonicalBytesEqual(a, b *worldv1.FirstCityCanonical) bool {
	ab, err := firstCityC1FromProto(a)
	if err != nil {
		return false
	}
	bb, err := firstCityC1FromProto(b)
	if err != nil {
		return false
	}
	return bytes.Equal(ab, bb)
}

func (s *Server) attemptFirstCitySubmit(ctx context.Context, scope *worldv1.FirstCityScope, proposal *worldv1.FirstCityProposal, domainReq *firstCityRequest, derived, expected *firstCityActor) (*worldv1.FirstCityOutcome, error) {
	c1, err := newFirstCityCanonical(derived, expected, domainReq)
	if err != nil {
		return nil, err
	}
	id := proposal.GetCommandId()
	if existing, ok, err := s.firstCityV2Ledger.Record(scope, id); err != nil {
		return nil, err
	} else if ok {
		existingC1, err := firstCityC1FromProto(existing.GetCanonical())
		if err != nil {
			return nil, err
		}
		if !bytes.Equal(c1.bytes(), existingC1) {
			head, _ := s.firstCityV2Ledger.Head(scope)
			return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_ID_CONTENT_CONFLICT, id, existing, head), nil
		}
		head, err := s.firstCityV2Ledger.Head(scope)
		if err != nil {
			return nil, err
		}
		return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND, id, existing, head), nil
	}
	tpl, err := s.firstCityV2Intake.SelectTemplate(ctx, scope)
	if err != nil {
		return nil, err
	}
	canon, err := firstCityCanonicalMessage(scope, proposal)
	if err != nil {
		return nil, err
	}
	record := &worldv1.FirstCityRecord{
		Canonical: canon, Template: tpl,
		State: &worldv1.FirstCityRecord_Pending{Pending: &worldv1.FirstCityEmpty{}},
	}
	if err := s.firstCityV2Ledger.IntakePending(ctx, scope, record); err != nil {
		if errors.Is(err, errFirstCityHeadConflict) {
			head, _ := s.firstCityV2Ledger.Head(scope)
			return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_HEAD_CONFLICT, id, nil, head), nil
		}
		return nil, err
	}
	head, err := s.firstCityV2Ledger.Head(scope)
	if err != nil {
		return nil, err
	}
	stored, ok, err := s.firstCityV2Ledger.Record(scope, id)
	if err != nil || !ok {
		return nil, errors.New("intake")
	}
	return s.firstCityOutcome(scope, worldv1.FirstCityOutcomeKind_FIRST_CITY_OUTCOME_COMMAND, id, stored, head), nil
}

func (s *Server) firstCityOutcome(scope *worldv1.FirstCityScope, kind worldv1.FirstCityOutcomeKind, requested string, cmd *worldv1.FirstCityRecord, head *worldv1.FirstCityHead) *worldv1.FirstCityOutcome {
	return &worldv1.FirstCityOutcome{
		Scope: scope, Kind: kind, RequestedCommandId: requested, Command: cmd, Head: head,
	}
}
