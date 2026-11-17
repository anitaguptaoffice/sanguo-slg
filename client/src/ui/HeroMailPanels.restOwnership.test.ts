import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readHeroMarchForceSession, writeHeroMarchForceSession, clearHeroMarchForceSession } from "@/net/heroMarchForceSession";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const flush=()=>new Promise(r=>setTimeout(r,0));
const panels:HeroMailPanels[]=[];
beforeEach(()=>sessionStorage.clear());
afterEach(()=>{vi.restoreAllMocks();panels.splice(0).forEach(p=>p.detach());document.body.innerHTML="";});
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const detail=(id:number)=>({hero_id:id,template_cfg_id:1001,template_name:`Hero ${id}`,level:1,march_force:5,march_force_max:24,exp_toward_next:1000,upgrade_exp_required:100});
async function setup(){
 let token="a",generation=1;
 const gateway={upgradeHero:vi.fn(async()=>({hero_id:7,previous_level:1,level:2,exp_current:1000,exp_to_next:100})),getSessionId:()=>token,getSessionGeneration:()=>generation,getBoundServerId:()=>1,listPlayerBag:vi.fn(async()=>({items:[]})),listPlayerHeroes:vi.fn(async()=>({heroes:[{hero_id:7,level:1},{hero_id:8,level:1}],total_count:2})),getHeroDetail:vi.fn(async (_s:number,id:number)=>detail(id)),restHero:vi.fn(async(_s:number,id:number)=>({hero_id:id,previous_level:1,level:2}))};
 const mount=document.createElement("div");document.body.append(mount);
 const session={serverId:1,cityId:1,player:{player_id:1},wallet:{},buildings:[],cityTroops:[],bag:[]} as MainCitySession;
 const status=vi.fn();const panel=new HeroMailPanels(mount,gateway as unknown as GatewayPort,()=>session,()=>{},status);panels.push(panel);panel.attach();panel.toggleHero();await flush();
 const click=(id:number)=>mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();
 return {panel,raw:panel as unknown as Record<string,any>,gateway,session,status,click,mount,detailText:()=>mount.querySelector('[data-role="hero-detail"]')?.textContent??"",relogin(){token="b";generation++;}};
}
const restButton=(f:Awaited<ReturnType<typeof setup>>)=>f.mount.querySelector<HTMLButtonElement>('[data-action="hero-force-rest"]')!;
const result=(id:number)=>({hero_id:id,march_force:24,march_force_max:24});
it("A rest success cannot replace selected B detail or status",async()=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();f.click(8);await flush();f.status.mockClear();a.resolve(result(7));await flush();
 expect(f.raw.selectedHeroId).toBe(8);expect(f.raw.heroDetail.hero_id).toBe(8);expect(f.raw.heroDetail.level).toBe(1);expect(f.detailText()).toContain("Hero 8");expect(f.status).not.toHaveBeenCalled();
});
it.each(["resolve","reject"])("old A %s cannot release B pending rest",async settle=>{
 const f=await setup(),a=deferred(),b=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);f.click(7);await flush();restButton(f).click();f.click(8);await flush();expect(restButton(f).disabled).toBe(false);restButton(f).click();
 if(settle==="resolve")a.resolve(result(7));else a.reject(new Error("old failure"));await flush();expect(restButton(f).disabled).toBe(true);expect(f.raw.heroForceSubmitState).toBe("submitting");
 b.resolve(result(8));await flush();expect(f.raw.heroDetail.hero_id).toBe(8);expect(f.raw.heroDetail.march_force).toBe(24);expect(restButton(f).disabled).toBe(true);
});

