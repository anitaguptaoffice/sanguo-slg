import { expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
function deferred() { let resolve!: (v: any) => void, reject!: (e: Error) => void; const promise = new Promise<any>((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
function setup() {
 let token="a", generation=1;
 const scene=new MainCityScene() as unknown as Record<string,any>;
 const session={serverId:1,player:{player_id:1},cityId:1,buildings:[{slot_key:"hall",building_cfg_id:1,level:1}],wallet:{gold:900,wood:900,stone:900,food:900}};
 const gateway={getSessionId:()=>token,getSessionGeneration:()=>generation,getBoundServerId:()=>1,startBuildingUpgrade:vi.fn()};
 Object.assign(scene,{session,gateway,buildingPanel:{setFormError:vi.fn(),sync:vi.fn(),detach:vi.fn()},hud:document.createElement("div"),renderHud:vi.fn(),syncMilitaryPanel:vi.fn(),refreshState:vi.fn().mockResolvedValue(undefined),cityStateFetch:{clear:vi.fn()},marchList:{detach:vi.fn()}});
 return {scene,gateway,relogin(){token="b";generation++;}};
}
const response={wallet:{gold:0,wood:5,stone:5,food:5},building:{slot_key:"hall",building_cfg_id:1,level:2}};
it.each(["city","player","server","relogin","leave"])("ignores old build success after %s",async change=>{
 const f=setup(),d=deferred();f.gateway.startBuildingUpgrade.mockReturnValueOnce(d.promise);const request=f.scene.startBuildingUpgrade("hall",1);
 if(change==="relogin")f.relogin();else if(change==="leave")f.scene.leave();else if(change==="city")f.scene.session.cityId=2;else if(change==="server")f.scene.session.serverId=2;else f.scene.session.player.player_id=2;
 f.scene.status="new view";d.resolve(response);await request;
 expect(f.scene.session.wallet.food).toBe(900);expect(f.scene.session.buildings[0].level).toBe(1);expect(f.scene.status).toBe("new view");expect(f.scene.refreshState).not.toHaveBeenCalled();
});
it.each(["resolve","reject"])("old %s cannot release newer actor pending build",async settle=>{
 const f=setup(),old=deferred(),next=deferred();f.gateway.startBuildingUpgrade.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
 const a=f.scene.startBuildingUpgrade("hall",1);f.relogin();const b=f.scene.startBuildingUpgrade("hall",1);
 if(settle==="resolve")old.resolve(response);else old.reject(new Error("old failure"));await a;
 expect(f.scene.buildSubmitState).toBe("submitting");expect(f.scene.session.wallet.food).toBe(900);
 next.resolve(response);await b;expect(f.scene.session.wallet.food).toBe(5);expect(f.scene.buildSubmitState).toBe("idle");
});
it("preserves valid success and failure and rejects duplicate pending commands",async()=>{
 const f=setup(),d=deferred();f.gateway.startBuildingUpgrade.mockReturnValueOnce(d.promise);const a=f.scene.startBuildingUpgrade("hall",1);await f.scene.startBuildingUpgrade("hall",1);
 expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);d.resolve(response);await a;
 expect(f.scene.session.buildings[0].level).toBe(2);expect(f.scene.refreshState).toHaveBeenCalledTimes(1);
 f.gateway.startBuildingUpgrade.mockRejectedValueOnce(new Error("current failure"));await f.scene.startBuildingUpgrade("hall",1);
 expect(f.scene.buildSubmitState).toBe("error");expect(f.scene.buildingPanel.setFormError).toHaveBeenLastCalledWith(expect.stringContaining("current failure"));
});
it("exit resets build pending and ignores late errors",async()=>{
 const f=setup(),d=deferred();f.gateway.startBuildingUpgrade.mockReturnValueOnce(d.promise);const a=f.scene.startBuildingUpgrade("hall",1);f.scene.leave();expect(f.scene.buildSubmitState).toBe("idle");d.reject(new Error("late"));await a;expect(f.scene.buildSubmitState).toBe("idle");
});
it("does not publish success after actor changes during follow-up refresh",async()=>{
 const f=setup(),d=deferred();f.gateway.startBuildingUpgrade.mockResolvedValueOnce(response);f.scene.refreshState.mockReturnValueOnce(d.promise);const a=f.scene.startBuildingUpgrade("hall",1);await Promise.resolve();f.relogin();f.scene.status="new view";d.resolve(undefined);await a;expect(f.scene.status).toBe("new view");
});
it.each(["fetch","coords","minimap"])("build refresh stops after actor loss during %s",async stage=>{
 const f=setup(),d=deferred();
 f.gateway.startBuildingUpgrade.mockResolvedValueOnce(response);
 f.scene.refreshState=(MainCityScene.prototype as any).refreshState;
 f.scene.cityStateFetch.fetch=vi.fn(()=>stage==="fetch"?d.promise:Promise.resolve(null));
 f.scene.syncSessionCityCoords=vi.fn(()=>stage==="coords"?d.promise:Promise.resolve());
 f.scene.refreshMinimapMarches=vi.fn(()=>stage==="minimap"?d.promise:Promise.resolve());
 f.scene.applyCityStateFromFetch=vi.fn();
 const a=f.scene.startBuildingUpgrade("hall",1);
 await vi.waitFor(()=>expect(stage==="fetch"?f.scene.cityStateFetch.fetch:stage==="coords"?f.scene.syncSessionCityCoords:f.scene.refreshMinimapMarches).toHaveBeenCalled());
 f.relogin();f.scene.status="new view";d.resolve(null);await a;expect(f.scene.status).toBe("new view");
 if(stage==="fetch")expect(f.scene.syncSessionCityCoords).not.toHaveBeenCalled();
});
it("build-triggered coordinate read cannot apply old actor data",async()=>{
 const f=setup(),d=deferred();
 f.gateway.startBuildingUpgrade.mockResolvedValueOnce(response);
 f.scene.refreshState=(MainCityScene.prototype as any).refreshState;
 f.scene.syncSessionCityCoords=(MainCityScene.prototype as any).syncSessionCityCoords;
 f.scene.cityStateFetch.fetch=vi.fn().mockResolvedValue(null);
 (f.gateway as any).listPlayerCities=vi.fn(()=>d.promise);
 f.scene.refreshMinimapMarches=vi.fn();f.scene.session.cityX=60;
 const a=f.scene.startBuildingUpgrade("hall",1);await vi.waitFor(()=>expect((f.gateway as any).listPlayerCities).toHaveBeenCalled());
 f.relogin();f.scene.session.cityX=99;d.resolve({cities:[{city_id:1,x:10,y:20}]});await a;
 expect(f.scene.session.cityX).toBe(99);expect(f.scene.refreshMinimapMarches).not.toHaveBeenCalled();
});

it("keeps submitting state until the command follow-up refresh settles",async()=>{
 const f=setup(),d=deferred();f.gateway.startBuildingUpgrade.mockResolvedValueOnce(response);f.scene.refreshState.mockReturnValueOnce(d.promise);
 const a=f.scene.startBuildingUpgrade("hall",1);await Promise.resolve();expect(f.scene.buildSubmitState).toBe("submitting");
 await f.scene.startBuildingUpgrade("hall",1);expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);
 d.resolve(undefined);await a;expect(f.scene.buildSubmitState).toBe("idle");
});
