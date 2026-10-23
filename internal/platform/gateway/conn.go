package gateway

import (
	"context"
	"log/slog"
	"sync"
	"time"

	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
)

type conn struct {
	ws       *websocket.Conn
	log      *slog.Logger
	cfg      Config
	limiter  *tokenBucket
	sessions SessionValidator
	router   *Router
	public   map[string]bool
	hub      *hub

	sessionID string
	mu        sync.Mutex
	closed    bool
}

func (c *conn) closeWithReason(reason string) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return
	}
	c.closed = true
	c.mu.Unlock()
	_ = c.ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, reason), time.Now().Add(time.Second))
	_ = c.ws.Close()
}

func (c *conn) serve(ctx context.Context) {
	defer func() {
		c.hub.unbindSession(c.sessionID, c)
		c.hub.remove()
		_ = c.ws.Close()
	}()

	c.ws.SetReadLimit(1 << 20)
	_ = c.ws.SetReadDeadline(time.Now().Add(c.cfg.PongWait))
	c.ws.SetPongHandler(func(string) error {
		return c.ws.SetReadDeadline(time.Now().Add(c.cfg.PongWait))
	})

	pingDone := make(chan struct{})
	go c.pingLoop(pingDone)
	defer close(pingDone)

	for {
		if ctx.Err() != nil {
			return
		}
		_, data, err := c.ws.ReadMessage()
		if err != nil {
			return
		}
		if !c.limiter.allow() {
			_ = c.writePacket(errPacket("", commonv1.ErrorCode_COMMON_UNAVAILABLE, "rate limited"))
			continue
		}
		pkt, err := DecodeClient(data)
		if err != nil {
			_ = c.writePacket(errPacket("", commonv1.ErrorCode_COMMON_INVALID_PACKET, "invalid packet"))
			continue
		}
		if !c.public[pkt.GetRoute()] {
			if pkt.GetSessionId() == "" || !c.sessions.Valid(ctx, pkt.GetSessionId()) {
				_ = c.writePacket(errPacket(pkt.GetTraceId(), commonv1.ErrorCode_COMMON_UNAUTHORIZED, "unauthorized"))
				continue
			}
		}
		if sid := pkt.GetSessionId(); sid != "" && c.sessions.Valid(ctx, sid) && sid != c.sessionID {
			c.sessionID = sid
			c.hub.bindSession(c.sessionID, c)
		}
		resp := c.router.Dispatch(ctx, pkt)
		if err := c.writePacket(resp); err != nil {
			return
		}
	}
}

func (c *conn) pingLoop(done <-chan struct{}) {
	if c.cfg.PingInterval <= 0 {
		return
	}
	ticker := time.NewTicker(c.cfg.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			c.mu.Lock()
			closed := c.closed
			c.mu.Unlock()
			if closed {
				return
			}
			if err := c.ws.WriteControl(websocket.PingMessage, nil, time.Now().Add(time.Second)); err != nil {
				return
			}
		}
	}
}

func (c *conn) writePacket(pkt *commonv1.ServerPacket) error {
	out, err := EncodeServer(pkt)
	if err != nil {
		return err
	}
	return c.ws.WriteMessage(websocket.BinaryMessage, out)
}
