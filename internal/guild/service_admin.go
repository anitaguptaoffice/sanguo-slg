package guild

import (
	"context"
)

// KickMember removes a player from the actor's guild (leader/officer; minimal rules).
func (s *Service) KickMember(ctx context.Context, actor Actor, targetPlayerID int64) error {
	serverID, err := s.serverID(actor, 0)
	if err != nil {
		return err
	}
	if targetPlayerID == 0 || targetPlayerID == actor.PlayerID {
		return ErrPermissionDenied
	}
	actorMem, err := s.store.GetMembership(ctx, serverID, actor.PlayerID)
	if err != nil {
		return err
	}
	if !canManageMembers(actorMem.Role) {
		return ErrPermissionDenied
	}
	targetMem, err := s.store.GetMembership(ctx, serverID, targetPlayerID)
	if err != nil {
		return err
	}
	if targetMem.GuildID != actorMem.GuildID {
		return ErrNotMember
	}
	if targetMem.Role == RoleLeader {
		return ErrCannotKickLeader
	}
	if actorMem.Role == RoleOfficer && targetMem.Role != RoleMember {
		return ErrPermissionDenied
	}
	return s.store.RemoveMember(ctx, serverID, targetPlayerID)
}

// SetMemberRole changes a member's role (leader only; officer/member targets).
func (s *Service) SetMemberRole(ctx context.Context, actor Actor, targetPlayerID int64, role int16) error {
	serverID, err := s.serverID(actor, 0)
	if err != nil {
		return err
	}
	if targetPlayerID == 0 || targetPlayerID == actor.PlayerID {
		return ErrPermissionDenied
	}
	if role != RoleOfficer && role != RoleMember {
		return ErrInvalidRole
	}
	actorMem, err := s.store.GetMembership(ctx, serverID, actor.PlayerID)
	if err != nil {
		return err
	}
	if actorMem.Role != RoleLeader {
		return ErrPermissionDenied
	}
	targetMem, err := s.store.GetMembership(ctx, serverID, targetPlayerID)
	if err != nil {
		return err
	}
	if targetMem.GuildID != actorMem.GuildID {
		return ErrNotMember
	}
	if targetMem.Role == RoleLeader {
		return ErrPermissionDenied
	}
	return s.store.UpdateMemberRole(ctx, serverID, actorMem.GuildID, targetPlayerID, role)
}
