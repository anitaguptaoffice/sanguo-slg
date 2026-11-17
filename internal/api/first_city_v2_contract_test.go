package api

import (
	"crypto/sha256"
	"fmt"
	"testing"

	worldv1 "github.com/anitaguptaoffice/sanguo-slg/internal/api/pb/sanguo/world/v1"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
)

func TestFirstCityV2FileDescriptorFrozen(t *testing.T) {
	d := protodesc.ToFileDescriptorProto(worldv1.File_sanguo_world_v2_first_city_proto)
	wire, err := (proto.MarshalOptions{Deterministic: true}).Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	got := fmt.Sprintf("%x", sha256.Sum256(wire))
	const want = "c9caaf2a64abee149c767ec8441dd308b8405245ada29e7eda1cee0472376b96"
	if got != want {
		t.Fatalf("file descriptor changed: got %s", got)
	}
	sub := (&worldv1.SubmitFirstCityRequest{}).ProtoReflect().Descriptor()
	if sub.Fields().Len() != 2 || sub.Fields().Get(0).Name() != "expected_scope" {
		t.Fatal("submit request shape")
	}
}
