export type GameServerRow = {
  server_id?: number;
  display_name?: string;
  status?: number;
  online_count?: number;
  has_player?: boolean;
};

export function parseGameServerInfo(raw: {
  shard?: { server_id?: number; display_name?: string; status?: number };
  online_count?: number;
  has_player?: boolean;
}): GameServerRow {
  return {
    server_id: raw.shard?.server_id,
    display_name: raw.shard?.display_name,
    status: raw.shard?.status,
    online_count: raw.online_count,
    has_player: raw.has_player,
  };
}

export function serverStatusLabel(status?: number): string {
  switch (status) {
    case 0:
      return "维护";
    case 1:
      return "流畅";
    case 2:
      return "火爆";
    case 3:
      return "停服";
    default:
      return "未知";
  }
}

export function formatServerLine(s: GameServerRow): string {
  const id = s.server_id ?? "?";
  const name = s.display_name ?? `服${id}`;
  const role = s.has_player ? "有角色" : "无角色";
  return `${name} (#${id}) · ${serverStatusLabel(s.status)} · 在线≈${s.online_count ?? 0} · ${role}`;
}

export function guildRoleLabel(role?: number): string {
  switch (role) {
    case 1:
      return "团长";
    case 2:
      return "官员";
    case 3:
      return "成员";
    default:
      return "—";
  }
}

export function leaderboardTypeLabel(type?: number): string {
  switch (type) {
    case 1:
      return "玩家战力";
    case 2:
      return "玩家资源";
    case 3:
      return "军团战力";
    default:
      return "排行榜";
  }
}
