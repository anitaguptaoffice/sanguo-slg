package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/anitaguptaoffice/sanguo-slg/internal/content"
)

// MountGmHTTP registers thin JSON GM endpoints on mux (optional; mount from server wiring).
func MountGmHTTP(mux *http.ServeMux, gm *GmService) {
	if mux == nil || gm == nil {
		return
	}
	h := &gmHTTP{gm: gm}
	mux.HandleFunc("/gm/lookup", h.lookup)
	mux.HandleFunc("/gm/grant", h.grant)
	mux.HandleFunc("/gm/kick", h.kick)
	mux.HandleFunc("/gm/mute", h.mute)
}

type gmHTTP struct {
	gm *GmService
}

type gmLookupReq struct {
	Token         string `json:"token"`
	Audit         GmAudit
	ServerID      int32  `json:"server_id"`
	PlayerID      int64  `json:"player_id"`
	AccountLogin  string `json:"account_login"`
}

func (h *gmHTTP) lookup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req gmLookupReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Token = h.token(r, req.Token)
	res, info, err := h.gm.LookupPlayer(r.Context(), req.Token, req.Audit, req.ServerID, req.PlayerID, req.AccountLogin)
	if err != nil {
		writeGmErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"result": res, "player": info})
}

type gmGrantReq struct {
	Token           string                 `json:"token"`
	Audit           GmAudit
	ServerID        int32                  `json:"server_id"`
	PlayerID        int64                  `json:"player_id"`
	IdempotencyKey  string                 `json:"idempotency_key"`
	Rewards         content.RewardPackage  `json:"rewards"`
}

func (h *gmHTTP) grant(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req gmGrantReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Token = h.token(r, req.Token)
	res, grant, err := h.gm.GrantReward(r.Context(), req.Token, req.Audit, req.ServerID, req.PlayerID, req.Rewards, req.IdempotencyKey)
	if err != nil {
		writeGmErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"result": res, "grant": grant})
}

type gmKickReq struct {
	Token    string `json:"token"`
	Audit    GmAudit
	ServerID int32  `json:"server_id"`
	PlayerID int64  `json:"player_id"`
}

func (h *gmHTTP) kick(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req gmKickReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Token = h.token(r, req.Token)
	res, ok, err := h.gm.KickPlayer(r.Context(), req.Token, req.Audit, req.ServerID, req.PlayerID)
	if err != nil {
		writeGmErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"result": res, "session_terminated": ok})
}

type gmMuteReq struct {
	Token        string `json:"token"`
	Audit        GmAudit
	ServerID     int32  `json:"server_id"`
	PlayerID     int64  `json:"player_id"`
	MuteUntilMS  int64  `json:"mute_until_ms"`
}

func (h *gmHTTP) mute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req gmMuteReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Token = h.token(r, req.Token)
	res, until, err := h.gm.MutePlayer(r.Context(), req.Token, req.Audit, req.ServerID, req.PlayerID, req.MuteUntilMS)
	if err != nil {
		writeGmErr(w, err)
		return
	}
	writeJSON(w, map[string]any{"result": res, "chat_muted_until_ms": until})
}

func (h *gmHTTP) token(r *http.Request, bodyToken string) string {
	if t := strings.TrimSpace(bodyToken); t != "" {
		return t
	}
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
	}
	return ""
}

func writeGmErr(w http.ResponseWriter, err error) {
	code := http.StatusBadRequest
	if err == ErrGmUnauthorized {
		code = http.StatusUnauthorized
	}
	http.Error(w, err.Error(), code)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
