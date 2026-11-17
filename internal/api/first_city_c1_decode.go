package api

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
)

var errFirstCityC1Decode = errors.New("first-city canonical decode failed")

func firstCityUUIDString(raw []byte) (string, bool) {
	if len(raw) != 16 {
		return "", false
	}
	h := hex.EncodeToString(raw)
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[0:8], h[8:12], h[12:16], h[16:20], h[20:32]), true
}

// firstCityScopeAndProposalFromC1 inverts the SGFC encoder in first_city_canonical.go.
func firstCityScopeAndProposalFromC1(c1 []byte) (*worldv1.FirstCityScope, *worldv1.FirstCityProposal, error) {
	if len(c1) < 4 || string(c1[:4]) != "SGFC" {
		return nil, nil, errFirstCityC1Decode
	}
	off := 4
	if off+4 > len(c1) {
		return nil, nil, errFirstCityC1Decode
	}
	off += 4 // canonical_version, reserved width
	const opLen = len("world.first_city")
	if off+opLen+4+16+4+8+8+16+1 > len(c1) {
		return nil, nil, errFirstCityC1Decode
	}
	if string(c1[off:off+opLen]) != "world.first_city" {
		return nil, nil, errFirstCityC1Decode
	}
	off += opLen
	if binary.BigEndian.Uint32(c1[off:off+4]) != 2 {
		return nil, nil, errFirstCityC1Decode
	}
	off += 4
	realm, ok := firstCityUUIDString(c1[off : off+16])
	off += 16
	if !ok {
		return nil, nil, errFirstCityC1Decode
	}
	shard := int32(binary.BigEndian.Uint32(c1[off : off+4]))
	off += 4
	player := int64(binary.BigEndian.Uint64(c1[off : off+8]))
	off += 8
	account := int64(binary.BigEndian.Uint64(c1[off : off+8]))
	off += 8
	command, ok := firstCityUUIDString(c1[off : off+16])
	off += 16
	if !ok {
		return nil, nil, errFirstCityC1Decode
	}
	scope := &worldv1.FirstCityScope{RealmId: realm, ServerId: shard, PlayerId: player, AccountId: account}
	proposal := &worldv1.FirstCityProposal{CommandId: command, Predecessor: &worldv1.FirstCityPredecessor{}}
	switch c1[off] {
	case 0:
		proposal.Predecessor.Value = &worldv1.FirstCityPredecessor_Empty{Empty: &worldv1.FirstCityEmpty{}}
		off++
	case 1:
		off++
		if off+16 > len(c1) {
			return nil, nil, errFirstCityC1Decode
		}
		rej, ok := firstCityUUIDString(c1[off : off+16])
		off += 16
		if !ok {
			return nil, nil, errFirstCityC1Decode
		}
		proposal.Predecessor.Value = &worldv1.FirstCityPredecessor_RejectedCommandId{RejectedCommandId: rej}
	default:
		return nil, nil, errFirstCityC1Decode
	}
	if off+2 > len(c1) {
		return nil, nil, errFirstCityC1Decode
	}
	nameLen := int(binary.BigEndian.Uint16(c1[off : off+2]))
	off += 2
	if off+nameLen+4 > len(c1) {
		return nil, nil, errFirstCityC1Decode
	}
	name := string(c1[off : off+nameLen])
	off += nameLen
	x := int32(binary.BigEndian.Uint16(c1[off : off+2]))
	off += 2
	y := int32(binary.BigEndian.Uint16(c1[off : off+2]))
	off += 2
	if off != len(c1) {
		return nil, nil, errFirstCityC1Decode
	}
	proposal.Name = &name
	proposal.X = &x
	proposal.Y = &y
	return scope, proposal, nil
}