it("valid A success persists A cache without borrowing B identity or level",async()=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();f.click(8);await flush();a.resolve(result(7));await flush();expect(readHeroMarchForceSession(7)?.current).toBe(24);expect(readHeroMarchForceSession(8)?.current).toBe(5);expect(f.raw.heroDetail.hero_id).toBe(8);
});
it("newer A cache survives delayed A rest, even with identical clock timestamps",async()=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();vi.spyOn(Date,"now").mockReturnValue(1000);writeHeroMarchForceSession(7,5,24);restButton(f).click();f.click(8);await flush();writeHeroMarchForceSession(7,5,24);a.resolve(result(7));await flush();expect(readHeroMarchForceSession(7)?.current).toBe(5);vi.restoreAllMocks();
});
it.each(["relogin","player"])("old actor rest never writes cache after %s",async action=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();if(action==="relogin")f.relogin();else f.session.player.player_id=2;f.status.mockClear();a.resolve(result(7));await flush();expect(readHeroMarchForceSession(7)?.current).toBe(5);expect(f.status).not.toHaveBeenCalled();
});

it.each(["close","back","detach","peer"])("settled rest preserves original cache but not presentation after %s",async action=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();if(action==="close")f.panel.toggleHero();else if(action==="back")f.raw.restoreHeroListFromReturnState();else if(action==="detach")f.panel.detach();else f.panel.openMailPanel();await flush();f.status.mockClear();a.resolve(result(7));await flush();expect(readHeroMarchForceSession(7)?.current).toBe(24);expect(f.status).not.toHaveBeenCalled();
});
it("A B A stays locked then rereads instead of applying obsolete result",async()=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();f.click(8);await flush();f.click(7);await flush();expect(restButton(f).disabled).toBe(true);restButton(f).click();f.gateway.getHeroDetail.mockResolvedValueOnce({...detail(7),march_force:14});a.resolve(result(7));await flush();await flush();expect(f.raw.heroDetail.march_force).toBe(14);expect(f.gateway.restHero).toHaveBeenCalledTimes(1);
});
it("clearing A cache while pending prevents stale refill",async()=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();f.click(8);await flush();clearHeroMarchForceSession(7);a.resolve(result(7));await flush();expect(readHeroMarchForceSession(7)).toBeNull();
});
it("current failure retries and wrong response ID cannot mutate detail or cache",async()=>{
 const f=await setup();f.click(7);await flush();f.gateway.restHero.mockRejectedValueOnce(new Error("failed"));restButton(f).click();await flush();expect(f.raw.heroForceSubmitState).toBe("error");f.gateway.restHero.mockResolvedValueOnce(result(8));restButton(f).click();await flush();expect(f.raw.heroDetail.hero_id).toBe(7);expect(readHeroMarchForceSession(7)?.current).toBe(5);f.gateway.restHero.mockResolvedValueOnce(result(7));restButton(f).click();await flush();expect(f.raw.heroDetail.march_force).toBe(24);
});
it("new actor same hero request remains locked when old actor finishes",async()=>{
 const f=await setup(),a=deferred(),b=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);f.click(7);await flush();restButton(f).click();f.relogin();f.click(7);await flush();restButton(f).click();a.resolve(result(7));await flush();expect(f.raw.heroForceSubmitState).toBe("submitting");expect(readHeroMarchForceSession(7)?.current).toBe(5);b.resolve(result(7));await flush();expect(f.raw.heroDetail.march_force).toBe(24);
});

it.each([false,true])("concurrent accepted upgrade keeps newer force cap, switch B=%s",async switchB=>{
 const f=await setup(),a=deferred();f.gateway.restHero.mockReturnValueOnce(a.promise);f.click(7);await flush();restButton(f).click();f.mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!.click();await flush();expect(f.raw.heroDetail.march_force_max).toBe(28);
 if(switchB){f.click(8);await flush();}else f.gateway.getHeroDetail.mockResolvedValueOnce({...detail(7),level:2,march_force:24,march_force_max:28});
 a.resolve(result(7));await flush();await flush();expect(f.gateway.restHero).toHaveBeenCalledTimes(1);if(switchB){expect(f.raw.heroDetail.hero_id).toBe(8);expect(readHeroMarchForceSession(7)?.current).toBe(5);}else{expect(f.raw.heroDetail.level).toBe(2);expect(f.raw.heroDetail.march_force_max).toBe(28);}
});
