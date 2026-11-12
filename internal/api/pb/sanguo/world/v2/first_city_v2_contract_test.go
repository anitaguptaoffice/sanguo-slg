package worldv2

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"

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
		{&DiscoverFirstCityIntentRequest{}, "", nil},
		{&DiscoverFirstCityIntentResponse{}, "scope head", []protoreflect.Kind{protoreflect.MessageKind, protoreflect.MessageKind}},
		{&SubmitFirstCityRequest{}, "expected_scope proposal", []protoreflect.Kind{protoreflect.MessageKind, protoreflect.MessageKind}},
		{&SubmitFirstCityResponse{}, "outcome", []protoreflect.Kind{protoreflect.MessageKind}},
		{&FirstCityScope{}, "realm_id server_id player_id account_id", []protoreflect.Kind{
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
	head := (&FirstCityHead{}).ProtoReflect().Descriptor()
	if head.Oneofs().Len() != 1 || head.Oneofs().Get(0).Fields().Len() != 2 {
		t.Fatal("FirstCityHead oneof")
	}
}

func TestFirstCityV2FileDescriptorFrozen(t *testing.T) {
	d := protodesc.ToFileDescriptorProto(File_sanguo_world_v2_first_city_proto)
	wire, err := (proto.MarshalOptions{Deterministic: true}).Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	got := fmt.Sprintf("%x", sha256.Sum256(wire))
	const want = "c3e575c1c9a00ec7ca0c562275c1f8c2ec7216230c3440d223229273285d9cc5"
	if got != want {
		t.Fatalf("file descriptor changed: got %s", got)
	}
}

func TestFirstCityV2DiscoverSubmitWire(t *testing.T) {
	scope := &FirstCityScope{
		RealmId:   "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		ServerId:  1,
		PlayerId:  9,
		AccountId: 8,
	}
	disc := &DiscoverFirstCityIntentResponse{
		Scope: scope,
		Head:  &FirstCityHead{Value: &FirstCityHead_Empty{Empty: &FirstCityEmpty{}}},
	}
	wire, err := proto.Marshal(disc)
	if err != nil {
		t.Fatal(err)
	}
	var back DiscoverFirstCityIntentResponse
	if err := proto.Unmarshal(wire, &back); err != nil || !proto.Equal(disc, &back) {
		t.Fatalf("discover roundtrip: %v %v", err, back)
	}
	name, x, y := "都城", int32(0), int32(0)
	sub := &SubmitFirstCityRequest{
		ExpectedScope: scope,
		Proposal: &FirstCityProposal{
			CommandId:  "11111111-1111-4111-8111-111111111111",
			Predecessor: &FirstCityPredecessor{Value: &FirstCityPredecessor_Empty{Empty: &FirstCityEmpty{}}},
			Name:       &name,
			X:          &x,
			Y:          &y,
		},
	}
	wire, err = proto.Marshal(sub)
	if err != nil {
		t.Fatal(err)
	}
	if len(wire) == 0 {
		t.Fatal("empty submit wire")
	}
}
