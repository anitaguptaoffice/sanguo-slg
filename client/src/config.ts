/** 真实网关 WebSocket 地址（PLAT-002 就绪后替换 mock）。 */
export const GATEWAY_WS_URL =
  (import.meta.env.VITE_GATEWAY_WS_URL as string | undefined) ??
  "ws://127.0.0.1:19090/ws";
