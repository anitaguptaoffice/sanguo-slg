package api

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	errFirstCityDerivedScope = errors.New("first-city derived scope unavailable")
	errFirstCityInput        = errors.New("first-city input invalid")
	errFirstCityExpectation  = errors.New("first-city scope expectation mismatch")
	firstCityUUIDPattern     = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)

// These private domain inputs do not decode protobuf or establish authority.
type firstCityActor struct {
	realm                  string
	shard, player, account int64
}

type firstCityPrior struct {
	empty    bool
	rejected *string
}

type firstCityRequest struct {
	command string
	prior   *firstCityPrior
	name    *string
	x, y    *int64
}

// A string owns the immutable, injective C1 encoding; no caller slice is retained.
type firstCityCanonical struct{ content string }

func (c firstCityCanonical) bytes() []byte { return []byte(c.content) }

func (c firstCityCanonical) matches(retained []byte) bool {
	return c.content != "" && c.content == string(retained)
}

func firstCityUUID(value string) ([]byte, bool) {
	if len(value) != 36 || !firstCityUUIDPattern.MatchString(value) {
		return nil, false
	}
	decoded, err := hex.DecodeString(strings.ReplaceAll(value, "-", ""))
	return decoded, err == nil
}

func validFirstCityActor(actor *firstCityActor) bool {
	if actor == nil || actor.shard <= 0 || actor.shard > 2147483647 || actor.player <= 0 || actor.account <= 0 {
		return false
	}
	_, valid := firstCityUUID(actor.realm)
	return valid
}

// newFirstCityCanonical validates representation, not authentication. The caller
// must independently obtain and revalidate derived scope before any later use.
func newFirstCityCanonical(derived, expected *firstCityActor, request *firstCityRequest) (firstCityCanonical, error) {
	if !validFirstCityActor(derived) {
		return firstCityCanonical{}, errFirstCityDerivedScope
	}
	if !validFirstCityActor(expected) {
		return firstCityCanonical{}, errFirstCityInput
	}
	if *derived != *expected {
		return firstCityCanonical{}, errFirstCityExpectation
	}
	if request == nil || request.prior == nil || request.name == nil || request.x == nil || request.y == nil {
		return firstCityCanonical{}, errFirstCityInput
	}
	command, valid := firstCityUUID(request.command)
	if !valid || request.prior.empty == (request.prior.rejected != nil) {
		return firstCityCanonical{}, errFirstCityInput
	}
	var predecessor []byte
	if request.prior.rejected != nil {
		predecessor, valid = firstCityUUID(*request.prior.rejected)
		if !valid || *request.prior.rejected == request.command {
			return firstCityCanonical{}, errFirstCityInput
		}
	}
	name, x, y := *request.name, *request.x, *request.y
	if len(name) == 0 || len(name) > 128 || !utf8.ValidString(name) || utf8.RuneCountInString(name) > 32 || strings.ContainsRune(name, 0) {
		return firstCityCanonical{}, errFirstCityInput
	}
	if x < 0 || x > 499 || y < 0 || y > 499 {
		return firstCityCanonical{}, errFirstCityInput
	}
	realm, _ := firstCityUUID(derived.realm)
	encoded := make([]byte, 0, 231)
	encoded = append(encoded, "SGFC"...)
	encoded = binary.BigEndian.AppendUint16(encoded, 1)
	encoded = binary.BigEndian.AppendUint16(encoded, 16)
	encoded = append(encoded, "world.first_city"...)
	encoded = binary.BigEndian.AppendUint32(encoded, 2)
	encoded = append(encoded, realm...)
	encoded = binary.BigEndian.AppendUint32(encoded, uint32(derived.shard))
	encoded = binary.BigEndian.AppendUint64(encoded, uint64(derived.player))
	encoded = binary.BigEndian.AppendUint64(encoded, uint64(derived.account))
	encoded = append(encoded, command...)
	if request.prior.empty {
		encoded = append(encoded, 0)
	} else {
		encoded = append(encoded, 1)
		encoded = append(encoded, predecessor...)
	}
	encoded = binary.BigEndian.AppendUint16(encoded, uint16(len(name)))
	encoded = append(encoded, name...)
	encoded = binary.BigEndian.AppendUint16(encoded, uint16(x))
	encoded = binary.BigEndian.AppendUint16(encoded, uint16(y))
	return firstCityCanonical{content: string(encoded)}, nil
}
