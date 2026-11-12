package api

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
)

func TestFirstCityV2DiscoverSubmitDescriptors(t *testing.T) {
	cases := []struct {
		message proto.Message
		names   string
		kinds   []protoreflect.Kind
	}{
		{&worldv1.DiscoverFirstCityIntentRequest{}, "", nil},
		{&worldv1.DiscoverFirstCityIntentResponse{}, "scope head", []protoreflect.Kind{protoreflect.MessageKind, protoreflect.MessageKind}},
		{&worldv1.SubmitFirstCityRequest{}, "expected_scope proposal", []protoreflect.Kind{protoreflect.MessageKind, protoreflect.MessageKind}},
		{&worldv1.FirstCityScope{}, "realm_id server_id player_id account_id", []protoreflect.Kind{
			protoreflect.StringKind, protoreflect.Int32Kind, protoreflect.Int64Kind, protoreflect.Int64Kind,
		}},
	}
	for _, tc := range cases {
		d := tc.message.ProtoReflect().Descriptor()
		t.Run(string(d.Name()), func(t *testing.T) {
			names := strings.Fields(tc.names)
			if d.Fields().Len() != len(names) {
				t.Fatalf("field count: got %d want %d", d.Fields().Len(), len(names))
			}
			for i, name := range names {
				f := d.Fields().Get(i)
				if string(f.Name()) != name || f.Number() != protoreflect.FieldNumber(i+1) || f.Kind() != tc.kinds[i] {
					t.Fatalf("field %d: %+v", i+1, f)
				}
			}
		})
	}
}

func TestFirstCityV2FileDescriptorFrozen(t *testing.T) {
	d := protodesc.ToFileDescriptorProto(worldv1.File_sanguo_world_v1_first_city_v2_proto)
	wire, err := (proto.MarshalOptions{Deterministic: true}).Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	got := fmt.Sprintf("%x", sha256.Sum256(wire))
	const want = "ab8ff225a7f751856f1e07c76f51ddcea0484ef17740394c03f01a8628878bc4"
	if got != want {
		t.Fatalf("file descriptor changed: got %s", got)
	}
}

func TestFirstCityV2DiscoverSubmitWire(t *testing.T) {
	scope := &worldv1.FirstCityScope{
		RealmId: testFirstCityRealm, ServerId: 1, PlayerId: 9, AccountId: 8,
	}
	disc := &worldv1.DiscoverFirstCityIntentResponse{
		Scope: scope,
		Head:  &worldv1.FirstCityHead{Value: &worldv1.FirstCityHead_Empty{Empty: &worldv1.FirstCityEmpty{}}},
	}
	wire, err := proto.Marshal(disc)
	if err != nil {
		t.Fatal(err)
	}
	var back worldv1.DiscoverFirstCityIntentResponse
	if err := proto.Unmarshal(wire, &back); err != nil {
		t.Fatalf("discover roundtrip unmarshal: %v", err)
	}
	if !proto.Equal(disc, &back) {
		t.Fatal("discover roundtrip: proto.Equal false")
	}
}
