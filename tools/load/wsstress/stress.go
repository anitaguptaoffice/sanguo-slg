package wsstress

import (
	"fmt"
	"sync"
	"time"

	"github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway"
	commonv1 "github.com/anitaguptaoffice/sanguo-slg/internal/platform/gateway/pb/sanguo/common/v1"
	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

// Result summarizes one stress run.
type Result struct {
	Concurrency int
	Elapsed     time.Duration
	Failed      int
}

// Run opens cfg.Concurrency WebSocket connections to cfg.WSURL, sends a ping
// on each, and waits for a response. Logic mirrors gateway TestStress3000Connections.
func Run(cfg Config) (Result, error) {
	if cfg.WSURL == "" {
		return Result{}, fmt.Errorf("WSURL is required")
	}
	if cfg.Concurrency < 1 {
		return Result{}, fmt.Errorf("concurrency must be >= 1")
	}
	if cfg.DialParallelism < 1 {
		return Result{}, fmt.Errorf("dial parallelism must be >= 1")
	}

	dialer := websocket.Dialer{HandshakeTimeout: cfg.HandshakeTimeout}
	start := time.Now()

	var wg sync.WaitGroup
	errCh := make(chan error, cfg.Concurrency)
	sem := make(chan struct{}, cfg.DialParallelism)

	for i := 0; i < cfg.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			c, _, err := dialer.Dial(cfg.WSURL, nil)
			if err != nil {
				errCh <- err
				return
			}
			frame, err := proto.Marshal(&commonv1.ClientPacket{Route: gateway.RoutePing, TraceId: "load"})
			if err != nil {
				errCh <- err
				_ = c.Close()
				return
			}
			if err := c.WriteMessage(websocket.BinaryMessage, frame); err != nil {
				errCh <- err
				_ = c.Close()
				return
			}
			if _, _, err := c.ReadMessage(); err != nil {
				errCh <- err
			}
			_ = c.Close()
		}()
	}
	wg.Wait()
	close(errCh)

	failed := 0
	var firstErr error
	for err := range errCh {
		if err != nil {
			failed++
			if firstErr == nil {
				firstErr = err
			}
		}
	}

	res := Result{
		Concurrency: cfg.Concurrency,
		Elapsed:     time.Since(start),
		Failed:      failed,
	}
	if failed > 0 {
		return res, fmt.Errorf("%d of %d connections failed: %v", failed, cfg.Concurrency, firstErr)
	}
	return res, nil
}
