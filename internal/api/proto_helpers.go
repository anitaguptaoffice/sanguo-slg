package api

import (
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"google.golang.org/protobuf/proto"
)

func unmarshal(b []byte, msg proto.Message) error {
	return proto.Unmarshal(b, msg)
}

func marshal(msg proto.Message) ([]byte, error) {
	return proto.Marshal(msg)
}

func okResp(trace string, data []byte) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: 0, TraceId: trace, Data: data}
}

func errResp(trace string, code commonv1.ErrorCode, msg string) *commonv1.ServerPacket {
	return &commonv1.ServerPacket{Code: int32(code), Msg: msg, TraceId: trace}
}
