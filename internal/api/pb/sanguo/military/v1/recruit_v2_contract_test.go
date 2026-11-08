package militaryv1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestRecruitV2Descriptors(t *testing.T) {
	cases := []struct {
		message proto.Message
		names   string
		kinds   []protoreflect.Kind
	}{
		{&RecruitTroopV2Request{}, "city_id unit_cfg_id count command_id intent_version", []protoreflect.Kind{protoreflect.Int64Kind, protoreflect.Int32Kind, protoreflect.Int32Kind, protoreflect.BytesKind, protoreflect.Uint32Kind}},
		{&RecruitTroopV2Response{}, "acceptance", []protoreflect.Kind{protoreflect.MessageKind}},
		{&RecruitAcceptance{}, "queue_id city_id unit_cfg_id count food_paid wood_paid iron_paid stone_paid duration_sec initial_status accepted_at_ms initial_start_at_ms initial_finish_at_ms catalog_version rule_digest", []protoreflect.Kind{
			protoreflect.Int64Kind, protoreflect.Int64Kind, protoreflect.Int32Kind, protoreflect.Int32Kind,
			protoreflect.Int64Kind, protoreflect.Int64Kind, protoreflect.Int64Kind, protoreflect.Int64Kind,
			protoreflect.Int64Kind, protoreflect.Int32Kind, protoreflect.Int64Kind, protoreflect.Int64Kind,
			protoreflect.Int64Kind, protoreflect.BytesKind, protoreflect.BytesKind,
		}},
	}
	for _, tc := range cases {
		d := tc.message.ProtoReflect().Descriptor()
		t.Run(string(d.Name()), func(t *testing.T) {
			names := strings.Fields(tc.names)
			if d.Fields().Len() != len(names) || d.Oneofs().Len() != 0 {
				t.Fatalf("unexpected fields or oneofs: %v", d)
			}
			for i, name := range names {
				f := d.Fields().Get(i)
				if string(f.Name()) != name || f.Number() != protoreflect.FieldNumber(i+1) || f.Kind() != tc.kinds[i] || f.Cardinality() != protoreflect.Optional || f.IsPacked() || f.HasPresence() != (f.Kind() == protoreflect.MessageKind) {
					t.Errorf("field %d differs: %v", i+1, f)
				}
			}
		})
	}
	f := (&RecruitTroopV2Response{}).ProtoReflect().Descriptor().Fields().ByNumber(1)
	if f.Message().FullName() != "sanguo.military.v1.RecruitAcceptance" {
		t.Fatal("acceptance has the wrong message type")
	}
	// Hash the complete legacy FileDescriptorProto, retaining all old messages,
	// enums, field options, imports, package, syntax and go_package.
	d := protodesc.ToFileDescriptorProto(File_sanguo_military_v1_military_proto)
	legacy := d.MessageType[:0]
	for _, m := range d.MessageType {
		switch m.GetName() {
		case "RecruitTroopV2Request", "RecruitTroopV2Response", "RecruitAcceptance":
		default:
			legacy = append(legacy, m)
		}
	}
	d.MessageType = legacy
	wire, err := (proto.MarshalOptions{Deterministic: true}).Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprintf("%x", sha256.Sum256(wire)); got != "bc439780937d510ea216be20b1d817228c84cd87b782c5ec7fda78df82b26d84" {
		t.Fatalf("legacy descriptor changed: %s", got)
	}
}

func recruitV2RoundTrip(t *testing.T, in proto.Message) proto.Message {
	t.Helper()
	wire, err := proto.Marshal(in)
	if err != nil {
		t.Fatal(err)
	}
	out := in.ProtoReflect().Type().New().Interface()
	if err := proto.Unmarshal(wire, out); err != nil || !proto.Equal(in, out) {
		t.Fatalf("roundtrip differs: %v; %v", out, err)
	}
	return out
}

func TestRecruitV2ExactIntegerBoundaries(t *testing.T) {
	for _, value := range []int64{-1 << 63, -62135596800000, 0, 253402300799999, 9007199254740993, 1<<63 - 1} {
		recruitV2RoundTrip(t, &RecruitTroopV2Request{CityId: value})
		a := &RecruitAcceptance{}
		fields := a.ProtoReflect().Descriptor().Fields()
		for i := 0; i < fields.Len(); i++ {
			f := fields.Get(i)
			if f.Kind() == protoreflect.Int64Kind {
				a.ProtoReflect().Set(f, protoreflect.ValueOfInt64(value))
			}
		}
		recruitV2RoundTrip(t, a)
	}
	for _, version := range []uint32{0, 1, 2, 32768, 65537, 1<<32 - 1} {
		recruitV2RoundTrip(t, &RecruitTroopV2Request{IntentVersion: version})
	}
	for _, value := range []int32{-1 << 31, 0, 1, 1<<31 - 1} {
		recruitV2RoundTrip(t, &RecruitTroopV2Request{UnitCfgId: value, Count: value})
		recruitV2RoundTrip(t, &RecruitAcceptance{UnitCfgId: value, Count: value, InitialStatus: value})
	}
	// These codec values include semantically invalid inputs. This binding is
	// lossless representation, not authorization or application validation.
}

