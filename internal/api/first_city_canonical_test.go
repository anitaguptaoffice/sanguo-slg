package api

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"go/format"
	"math"
	"os"
	"strings"
	"testing"
)

const firstCityRejected = "33333333-3333-4333-8333-333333333333"

func TestFirstCityCanonicalStandardFormat(t *testing.T) {
	for _, path := range []string{"first_city_canonical.go", "first_city_canonical_test.go"} {
		t.Run(path, func(t *testing.T) {
			source, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			formatted, err := format.Source(source)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(source, formatted) {
				t.Fatalf("source differs from Go standard formatting:\n%s", formatted)
			}
		})
	}
}

func firstCityPointer[T any](value T) *T { return &value }

func firstCityFixture() (firstCityActor, firstCityRequest) {
	return firstCityActor{"11111111-1111-4111-8111-111111111111", 1, 9007199254740993, math.MaxInt64}, firstCityRequest{
		command: "22222222-2222-4222-8222-222222222222", prior: &firstCityPrior{empty: true},
		name: firstCityPointer("城"), x: firstCityPointer(int64(0)), y: firstCityPointer(int64(499)),
	}
}

func requireFirstCity(t *testing.T, actor firstCityActor, request firstCityRequest) firstCityCanonical {
	t.Helper()
	result, err := newFirstCityCanonical(&actor, &actor, &request)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func TestFirstCityCanonicalGolden(t *testing.T) {
	// Independently reconstructed from the adopted contract using UUID octets and
	// Python struct big-endian packing, then frozen here as complete literal bytes.
	for _, test := range []struct{ prior, hex, hash string }{
		{"", "5347464300010010776f726c642e66697273745f6369747900000002111111111111411181111111111111110000000100200000000000017fffffffffffffff22222222222242228222222222222222000003e59f8e000001f3", "6c7a376e196f51fb6a36497597e0f8af759aabb03a3f84a5938e40210e9bb23f"},
		{firstCityRejected, "5347464300010010776f726c642e66697273745f6369747900000002111111111111411181111111111111110000000100200000000000017fffffffffffffff2222222222224222822222222222222201333333333333433383333333333333330003e59f8e000001f3", "eeb911e086843f3329083b5d473b40d5d2ea62ae97017afacf40850aec35117a"},
	} {
		t.Run(test.prior, func(t *testing.T) {
			actor, request := firstCityFixture()
			length := 90
			if test.prior != "" {
				request.prior = &firstCityPrior{rejected: &test.prior}
				length = 106
			}
			want, err := hex.DecodeString(test.hex)
			if err != nil {
				t.Fatal(err)
			}
			result := requireFirstCity(t, actor, request)
			if len(result.bytes()) != length || !bytes.Equal(result.bytes(), want) || fmt.Sprintf("%x", sha256.Sum256(want)) != test.hash {
				t.Fatalf("golden mismatch: %x", result.bytes())
			}
			if !result.matches(requireFirstCity(t, actor, request).bytes()) {
				t.Fatal("separate construction is not deterministic")
			}
			for i := range want {
				changed := result.bytes()
				changed[i] ^= 1
				if result.matches(changed) || result.matches(want[:i]) {
					t.Fatalf("ignored byte or truncation at %d", i)
				}
			}
			if result.matches(append(result.bytes(), 0)) || (firstCityCanonical{}).matches(nil) || (firstCityCanonical{}).matches([]byte{}) {
				t.Fatal("extension or invalid empty value accepted")
			}
		})
	}
}

func TestFirstCityCanonicalValidation(t *testing.T) {
	check := func(derived, expected *firstCityActor, request *firstCityRequest, want error) {
		t.Helper()
		result, err := newFirstCityCanonical(derived, expected, request)
		if err != want || len(result.bytes()) != 0 || result.matches(nil) {
			t.Fatalf("invalid input: error %v, want %v, bytes %x", err, want, result.bytes())
		}
	}
	actor, request := firstCityFixture()
	check(nil, &actor, &request, errFirstCityDerivedScope)
	check(&actor, nil, &request, errFirstCityInput)
	check(&actor, &actor, nil, errFirstCityInput)
	for _, edit := range []func(*firstCityActor){
		func(a *firstCityActor) { a.shard = 0 },
		func(a *firstCityActor) { a.shard = -1 },
		func(a *firstCityActor) { a.shard = 2147483648 },
		func(a *firstCityActor) { a.player = 0 },
		func(a *firstCityActor) { a.player = -1 },
		func(a *firstCityActor) { a.account = 0 },
		func(a *firstCityActor) { a.account = -1 },
	} {
		bad := actor
		edit(&bad)
		check(&bad, &actor, &request, errFirstCityDerivedScope)
		check(&actor, &bad, &request, errFirstCityInput)
	}
	for _, id := range []string{"", "00000000-0000-0000-0000-000000000000", strings.ToUpper("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
		actor.realm[:35], actor.realm + "0", " " + actor.realm, "{" + actor.realm + "}", "urn:uuid:" + actor.realm,
		strings.Replace(actor.realm, "-4", "-3", 1), strings.Replace(actor.realm, "-8", "-7", 1), strings.Replace(actor.realm, "-8", "-c", 1),
		strings.Replace(actor.realm, "-", "_", 1), "g" + actor.realm[1:], "é" + actor.realm[2:],
	} {
		bad := actor
		bad.realm = id
		check(&bad, &actor, &request, errFirstCityDerivedScope)
		check(&actor, &bad, &request, errFirstCityInput)
		_, proposal := firstCityFixture()
		proposal.command = id
		check(&actor, &actor, &proposal, errFirstCityInput)
		proposal = request
		proposal.prior = &firstCityPrior{rejected: &id}
		check(&actor, &actor, &proposal, errFirstCityInput)
	}
	for name, edit := range map[string]func(*firstCityRequest){
		"missing prior": func(p *firstCityRequest) { p.prior = nil },
		"neither arm":   func(p *firstCityRequest) { p.prior = &firstCityPrior{} },
		"both arms":     func(p *firstCityRequest) { p.prior.rejected = firstCityPointer(firstCityRejected) },
		"same command":  func(p *firstCityRequest) { p.prior = &firstCityPrior{rejected: &p.command} },
		"missing name":  func(p *firstCityRequest) { p.name = nil },
		"missing x":     func(p *firstCityRequest) { p.x = nil },
		"missing y":     func(p *firstCityRequest) { p.y = nil },
		"negative x":    func(p *firstCityRequest) { *p.x = -1 },
		"negative y":    func(p *firstCityRequest) { *p.y = -1 },
		"large x":       func(p *firstCityRequest) { *p.x = 500 },
		"large y":       func(p *firstCityRequest) { *p.y = 500 },
	} {
		t.Run(name, func(t *testing.T) {
			_, proposal := firstCityFixture()
			edit(&proposal)
			check(&actor, &actor, &proposal, errFirstCityInput)
		})
	}
	for _, name := range []string{"", "a\x00b", "\xff", "\xc0\xaf", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xe5\x9f", strings.Repeat("a", 33), strings.Repeat("😀", 32) + "a"} {
		request.name = &name
		check(&actor, &actor, &request, errFirstCityInput)
	}
	if errFirstCityInput.Error() != "first-city input invalid" || errFirstCityDerivedScope.Error() != "first-city derived scope unavailable" || errFirstCityExpectation.Error() != "first-city scope expectation mismatch" {
		t.Fatal("unsafe or unstable error categories")
	}
}

func TestFirstCityCanonicalContentAndOwnership(t *testing.T) {
	actor, request := firstCityFixture()
	original := requireFirstCity(t, actor, request)
	for _, edit := range []func(*firstCityActor){
		func(a *firstCityActor) { a.realm = firstCityRejected },
		func(a *firstCityActor) { a.shard++ },
		func(a *firstCityActor) { a.player++ },
		func(a *firstCityActor) { a.account-- },
	} {
		changed := actor
		edit(&changed)
		if _, err := newFirstCityCanonical(&actor, &changed, &request); err != errFirstCityExpectation {
			t.Fatal("scope mismatch not rejected", err)
		}
		if original.matches(requireFirstCity(t, changed, request).bytes()) {
			t.Fatal("scope content not compared")
		}
	}
	for _, edit := range []func(*firstCityRequest){
		func(p *firstCityRequest) { p.command = firstCityRejected },
		func(p *firstCityRequest) { p.prior = &firstCityPrior{rejected: firstCityPointer(firstCityRejected)} },
		func(p *firstCityRequest) { *p.name = "城 " },
		func(p *firstCityRequest) { *p.x = 1 },
		func(p *firstCityRequest) { *p.y = 498 },
	} {
		_, changed := firstCityFixture()
		edit(&changed)
		if original.matches(requireFirstCity(t, actor, changed).bytes()) {
			t.Fatal("proposal content not compared")
		}
	}
	request.prior = &firstCityPrior{rejected: firstCityPointer(firstCityRejected)}
	result := requireFirstCity(t, actor, request)
	retained := result.bytes()
	*request.prior.rejected = actor.realm
	if result.matches(requireFirstCity(t, actor, request).bytes()) {
		t.Fatal("rejected identity not compared")
	}
	actor.realm, actor.shard, actor.player, actor.account = "", 0, 0, 0
	request.command, *request.name, *request.x, *request.y = "", "changed", 100, 100
	request.prior.empty = true
	copyOut := result.bytes()
	copyOut[0] ^= 1
	if !result.matches(retained) || !bytes.Equal(result.bytes(), retained) {
		t.Fatal("caller mutation changed immutable content")
	}
	retained[1] ^= 1
	if result.matches(retained) {
		t.Fatal("retained byte mutation ignored")
	}
}

func TestFirstCityCanonicalBoundaries(t *testing.T) {
	actor, request := firstCityFixture()
	for _, id := range []int64{1, 1<<53 - 1, 1 << 53, 1<<53 + 1, math.MaxInt64} {
		actor.player, actor.account, actor.shard = id, id, math.MaxInt32
		encoded := requireFirstCity(t, actor, request).bytes()
		if binary.BigEndian.Uint64(encoded[48:56]) != uint64(id) || binary.BigEndian.Uint64(encoded[56:64]) != uint64(id) || binary.BigEndian.Uint32(encoded[44:48]) != math.MaxInt32 {
			t.Fatal("identity precision or shard bound lost")
		}
	}
	for _, variant := range []string{"8", "9", "a", "b"} {
		actor.realm = "aaaaaaaa-aaaa-4aaa-" + variant + "aaa-aaaaaaaaaaaa"
		requireFirstCity(t, actor, request)
	}
	seen := map[string]bool{}
	request.prior = &firstCityPrior{rejected: firstCityPointer(firstCityRejected)}
	for _, name := range []string{"A", "a", " ", " 城 ", "é", "e\u0301", "\ufffd", "😀", strings.Repeat("a", 32), strings.Repeat("😀", 32)} {
		request.name = &name
		encoded := requireFirstCity(t, actor, request).bytes()
		if string(encoded[99:len(encoded)-4]) != name || int(binary.BigEndian.Uint16(encoded[97:99])) != len(name) || len(encoded) != 103+len(name) || seen[string(encoded)] {
			t.Fatal("name normalized, defaulted, aliased or wrong length")
		}
		seen[string(encoded)] = true
	}
	if len(requireFirstCity(t, actor, request).bytes()) != 231 {
		t.Fatal("maximum encoding is not 231 bytes")
	}
	for _, x := range []int64{0, 499} {
		for _, y := range []int64{0, 499} {
			request.x, request.y = &x, &y
			encoded := requireFirstCity(t, actor, request).bytes()
			if binary.BigEndian.Uint16(encoded[len(encoded)-4:]) != uint16(x) || binary.BigEndian.Uint16(encoded[len(encoded)-2:]) != uint16(y) {
				t.Fatal("explicit coordinate changed")
			}
		}
	}
}
