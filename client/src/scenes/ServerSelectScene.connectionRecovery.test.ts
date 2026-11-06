import { afterEach, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import { bootstrapMainCity } from "@/net/bootstrapSession";
import type { GatewayHandlers } from "@/net/GatewayClient";
vi.mock("@/net/bootstrapSession", () => ({ bootstrapMainCity: vi.fn() }));
vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const flush = async () => { for(let i=0;i<20;i++) await Promise.resolve(); };
function deferred() { let resolve!: () => void, reject!: (e: Error) => void; const promise = new Promise<void>((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
const scenes: ServerSelectScene[] = [];
afterEach(() => { scenes.splice(0).forEach((s) => s.leave()); document.body.innerHTML=""; vi.clearAllMocks(); });
function setup() {
  let live = false; const handlers: GatewayHandlers[] = [];
  const scene = new ServerSelectScene(); scenes.push(scene);
  const layoutFrame=document.createElement("div"), hud=document.createElement("div"); document.body.append(layoutFrame,hud);
  const attempt = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const gateway = {connect: vi.fn(async (h: GatewayHandlers={}) => { handlers.push(h); await attempt(); live=true; h.onOpen?.(); }),
    listGameServers: vi.fn(async () => { if(!live) throw new Error("gateway not connected"); return {servers:[{shard:{server_id:1,status:1,display_name:"S1"}}]}; })};
  const ctx: any = {layoutFrame,hud,gateway,assets:{},switchScene:vi.fn()};
  const button=(a:string)=>layoutFrame.querySelector<HTMLButtonElement>(`[data-action="${a}"]`)!;
  const close=()=>{live=false; handlers.at(-1)?.onClose?.();};
  return {scene,ctx,gateway,attempt,handlers,button,close,layoutFrame};
}
it("explicit refresh reconnects after initial failure and never bootstraps automatically", async () => {
  const s=setup(); s.attempt.mockRejectedValueOnce(new Error("offline")); await s.scene.enter(s.ctx);
  expect(s.button("enter-game").disabled).toBe(true); s.button("refresh-servers").click(); await flush();
  expect(s.gateway.connect).toHaveBeenCalledTimes(2); expect(s.button("enter-game").disabled).toBe(false); expect(bootstrapMainCity).not.toHaveBeenCalled();
});
it("failed reconnect can be retried explicitly again", async () => {
  const s=setup(); s.attempt.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("still offline")); await s.scene.enter(s.ctx);
  s.button("refresh-servers").click(); await flush(); expect(s.button("refresh-servers").disabled).toBe(false);
  s.button("refresh-servers").click(); await flush(); expect(s.gateway.connect).toHaveBeenCalledTimes(3); expect(s.button("enter-game").disabled).toBe(false);
});
it("socket close invalidates entry until an explicit reconnect/list succeeds", async () => {
  const s=setup(); await s.scene.enter(s.ctx); s.close(); expect(s.button("enter-game").disabled).toBe(true);
  expect(s.layoutFrame.textContent).toContain("刷新"); s.button("enter-game").click(); expect(bootstrapMainCity).not.toHaveBeenCalled();
  s.button("refresh-servers").click(); await flush(); expect(s.gateway.connect).toHaveBeenCalledTimes(2); expect(s.button("enter-game").disabled).toBe(false);
});
it("close before open releases the scene attempt even if gateway connect never settles", async () => {
  const s=setup(), pending=deferred(); s.attempt.mockReturnValueOnce(pending.promise);
  let done=false; const entered=s.scene.enter(s.ctx).then(()=>{done=true;}); s.close(); await flush();
  expect(done).toBe(true); expect(s.button("refresh-servers").disabled).toBe(false);
  s.button("refresh-servers").click(); await flush(); expect(s.button("enter-game").disabled).toBe(false); await entered;
});
it("repeated refresh clicks share one reconnect and list", async () => {
  const s=setup(); s.attempt.mockRejectedValueOnce(new Error("offline")); await s.scene.enter(s.ctx); const pending=deferred(); s.attempt.mockReturnValueOnce(pending.promise);
  s.button("refresh-servers").click(); s.button("refresh-servers").dispatchEvent(new MouseEvent("click",{bubbles:true}));
  expect(s.gateway.connect).toHaveBeenCalledTimes(2); expect(s.gateway.listGameServers).not.toHaveBeenCalled();
  pending.resolve(); await flush(); expect(s.gateway.listGameServers).toHaveBeenCalledTimes(1);
});
it("ordinary list error on live connection retries the read without reconnect", async () => {
  const s=setup(); await s.scene.enter(s.ctx); s.gateway.listGameServers.mockRejectedValueOnce(new Error("busy")); s.button("refresh-servers").click(); await flush();
  s.button("refresh-servers").click(); await flush(); expect(s.gateway.connect).toHaveBeenCalledTimes(1); expect(s.button("enter-game").disabled).toBe(false);
});
it.each(["close","error"])("obsolete %s callback cannot disable the reentered scene", async (kind) => {
  const s=setup(); await s.scene.enter(s.ctx); const old=s.handlers[0]; s.scene.leave(); await s.scene.enter(s.ctx);
  if(kind==="close") old.onClose?.(); else old.onError?.(new Event("error")); await flush();
  expect(s.button("enter-game").disabled).toBe(false); expect(s.gateway.connect).toHaveBeenCalledTimes(2);
});
it("late success of an abandoned initial connect cannot overwrite a replacement failure", async () => {
  const s=setup(), old=deferred(); s.attempt.mockReturnValueOnce(old.promise); const first=s.scene.enter(s.ctx); s.scene.leave();
  s.attempt.mockRejectedValueOnce(new Error("new offline")); await s.scene.enter(s.ctx); old.resolve(); await first;
  expect(s.button("enter-game").disabled).toBe(true); expect(s.gateway.listGameServers).not.toHaveBeenCalled();
});
it("closing during a list read discards its late success", async () => {
  const s=setup(); await s.scene.enter(s.ctx); let resolve!: (v:any)=>void; s.gateway.listGameServers.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
  s.button("refresh-servers").click(); s.close(); resolve({servers:[{shard:{server_id:99,status:1,display_name:"obsolete"}}]}); await flush();
  expect(s.layoutFrame.textContent).not.toContain("obsolete"); expect(s.button("enter-game").disabled).toBe(true); expect(s.button("refresh-servers").disabled).toBe(false);
});
it("disconnect during bootstrap prevents scene transition and never replays it", async () => {
  const s=setup(); await s.scene.enter(s.ctx); let resolve!: (v:any)=>void;
  vi.mocked(bootstrapMainCity).mockReturnValueOnce(new Promise(r=>{resolve=r;})); s.button("enter-game").click(); s.close();
  resolve({serverId:1}); await flush(); expect(s.ctx.switchScene).not.toHaveBeenCalled(); expect(s.button("enter-game").disabled).toBe(true);
  s.button("refresh-servers").click(); await flush(); expect(bootstrapMainCity).toHaveBeenCalledTimes(1); expect(s.button("enter-game").disabled).toBe(false);
});
it("real GatewayClient and protobuf transport recover through explicit Refresh", async () => {
  const {GatewayClient}=await import("@/net/GatewayClient"); const {getTypes}=await import("@/net/loadProto");
  const sockets: Socket[]=[];
  class Socket extends EventTarget {
    static OPEN=1; readyState=0; binaryType="";
    onopen?:()=>void; onclose?:()=>void; onerror?:(e:Event)=>void;
    constructor(_url:string) {super(); sockets.push(this);}
    open(){this.readyState=1;this.onopen?.();}
    close(){this.readyState=3;this.onclose?.();this.dispatchEvent(new Event("close"));}
    send(bytes:Uint8Array){
      const t=getTypes(), request=t.ClientPacket.decode(bytes) as any;
      const data=t.ListGameServersResponse.encode(t.ListGameServersResponse.create({servers:[{shard:{server_id:1,status:1,display_name:"Real S1"}}]})).finish();
      const packet=t.ServerPacket.encode(t.ServerPacket.create({trace_id:request.trace_id,code:0,data})).finish();
      this.dispatchEvent(new MessageEvent("message",{data:Uint8Array.from(packet).buffer}));
    }
  }
  vi.stubGlobal("WebSocket",Socket);
  try {
    const s=setup(); s.ctx.gateway=new GatewayClient("ws://test.invalid"); const first=s.scene.enter(s.ctx);
    sockets[0].close(); await first; expect(s.button("enter-game").disabled).toBe(true);
    s.button("refresh-servers").click(); expect(sockets).toHaveLength(2); sockets[1].open(); await flush();
    expect(s.layoutFrame.textContent).toContain("Real S1"); expect(s.button("enter-game").disabled).toBe(false);
    sockets[1].close(); expect(s.button("enter-game").disabled).toBe(true);
    s.button("refresh-servers").click(); expect(sockets).toHaveLength(3); sockets[2].open(); await flush(); expect(s.button("enter-game").disabled).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
