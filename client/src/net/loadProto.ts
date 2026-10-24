import protobuf from "protobufjs";

let root: protobuf.Root | null = null;

function parseProtosInto(r: protobuf.Root, modules: Record<string, string>): void {
  for (const src of Object.values(modules)) {
    protobuf.parse(src, r, { keepCase: true });
  }
}

/** 从 spec/proto 与 client/proto 加载契约（只读 spec；M4 背包 RPC 在 client/proto）。 */
export function getProtoRoot(): protobuf.Root {
  if (root) return root;
  const specModules = import.meta.glob(
    "../../../spec/proto/sanguo/**/*.proto",
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;
  const clientContentModules = import.meta.glob(
    "../../proto/sanguo/content/**/*.proto",
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;
  const clientHeroModules = import.meta.glob(
    "../../proto/sanguo/hero/**/*.proto",
    { query: "?raw", import: "default", eager: true },
  ) as Record<string, string>;
  const clientModules = { ...clientContentModules, ...clientHeroModules };
  root = new protobuf.Root();
  parseProtosInto(root, specModules);
  parseProtosInto(root, clientModules);
  root.resolveAll();
  extendGetCityStateProductionRates(root);
  return root;
}

/** CLIENT-059：client 侧扩展 GetCityState.production_rates（field 3），不改 spec 契约文件。 */
function extendGetCityStateProductionRates(r: protobuf.Root): void {
  const type = r.lookupType("sanguo.domestic.v1.GetCityStateResponse");
  if (!type) return;
  if (type.fieldsArray.some((f) => f.name === "production_rates")) return;
  type.add(new protobuf.Field("production_rates", 3, "sanguo.common.v1.ResourceWallet"));
}

export const Routes = {
  Register: "account.v1.Register",
  Login: "account.v1.Login",
  ListGameServers: "account.v1.ListGameServers",
  EnterGameServer: "account.v1.EnterGameServer",
  SendChatMessage: "chat.v1.SendChatMessage",
  ListChatMessages: "chat.v1.ListChatMessages",
  CreateGuild: "guild.v1.CreateGuild",
  JoinGuild: "guild.v1.JoinGuild",
  ListGuildMembers: "guild.v1.ListGuildMembers",
  GetLeaderboard: "rank.v1.GetLeaderboard",
  CreateCity: "world.v1.CreateCity",
  ListPlayerCities: "world.v1.ListPlayerCities",
  GetCityState: "domestic.v1.GetCityState",
  StartBuildingUpgrade: "domestic.v1.StartBuildingUpgrade",
  RecruitTroop: "military.v1.RecruitTroop",
  StartMarch: "military.v1.StartMarch",
  ListMarches: "military.v1.ListMarches",
  ListBattleReports: "military.v1.ListBattleReports",
  GetBattleReport: "military.v1.GetBattleReport",
  ListPlayerQuests: "quest.v1.ListPlayerQuests",
  AcceptQuest: "quest.v1.AcceptQuest",
  ReportQuestProgress: "quest.v1.ReportQuestProgress",
  ClaimQuestReward: "quest.v1.ClaimQuestReward",
  ListShopShelf: "shop.v1.ListShopShelf",
  PurchaseShopOffer: "shop.v1.PurchaseShopOffer",
  ListPlayerBag: "content.v1.ListPlayerBag",
  UseConsumable: "content.v1.UseConsumable",
  ListPlayerMail: "content.v1.ListPlayerMail",
  MarkPlayerMailRead: "content.v1.MarkPlayerMailRead",
  ClaimPlayerMailAttachments: "content.v1.ClaimPlayerMailAttachments",
  ListPlayerHeroes: "hero.v1.ListPlayerHeroes",
  GetHeroDetail: "hero.v1.GetHeroDetail",
  UpgradeHero: "hero.v1.UpgradeHero",
  AddHeroPoint: "hero.v1.AddHeroPoint",
  ClearHeroPoint: "hero.v1.ClearHeroPoint",
  BeginHeroExpr: "hero.v1.BeginHeroExpr",
  CancelHeroExpr: "hero.v1.CancelHeroExpr",
  FinishHeroExpr: "hero.v1.FinishHeroExpr",
  FasterHeroExpr: "hero.v1.FasterHeroExpr",
  RestHero: "hero.v1.RestHero",
  RecruitHero: "hero.v1.RecruitHero",
  ListRecruitTemplates: "hero.v1.ListRecruitTemplates",
  ListHotelRecruitCandidates: "hero.v1.ListHotelRecruitCandidates",
  RefreshHotelRecruitPool: "hero.v1.RefreshHotelRecruitPool",
  RecruitHotelCandidate: "hero.v1.RecruitHotelCandidate",
  ListPersuadeTargets: "hero.v1.ListPersuadeTargets",
  PersuadeHero: "hero.v1.PersuadeHero",
  LionizeHero: "hero.v1.LionizeHero",
  LargessHero: "hero.v1.LargessHero",
  ListCaptiveHeroes: "hero.v1.ListCaptiveHeroes",
  TrySummonCaptive: "hero.v1.TrySummonCaptive",
  SureSummonCaptive: "hero.v1.SureSummonCaptive",
  ReleaseCaptive: "hero.v1.ReleaseCaptive",
  ListComingHeroes: "hero.v1.ListComingHeroes",
  TryAcceptComing: "hero.v1.TryAcceptComing",
  SureAcceptComing: "hero.v1.SureAcceptComing",
  RejectComing: "hero.v1.RejectComing",
  SetCityChief: "hero.v1.SetCityChief",
  ClearCityChief: "hero.v1.ClearCityChief",
  GetCityChief: "hero.v1.GetCityChief",
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
  ListGameServersRequest: protobuf.Type;
  ListGameServersResponse: protobuf.Type;
  EnterGameServerRequest: protobuf.Type;
  EnterGameServerResponse: protobuf.Type;
  SendChatMessageRequest: protobuf.Type;
  SendChatMessageResponse: protobuf.Type;
  ListChatMessagesRequest: protobuf.Type;
  ListChatMessagesResponse: protobuf.Type;
  CreateGuildRequest: protobuf.Type;
  CreateGuildResponse: protobuf.Type;
  JoinGuildRequest: protobuf.Type;
  JoinGuildResponse: protobuf.Type;
  ListGuildMembersRequest: protobuf.Type;
  ListGuildMembersResponse: protobuf.Type;
  GetLeaderboardRequest: protobuf.Type;
  GetLeaderboardResponse: protobuf.Type;
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
  ListMarchesRequest: protobuf.Type;
  ListMarchesResponse: protobuf.Type;
  ListBattleReportsRequest: protobuf.Type;
  ListBattleReportsResponse: protobuf.Type;
  GetBattleReportRequest: protobuf.Type;
  GetBattleReportResponse: protobuf.Type;
  ListPlayerQuestsRequest: protobuf.Type;
  ListPlayerQuestsResponse: protobuf.Type;
  AcceptQuestRequest: protobuf.Type;
  AcceptQuestResponse: protobuf.Type;
  ReportQuestProgressRequest: protobuf.Type;
  ReportQuestProgressResponse: protobuf.Type;
  ClaimQuestRewardRequest: protobuf.Type;
  ClaimQuestRewardResponse: protobuf.Type;
  ListShopShelfRequest: protobuf.Type;
  ListShopShelfResponse: protobuf.Type;
  PurchaseShopOfferRequest: protobuf.Type;
  PurchaseShopOfferResponse: protobuf.Type;
  ListPlayerBagRequest: protobuf.Type;
  ListPlayerBagResponse: protobuf.Type;
  UseConsumableRequest: protobuf.Type;
  UseConsumableResponse: protobuf.Type;
  ListPlayerMailRequest: protobuf.Type;
  ListPlayerMailResponse: protobuf.Type;
  MarkPlayerMailReadRequest: protobuf.Type;
  MarkPlayerMailReadResponse: protobuf.Type;
  ClaimPlayerMailAttachmentsRequest: protobuf.Type;
  ClaimPlayerMailAttachmentsResponse: protobuf.Type;
  ListPlayerHeroesRequest: protobuf.Type;
  ListPlayerHeroesResponse: protobuf.Type;
  GetHeroDetailRequest: protobuf.Type;
  GetHeroDetailResponse: protobuf.Type;
  UpgradeHeroRequest: protobuf.Type;
  UpgradeHeroResponse: protobuf.Type;
  AddHeroPointRequest: protobuf.Type;
  AddHeroPointResponse: protobuf.Type;
  ClearHeroPointRequest: protobuf.Type;
  ClearHeroPointResponse: protobuf.Type;
  BeginHeroExprRequest: protobuf.Type;
  BeginHeroExprResponse: protobuf.Type;
  CancelHeroExprRequest: protobuf.Type;
  CancelHeroExprResponse: protobuf.Type;
  FinishHeroExprRequest: protobuf.Type;
  FinishHeroExprResponse: protobuf.Type;
  FasterHeroExprRequest: protobuf.Type;
  FasterHeroExprResponse: protobuf.Type;
  RestHeroRequest: protobuf.Type;
  RestHeroResponse: protobuf.Type;
  RecruitHeroRequest: protobuf.Type;
  RecruitHeroResponse: protobuf.Type;
  ListRecruitTemplatesRequest: protobuf.Type;
  ListRecruitTemplatesResponse: protobuf.Type;
  ListHotelRecruitCandidatesRequest: protobuf.Type;
  ListHotelRecruitCandidatesResponse: protobuf.Type;
  RefreshHotelRecruitPoolRequest: protobuf.Type;
  RefreshHotelRecruitPoolResponse: protobuf.Type;
  RecruitHotelCandidateRequest: protobuf.Type;
  RecruitHotelCandidateResponse: protobuf.Type;
  ListPersuadeTargetsRequest: protobuf.Type;
  ListPersuadeTargetsResponse: protobuf.Type;
  PersuadeHeroRequest: protobuf.Type;
  PersuadeHeroResponse: protobuf.Type;
  LionizeHeroRequest: protobuf.Type;
  LionizeHeroResponse: protobuf.Type;
  LargessHeroRequest: protobuf.Type;
  LargessHeroResponse: protobuf.Type;
  ListCaptiveHeroesRequest: protobuf.Type;
  ListCaptiveHeroesResponse: protobuf.Type;
  TrySummonCaptiveRequest: protobuf.Type;
  TrySummonCaptiveResponse: protobuf.Type;
  SureSummonCaptiveRequest: protobuf.Type;
  SureSummonCaptiveResponse: protobuf.Type;
  ReleaseCaptiveRequest: protobuf.Type;
  ReleaseCaptiveResponse: protobuf.Type;
  ListComingHeroesRequest: protobuf.Type;
  ListComingHeroesResponse: protobuf.Type;
  TryAcceptComingRequest: protobuf.Type;
  TryAcceptComingResponse: protobuf.Type;
  SureAcceptComingRequest: protobuf.Type;
  SureAcceptComingResponse: protobuf.Type;
  RejectComingRequest: protobuf.Type;
  RejectComingResponse: protobuf.Type;
  SetCityChiefRequest: protobuf.Type;
  SetCityChiefResponse: protobuf.Type;
  ClearCityChiefRequest: protobuf.Type;
  ClearCityChiefResponse: protobuf.Type;
  GetCityChiefRequest: protobuf.Type;
  GetCityChiefResponse: protobuf.Type;
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
    ListGameServersRequest: r.lookupType("sanguo.account.v1.ListGameServersRequest"),
    ListGameServersResponse: r.lookupType("sanguo.account.v1.ListGameServersResponse"),
    EnterGameServerRequest: r.lookupType("sanguo.account.v1.EnterGameServerRequest"),
    EnterGameServerResponse: r.lookupType("sanguo.account.v1.EnterGameServerResponse"),
    SendChatMessageRequest: r.lookupType("sanguo.chat.v1.SendChatMessageRequest"),
    SendChatMessageResponse: r.lookupType("sanguo.chat.v1.SendChatMessageResponse"),
    ListChatMessagesRequest: r.lookupType("sanguo.chat.v1.ListChatMessagesRequest"),
    ListChatMessagesResponse: r.lookupType("sanguo.chat.v1.ListChatMessagesResponse"),
    CreateGuildRequest: r.lookupType("sanguo.guild.v1.CreateGuildRequest"),
    CreateGuildResponse: r.lookupType("sanguo.guild.v1.CreateGuildResponse"),
    JoinGuildRequest: r.lookupType("sanguo.guild.v1.JoinGuildRequest"),
    JoinGuildResponse: r.lookupType("sanguo.guild.v1.JoinGuildResponse"),
    ListGuildMembersRequest: r.lookupType("sanguo.guild.v1.ListGuildMembersRequest"),
    ListGuildMembersResponse: r.lookupType("sanguo.guild.v1.ListGuildMembersResponse"),
    GetLeaderboardRequest: r.lookupType("sanguo.rank.v1.GetLeaderboardRequest"),
    GetLeaderboardResponse: r.lookupType("sanguo.rank.v1.GetLeaderboardResponse"),
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
    ListMarchesRequest: r.lookupType("sanguo.military.v1.ListMarchesRequest"),
    ListMarchesResponse: r.lookupType("sanguo.military.v1.ListMarchesResponse"),
    ListBattleReportsRequest: r.lookupType("sanguo.military.v1.ListBattleReportsRequest"),
    ListBattleReportsResponse: r.lookupType("sanguo.military.v1.ListBattleReportsResponse"),
    GetBattleReportRequest: r.lookupType("sanguo.military.v1.GetBattleReportRequest"),
    GetBattleReportResponse: r.lookupType("sanguo.military.v1.GetBattleReportResponse"),
    ListPlayerQuestsRequest: r.lookupType("sanguo.quest.v1.ListPlayerQuestsRequest"),
    ListPlayerQuestsResponse: r.lookupType("sanguo.quest.v1.ListPlayerQuestsResponse"),
    AcceptQuestRequest: r.lookupType("sanguo.quest.v1.AcceptQuestRequest"),
    AcceptQuestResponse: r.lookupType("sanguo.quest.v1.AcceptQuestResponse"),
    ReportQuestProgressRequest: r.lookupType("sanguo.quest.v1.ReportQuestProgressRequest"),
    ReportQuestProgressResponse: r.lookupType("sanguo.quest.v1.ReportQuestProgressResponse"),
    ClaimQuestRewardRequest: r.lookupType("sanguo.quest.v1.ClaimQuestRewardRequest"),
    ClaimQuestRewardResponse: r.lookupType("sanguo.quest.v1.ClaimQuestRewardResponse"),
    ListShopShelfRequest: r.lookupType("sanguo.shop.v1.ListShopShelfRequest"),
    ListShopShelfResponse: r.lookupType("sanguo.shop.v1.ListShopShelfResponse"),
    PurchaseShopOfferRequest: r.lookupType("sanguo.shop.v1.PurchaseShopOfferRequest"),
    PurchaseShopOfferResponse: r.lookupType("sanguo.shop.v1.PurchaseShopOfferResponse"),
    ListPlayerBagRequest: r.lookupType("sanguo.content.v1.ListPlayerBagRequest"),
    ListPlayerBagResponse: r.lookupType("sanguo.content.v1.ListPlayerBagResponse"),
    UseConsumableRequest: r.lookupType("sanguo.content.v1.UseConsumableRequest"),
    UseConsumableResponse: r.lookupType("sanguo.content.v1.UseConsumableResponse"),
    ListPlayerMailRequest: r.lookupType("sanguo.content.v1.ListPlayerMailRequest"),
    ListPlayerMailResponse: r.lookupType("sanguo.content.v1.ListPlayerMailResponse"),
    MarkPlayerMailReadRequest: r.lookupType("sanguo.content.v1.MarkPlayerMailReadRequest"),
    MarkPlayerMailReadResponse: r.lookupType("sanguo.content.v1.MarkPlayerMailReadResponse"),
    ClaimPlayerMailAttachmentsRequest: r.lookupType("sanguo.content.v1.ClaimPlayerMailAttachmentsRequest"),
    ClaimPlayerMailAttachmentsResponse: r.lookupType("sanguo.content.v1.ClaimPlayerMailAttachmentsResponse"),
    ListPlayerHeroesRequest: r.lookupType("sanguo.hero.v1.ListPlayerHeroesRequest"),
    ListPlayerHeroesResponse: r.lookupType("sanguo.hero.v1.ListPlayerHeroesResponse"),
    GetHeroDetailRequest: r.lookupType("sanguo.hero.v1.GetHeroDetailRequest"),
    GetHeroDetailResponse: r.lookupType("sanguo.hero.v1.GetHeroDetailResponse"),
    UpgradeHeroRequest: r.lookupType("sanguo.hero.v1.UpgradeHeroRequest"),
    UpgradeHeroResponse: r.lookupType("sanguo.hero.v1.UpgradeHeroResponse"),
    AddHeroPointRequest: r.lookupType("sanguo.hero.v1.AddHeroPointRequest"),
    AddHeroPointResponse: r.lookupType("sanguo.hero.v1.AddHeroPointResponse"),
    ClearHeroPointRequest: r.lookupType("sanguo.hero.v1.ClearHeroPointRequest"),
    ClearHeroPointResponse: r.lookupType("sanguo.hero.v1.ClearHeroPointResponse"),
    BeginHeroExprRequest: r.lookupType("sanguo.hero.v1.BeginHeroExprRequest"),
    BeginHeroExprResponse: r.lookupType("sanguo.hero.v1.BeginHeroExprResponse"),
    CancelHeroExprRequest: r.lookupType("sanguo.hero.v1.CancelHeroExprRequest"),
    CancelHeroExprResponse: r.lookupType("sanguo.hero.v1.CancelHeroExprResponse"),
    FinishHeroExprRequest: r.lookupType("sanguo.hero.v1.FinishHeroExprRequest"),
    FinishHeroExprResponse: r.lookupType("sanguo.hero.v1.FinishHeroExprResponse"),
    FasterHeroExprRequest: r.lookupType("sanguo.hero.v1.FasterHeroExprRequest"),
    FasterHeroExprResponse: r.lookupType("sanguo.hero.v1.FasterHeroExprResponse"),
    RestHeroRequest: r.lookupType("sanguo.hero.v1.RestHeroRequest"),
    RestHeroResponse: r.lookupType("sanguo.hero.v1.RestHeroResponse"),
    RecruitHeroRequest: r.lookupType("sanguo.hero.v1.RecruitHeroRequest"),
    RecruitHeroResponse: r.lookupType("sanguo.hero.v1.RecruitHeroResponse"),
    ListRecruitTemplatesRequest: r.lookupType("sanguo.hero.v1.ListRecruitTemplatesRequest"),
    ListRecruitTemplatesResponse: r.lookupType("sanguo.hero.v1.ListRecruitTemplatesResponse"),
    ListHotelRecruitCandidatesRequest: r.lookupType("sanguo.hero.v1.ListHotelRecruitCandidatesRequest"),
    ListHotelRecruitCandidatesResponse: r.lookupType("sanguo.hero.v1.ListHotelRecruitCandidatesResponse"),
    RefreshHotelRecruitPoolRequest: r.lookupType("sanguo.hero.v1.RefreshHotelRecruitPoolRequest"),
    RefreshHotelRecruitPoolResponse: r.lookupType("sanguo.hero.v1.RefreshHotelRecruitPoolResponse"),
    RecruitHotelCandidateRequest: r.lookupType("sanguo.hero.v1.RecruitHotelCandidateRequest"),
    RecruitHotelCandidateResponse: r.lookupType("sanguo.hero.v1.RecruitHotelCandidateResponse"),
    ListPersuadeTargetsRequest: r.lookupType("sanguo.hero.v1.ListPersuadeTargetsRequest"),
    ListPersuadeTargetsResponse: r.lookupType("sanguo.hero.v1.ListPersuadeTargetsResponse"),
    PersuadeHeroRequest: r.lookupType("sanguo.hero.v1.PersuadeHeroRequest"),
    PersuadeHeroResponse: r.lookupType("sanguo.hero.v1.PersuadeHeroResponse"),
    LionizeHeroRequest: r.lookupType("sanguo.hero.v1.LionizeHeroRequest"),
    LionizeHeroResponse: r.lookupType("sanguo.hero.v1.LionizeHeroResponse"),
    LargessHeroRequest: r.lookupType("sanguo.hero.v1.LargessHeroRequest"),
    LargessHeroResponse: r.lookupType("sanguo.hero.v1.LargessHeroResponse"),
    ListCaptiveHeroesRequest: r.lookupType("sanguo.hero.v1.ListCaptiveHeroesRequest"),
    ListCaptiveHeroesResponse: r.lookupType("sanguo.hero.v1.ListCaptiveHeroesResponse"),
    TrySummonCaptiveRequest: r.lookupType("sanguo.hero.v1.TrySummonCaptiveRequest"),
    TrySummonCaptiveResponse: r.lookupType("sanguo.hero.v1.TrySummonCaptiveResponse"),
    SureSummonCaptiveRequest: r.lookupType("sanguo.hero.v1.SureSummonCaptiveRequest"),
    SureSummonCaptiveResponse: r.lookupType("sanguo.hero.v1.SureSummonCaptiveResponse"),
    ReleaseCaptiveRequest: r.lookupType("sanguo.hero.v1.ReleaseCaptiveRequest"),
    ReleaseCaptiveResponse: r.lookupType("sanguo.hero.v1.ReleaseCaptiveResponse"),
    ListComingHeroesRequest: r.lookupType("sanguo.hero.v1.ListComingHeroesRequest"),
    ListComingHeroesResponse: r.lookupType("sanguo.hero.v1.ListComingHeroesResponse"),
    TryAcceptComingRequest: r.lookupType("sanguo.hero.v1.TryAcceptComingRequest"),
    TryAcceptComingResponse: r.lookupType("sanguo.hero.v1.TryAcceptComingResponse"),
    SureAcceptComingRequest: r.lookupType("sanguo.hero.v1.SureAcceptComingRequest"),
    SureAcceptComingResponse: r.lookupType("sanguo.hero.v1.SureAcceptComingResponse"),
    RejectComingRequest: r.lookupType("sanguo.hero.v1.RejectComingRequest"),
    RejectComingResponse: r.lookupType("sanguo.hero.v1.RejectComingResponse"),
    SetCityChiefRequest: r.lookupType("sanguo.hero.v1.SetCityChiefRequest"),
    SetCityChiefResponse: r.lookupType("sanguo.hero.v1.SetCityChiefResponse"),
    ClearCityChiefRequest: r.lookupType("sanguo.hero.v1.ClearCityChiefRequest"),
    ClearCityChiefResponse: r.lookupType("sanguo.hero.v1.ClearCityChiefResponse"),
    GetCityChiefRequest: r.lookupType("sanguo.hero.v1.GetCityChiefRequest"),
    GetCityChiefResponse: r.lookupType("sanguo.hero.v1.GetCityChiefResponse"),
  };
}
