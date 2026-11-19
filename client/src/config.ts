/** 真实网关 WebSocket 地址（`make dev` 默认 :8080/ws）。 */
export const GATEWAY_WS_URL =
  (import.meta.env.VITE_GATEWAY_WS_URL as string | undefined) ??
  "ws://127.0.0.1:8080/ws";
