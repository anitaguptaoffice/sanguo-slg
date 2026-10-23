import protobuf from "protobufjs";

let root: protobuf.Root | null = null;

function parseProtosInto(r: protobuf.Root, modules: Record<string, string>): void {
  for (const src of Object.values(modules)) {
    protobuf.parse(src, r, { keepCase: true });
  }
}

/** 从 spec/proto 与 client/proto 加载契约（只读 spec；M1 扩展消息在 client/proto）。 */
export function getProtoRoot(): protobuf.Root {
  if (root) return root;
  const specModules = import.meta.glob(
    "../../../spec/proto/sanguo/**/*.proto",
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;
  root = new protobuf.Root();
  parseProtosInto(root, specModules);
  // CONTRACT-001 后 Register/建城/内政等已收编进 spec；client/proto 保留副本供对照，避免重复 parse。
  root.resolveAll();
  return root;
}

export const Routes = {
  Register: "account.v1.Register",
  Login: "account.v1.Login",
  CreateCity: "world.v1.CreateCity",
  ListPlayerCities: "world.v1.ListPlayerCities",
  GetCityState: "domestic.v1.GetCityState",
  StartBuildingUpgrade: "domestic.v1.StartBuildingUpgrade",
  RecruitTroop: "military.v1.RecruitTroop",
  StartMarch: "military.v1.StartMarch",
  ListBattleReports: "military.v1.ListBattleReports",
  GetBattleReport: "military.v1.GetBattleReport",
} as const;

export const ErrorCode = {
  ACCOUNT_LOGIN_FAILED: 20001,
  ACCOUNT_NO_PLAYER: 20005,
} as const;

export type ProtoTypes = {
  ClientPacket: protobuf.Type;
  ServerPacket: protobuf.Type;
  RegisterRequest: protobuf.Type;
  RegisterResponse: protobuf.Type;
  LoginRequest: protobuf.Type;
  LoginResponse: protobuf.Type;
  CreateCityRequest: protobuf.Type;
  CreateCityResponse: protobuf.Type;
  ListPlayerCitiesRequest: protobuf.Type;
  ListPlayerCitiesResponse: protobuf.Type;
  GetCityStateRequest: protobuf.Type;
  GetCityStateResponse: protobuf.Type;
  StartBuildingUpgradeRequest: protobuf.Type;
  StartBuildingUpgradeResponse: protobuf.Type;
  RecruitTroopRequest: protobuf.Type;
  RecruitTroopResponse: protobuf.Type;
  StartMarchRequest: protobuf.Type;
  StartMarchResponse: protobuf.Type;
  ListBattleReportsRequest: protobuf.Type;
  ListBattleReportsResponse: protobuf.Type;
  GetBattleReportRequest: protobuf.Type;
  GetBattleReportResponse: protobuf.Type;
};

export function getTypes(): ProtoTypes {
  const r = getProtoRoot();
  return {
    ClientPacket: r.lookupType("sanguo.common.v1.ClientPacket"),
    ServerPacket: r.lookupType("sanguo.common.v1.ServerPacket"),
    RegisterRequest: r.lookupType("sanguo.account.v1.RegisterRequest"),
    RegisterResponse: r.lookupType("sanguo.account.v1.RegisterResponse"),
    LoginRequest: r.lookupType("sanguo.account.v1.LoginRequest"),
    LoginResponse: r.lookupType("sanguo.account.v1.LoginResponse"),
    CreateCityRequest: r.lookupType("sanguo.world.v1.CreateCityRequest"),
    CreateCityResponse: r.lookupType("sanguo.world.v1.CreateCityResponse"),
    ListPlayerCitiesRequest: r.lookupType("sanguo.world.v1.ListPlayerCitiesRequest"),
    ListPlayerCitiesResponse: r.lookupType("sanguo.world.v1.ListPlayerCitiesResponse"),
    GetCityStateRequest: r.lookupType("sanguo.domestic.v1.GetCityStateRequest"),
    GetCityStateResponse: r.lookupType("sanguo.domestic.v1.GetCityStateResponse"),
    StartBuildingUpgradeRequest: r.lookupType("sanguo.domestic.v1.StartBuildingUpgradeRequest"),
    StartBuildingUpgradeResponse: r.lookupType("sanguo.domestic.v1.StartBuildingUpgradeResponse"),
    RecruitTroopRequest: r.lookupType("sanguo.military.v1.RecruitTroopRequest"),
    RecruitTroopResponse: r.lookupType("sanguo.military.v1.RecruitTroopResponse"),
    StartMarchRequest: r.lookupType("sanguo.military.v1.StartMarchRequest"),
    StartMarchResponse: r.lookupType("sanguo.military.v1.StartMarchResponse"),
    ListBattleReportsRequest: r.lookupType("sanguo.military.v1.ListBattleReportsRequest"),
    ListBattleReportsResponse: r.lookupType("sanguo.military.v1.ListBattleReportsResponse"),
    GetBattleReportRequest: r.lookupType("sanguo.military.v1.GetBattleReportRequest"),
    GetBattleReportResponse: r.lookupType("sanguo.military.v1.GetBattleReportResponse"),
  };
}