func TestRecruitV2WireAndPresence(t *testing.T) {
	key := make([]byte, 16)
	for i := range key {
		key[i] = byte(i)
	}
	cases := []struct {
		message proto.Message
		hex     string
	}{
		{&RecruitTroopV2Request{CityId: 1, UnitCfgId: 2, Count: 3, CommandId: key, IntentVersion: 1}, "0801100218032210000102030405060708090a0b0c0d0e0f2801"},
		{&RecruitTroopRequest{CityId: 1, UnitCfgId: 2, Count: 3}, "080110021803"},
		{&RecruitTroopResponse{QueueId: 1, FinishAtMs: 2}, "18012002"},
		{&RecruitTroopV2Response{}, ""},
		{&RecruitTroopV2Response{Acceptance: &RecruitAcceptance{}}, "0a00"},
	}
	for _, tc := range cases {
		wire, err := proto.Marshal(tc.message)
		if err != nil || hex.EncodeToString(wire) != tc.hex {
			t.Fatalf("wire %T = %x, %v; want %s", tc.message, wire, err, tc.hex)
		}
		recruitV2RoundTrip(t, tc.message)
	}
	a := &RecruitAcceptance{QueueId: 1, CityId: 2, UnitCfgId: 3, Count: 4,
		FoodPaid: 5, WoodPaid: 6, IronPaid: 7, StonePaid: 8, DurationSec: 9,
		InitialStatus: 0, AcceptedAtMs: 11, InitialStartAtMs: 12, InitialFinishAtMs: 13,
		CatalogVersion: []byte("recruit-v1:" + strings.Repeat("a", 64)), RuleDigest: bytes.Repeat([]byte{0xbb}, 32)}
	// Go proto3 omits scalar zero, unlike an explicitly written 50 00 field.
	body := "080110021803200428053006380740084809580b600c680d724b" + hex.EncodeToString(a.CatalogVersion) + "7a20" + strings.Repeat("bb", 32)
	wire, err := proto.Marshal(&RecruitTroopV2Response{Acceptance: a})
	if err != nil || hex.EncodeToString(wire) != "0a8701"+body {
		t.Fatalf("acceptance golden differs: %x, %v", wire, err)
	}
	recruitV2RoundTrip(t, &RecruitTroopV2Response{Acceptance: a})
	var response RecruitTroopV2Response
	if err := proto.Unmarshal(nil, &response); err != nil || response.Acceptance != nil {
		t.Fatal("absent acceptance changed")
	}
	if err := proto.Unmarshal([]byte{0x0a, 0}, &response); err != nil || response.Acceptance == nil || response.Acceptance.InitialStatus != 0 {
		t.Fatal("present-empty acceptance or valid zero status was lost")
	}
	for _, bad := range [][]byte{{0x0a, 2}, {0x0a, 1, 0x80}} {
		if err := proto.Unmarshal(bad, &response); err == nil {
			t.Fatalf("accepted truncated frame %x", bad)
		}
	}
	if err := proto.Unmarshal([]byte{0x22, 16, 0}, &RecruitTroopV2Request{}); err == nil {
		t.Fatal("accepted truncated command ID")
	}
}

func TestRecruitV2UnknownFieldsAndOpaqueBytes(t *testing.T) {
	unknown := protowire.AppendTag(nil, 100, protowire.VarintType)
	unknown = protowire.AppendVarint(unknown, 1<<64-1)
	for _, message := range []proto.Message{&RecruitTroopV2Request{}, &RecruitTroopV2Response{Acceptance: &RecruitAcceptance{}}, &RecruitAcceptance{}} {
		message.ProtoReflect().SetUnknown(unknown)
		out := recruitV2RoundTrip(t, message)
		if !bytes.Equal(out.ProtoReflect().GetUnknown(), unknown) {
			t.Fatal("unknown field lost")
		}
	}
	for _, key := range [][]byte{nil, make([]byte, 16), {0xff}, bytes.Repeat([]byte{1}, 15)} {
		recruitV2RoundTrip(t, &RecruitTroopV2Request{CommandId: key})
		recruitV2RoundTrip(t, &RecruitAcceptance{CatalogVersion: key, RuleDigest: key})
	}
}
