import { expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
function deferred() { let resolve!: (v: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
function setup() {
 let generation=1;
 const scene=new MainCityScene() as unknown as Record<string,any>;
 const session={serverId:1,player:{player_id:1},cityId:1,cityTroops:[],wallet:{gold:900,wood:900,stone:900,food:900,iron:900}};
 const gateway={getSessionId:()=>"token",getSessionGeneration:()=>generation,getBoundServerId:()=>1,recruitTroop:vi.fn()};
 const panel=document.createElement("div");panel.innerHTML='<select data-field="unit"><option value="1">Infantry</option></select><input data-field="recruit-count" value="1"><p data-role="troop-recruit-form-error"></p><button data-action="recruit">Recruit</button>';
 Object.assign(scene,{session,gateway,militaryPanel:panel,hud:document.createElement("div"),renderHud:vi.fn(),syncMilitaryPanel:vi.fn(),cityStateFetch:{clear:vi.fn()},queuePanels:{addRecruitEntry:vi.fn(),pulseRecruitRow:vi.fn(),getRecruitQueueSnapshot:()=>[],detach:vi.fn()}});
 return {scene,gateway,panel,relogin(){generation++;}};
}
const response={wallet:{food:700,wood:700,stone:700,iron:700},troop:{unit_cfg_id:1,count:1},queue_id:5,finish_at_ms:Date.now()+60000};
it.each(["city","player","server","relogin","leave"])("rejects old success after %s",async change=>{
 const f=setup(),d=deferred();f.gateway.recruitTroop.mockReturnValueOnce(d.promise);const a=f.scene.recruit();
 if(change==="relogin")f.relogin();else if(change==="leave")f.scene.leave();else if(change==="city")f.scene.session.cityId=2;else if(change==="server")f.scene.session.serverId=2;else f.scene.session.player.player_id=2;
 f.scene.status="new view";d.resolve(response);await a;
 expect(f.scene.status).toBe("new view");expect(f.scene.session.wallet.food).toBe(900);expect(f.scene.queuePanels.addRecruitEntry).not.toHaveBeenCalled();
});
it.each(["resolve","reject"])("old %s cannot overwrite or release newer operation",async settle=>{
 const f=setup(),old=deferred(),next=deferred();f.gateway.recruitTroop.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
 const a=f.scene.recruit();f.relogin();const b=f.scene.recruit();f.scene.status="new pending";
 if(settle==="resolve")old.resolve(response);else old.reject(new Error("old error"));await a;
 expect(f.scene.status).toBe("new pending");expect(f.scene.recruitTroopSubmitState).toBe("submitting");expect(f.scene.session.wallet.food).toBe(900);
 next.resolve(response);await b;expect(f.scene.session.wallet.food).toBe(700);expect(f.scene.recruitTroopSubmitState).toBe("idle");
});
it("exit resets pending and a late error cannot dirty a replacement panel",async()=>{
 const f=setup(),d=deferred();f.gateway.recruitTroop.mockReturnValueOnce(d.promise);
 const button=f.panel.querySelector("button")!; f.panel.addEventListener("click",(event)=>f.scene.onMilitaryClick(event));button.click();
 expect(f.gateway.recruitTroop).toHaveBeenCalledWith(1,1,1);f.scene.leave();expect(f.scene.recruitTroopSubmitState).toBe("idle");
 const next=document.createElement("div");next.innerHTML='<p data-role="troop-recruit-form-error">new view</p>';f.scene.militaryPanel=next;f.scene.status="new view";
 d.reject(new Error("old failure"));await vi.waitFor(()=>expect(f.gateway.recruitTroop).toHaveBeenCalledTimes(1));await Promise.resolve();await Promise.resolve();
 expect(next.textContent).toBe("new view");expect(f.scene.status).toBe("new view");
});
it("preserves current success, gold and queue receipt without duplicate submission",async()=>{
 const f=setup(),d=deferred();f.gateway.recruitTroop.mockReturnValueOnce(d.promise);const a=f.scene.recruit();await f.scene.recruit();
 expect(f.gateway.recruitTroop).toHaveBeenCalledTimes(1);d.resolve(response);await a;
 expect(f.scene.session.wallet.food).toBe(700);expect(f.scene.session.wallet.gold).toBe(900);expect(f.scene.queuePanels.addRecruitEntry).toHaveBeenCalledTimes(1);
});
it("preserves current failure without replay",async()=>{
 const f=setup();f.gateway.recruitTroop.mockRejectedValueOnce(new Error("current failure"));await f.scene.recruit();
 expect(f.scene.recruitTroopSubmitState).toBe("error");expect(f.panel.textContent).toContain("current failure");expect(f.gateway.recruitTroop).toHaveBeenCalledTimes(1);
});
it.each(["resolve","reject"])("same-session reentry fences late %s",async settle=>{
 const f=setup(),d=deferred();f.gateway.recruitTroop.mockReturnValueOnce(d.promise);const a=f.scene.recruit();f.scene.leave();
 f.scene.marchSnapshotGeneration++;f.scene.status="reentered";
 if(settle==="resolve")d.resolve(response);else d.reject(new Error("old"));await a;
 expect(f.scene.status).toBe("reentered");expect(f.scene.recruitTroopSubmitState).toBe("idle");expect(f.scene.queuePanels.addRecruitEntry).not.toHaveBeenCalled();
});
it("session replacement with matching actor cannot inherit an old receipt",async()=>{
 const f=setup(),d=deferred();f.gateway.recruitTroop.mockReturnValueOnce(d.promise);const a=f.scene.recruit();f.scene.session={...f.scene.session};d.resolve(response);await a;expect(f.scene.session.wallet.food).toBe(900);
});
it("insufficient funds never creates an owner or sends a command",async()=>{
 const f=setup();f.scene.session.wallet={food:0,wood:0,stone:0,iron:0};await f.scene.recruit();expect(f.gateway.recruitTroop).not.toHaveBeenCalled();expect(f.scene.recruitSubmitOwner).toBeNull();
});
