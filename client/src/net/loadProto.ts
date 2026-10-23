import protobuf from "protobufjs";

let root: protobuf.Root | null = null;

/** 从仓库 spec/proto 加载契约（只读，与 Cocos 工程后续共用生成流程）。 */
export function getProtoRoot(): protobuf.Root {
  if (root) return root;
  const modules = import.meta.glob(
    "../../../spec/proto/sanguo/**/*.proto",
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;
  root = new protobuf.Root();
  for (const src of Object.values(modules)) {
    protobuf.parse(src, root, { keepCase: true });
  }
  root.resolveAll();
  return root;
}

export type ProtoTypes = {
  ClientPacket: protobuf.Type;
  ServerPacket: protobuf.Type;
  LoginRequest: protobuf.Type;
  LoginResponse: protobuf.Type;
};

export function getTypes(): ProtoTypes {
  const r = getProtoRoot();
  return {
    ClientPacket: r.lookupType("sanguo.common.v1.ClientPacket"),
    ServerPacket: r.lookupType("sanguo.common.v1.ServerPacket"),
    LoginRequest: r.lookupType("sanguo.account.v1.LoginRequest"),
    LoginResponse: r.lookupType("sanguo.account.v1.LoginResponse"),
  };
}
