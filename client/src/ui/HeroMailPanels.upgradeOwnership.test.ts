import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const flush=()=>new Promise(r=>setTimeout(r,0));
const panels:HeroMailPanels[]=[];
beforeEach(()=>sessionStorage.clear());
afterEach(()=>{panels.splice(0).forEach(p=>p.detach());document.body.innerHTML="";});
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const detail=(id:number)=>({hero_id:id,template_cfg_id:1001,template_name:`Hero ${id}`,level:1,exp_toward_next:1000,upgrade_exp_required:100});
async function setup(){
 let token="a",generation=1;
 const gateway={getSessionId:()=>token,getSessionGeneration:()=>generation,getBoundServerId:()=>1,listPlayerBag:vi.fn(async()=>({items:[]})),listPlayerHeroes:vi.fn(async()=>({heroes:[{hero_id:7,level:1},{hero_id:8,level:1}],total_count:2})),getHeroDetail:vi.fn(async (_s:number,id:number)=>detail(id)),upgradeHero:vi.fn(async(_s:number,id:number)=>({hero_id:id,previous_level:1,level:2}))};
 const mount=document.createElement("div");document.body.append(mount);
 const session={serverId:1,cityId:1,player:{player_id:1},wallet:{},buildings:[],cityTroops:[],bag:[]} as MainCitySession;
 const status=vi.fn();const panel=new HeroMailPanels(mount,gateway as unknown as GatewayPort,()=>session,()=>{},status);panels.push(panel);panel.attach();panel.toggleHero();await flush();
 const click=(id:number)=>mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();
 return {panel,raw:panel as unknown as Record<string,any>,gateway,session,status,click,mount,detailText:()=>mount.querySelector('[data-role="hero-detail"]')?.textContent??"",relogin(){token="b";generation++;}};
}
const upgradeButton=(f:Awaited<ReturnType<typeof setup>>)=>f.mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!;
const result=(id:number,level=2)=>({hero_id:id,previous_level:level-1,level,exp_current:1000,exp_to_next:100});
it("A upgrade success cannot replace selected B detail or status",async()=>{
 const f=await setup(),a=deferred();f.gateway.upgradeHero.mockReturnValueOnce(a.promise);f.click(7);await flush();upgradeButton(f).click();f.click(8);await flush();f.status.mockClear();a.resolve(result(7));await flush();
 expect(f.raw.selectedHeroId).toBe(8);expect(f.raw.heroDetail.hero_id).toBe(8);expect(f.raw.heroDetail.level).toBe(1);expect(f.detailText()).toContain("Hero 8");expect(f.status).not.toHaveBeenCalled();
});
it.each(["resolve","reject"])("old A %s cannot release B pending upgrade",async settle=>{
 const f=await setup(),a=deferred(),b=deferred();f.gateway.upgradeHero.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);f.click(7);await flush();upgradeButton(f).click();f.click(8);await flush();expect(upgradeButton(f).disabled).toBe(false);upgradeButton(f).click();
 if(settle==="resolve")a.resolve(result(7));else a.reject(new Error("old failure"));await flush();expect(upgradeButton(f).disabled).toBe(true);expect(f.raw.heroUpgradeSubmitState).toBe("submitting");
 b.resolve(result(8));await flush();expect(f.raw.heroDetail.hero_id).toBe(8);expect(f.raw.heroDetail.level).toBe(2);expect(upgradeButton(f).disabled).toBe(false);
});
it("A to B to A keeps A locked, then rereads authoritative A without resubmission",async()=>{
 const f=await setup(),a=deferred();f.gateway.upgradeHero.mockReturnValueOnce(a.promise);f.click(7);await flush();upgradeButton(f).click();f.click(8);await flush();f.click(7);await flush();expect(upgradeButton(f).disabled).toBe(true);upgradeButton(f).click();expect(f.gateway.upgradeHero).toHaveBeenCalledTimes(1);
 f.gateway.getHeroDetail.mockResolvedValueOnce({...detail(7),level:3});a.resolve(result(7,2));await flush();await flush();expect(f.raw.heroDetail.level).toBe(3);expect(f.gateway.upgradeHero).toHaveBeenCalledTimes(1);expect(upgradeButton(f).disabled).toBe(false);
});
it.each(["relogin","player","close","back","detach"])("old upgrade success has no presentation after %s",async action=>{
 const f=await setup(),a=deferred();f.gateway.upgradeHero.mockReturnValueOnce(a.promise);f.click(7);await flush();upgradeButton(f).click();
 if(action==="relogin")f.relogin();else if(action==="player")f.session.player.player_id=2;else if(action==="close")f.panel.toggleHero();else if(action==="back")f.raw.restoreHeroListFromReturnState();else f.panel.detach();
 f.status.mockClear();const calls=f.gateway.getHeroDetail.mock.calls.length;a.resolve(result(7));await flush();expect(f.status).not.toHaveBeenCalled();expect(f.gateway.getHeroDetail).toHaveBeenCalledTimes(calls);expect(f.raw.heroDetail?.level??1).toBe(1);
});
it("current success and error retry work, and mismatched response ID is rejected",async()=>{
 const f=await setup();f.click(7);await flush();f.gateway.upgradeHero.mockRejectedValueOnce(new Error("current failure"));upgradeButton(f).click();await flush();expect(f.raw.heroUpgradeSubmitState).toBe("error");
 f.gateway.upgradeHero.mockResolvedValueOnce(result(8));upgradeButton(f).click();await flush();expect(f.raw.heroDetail.hero_id).toBe(7);expect(f.raw.heroDetail.level).toBe(1);expect(f.raw.heroUpgradeSubmitState).toBe("error");
 f.gateway.upgradeHero.mockResolvedValueOnce(result(7));upgradeButton(f).click();await flush();expect(f.raw.heroDetail.level).toBe(2);expect(f.raw.heroUpgradeSubmitState).toBe("idle");
});
it("same hero after relogin can upgrade without old completion clearing its pending lock",async()=>{
 const f=await setup(),old=deferred(),next=deferred();f.gateway.upgradeHero.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);f.click(7);await flush();upgradeButton(f).click();f.relogin();f.click(7);await flush();expect(upgradeButton(f).disabled).toBe(false);upgradeButton(f).click();
 old.resolve(result(7));await flush();expect(upgradeButton(f).disabled).toBe(true);expect(f.raw.heroDetail.level).toBe(1);next.resolve(result(7));await flush();expect(f.raw.heroDetail.level).toBe(2);
});
it("newer same-hero detail never regresses to an older upgrade level",async()=>{
 const f=await setup(),a=deferred();f.gateway.upgradeHero.mockReturnValueOnce(a.promise);f.click(7);await flush();upgradeButton(f).click();
 f.gateway.getHeroDetail.mockResolvedValue({...detail(7),level:6});f.click(7);await flush();a.resolve(result(7,4));await flush();await flush();expect(f.raw.heroDetail.level).toBe(6);expect(f.gateway.upgradeHero).toHaveBeenCalledTimes(1);
});
it("settlement while a peer panel is foreground never reopens hero details",async()=>{
 const f=await setup(),a=deferred();f.gateway.upgradeHero.mockReturnValueOnce(a.promise);f.click(7);await flush();upgradeButton(f).click();f.panel.openMailPanel();await flush();f.status.mockClear();const reads=f.gateway.getHeroDetail.mock.calls.length;
 a.resolve(result(7));await flush();expect(f.panel.getHeroRoot().classList.contains("hidden")).toBe(true);expect(f.gateway.getHeroDetail).toHaveBeenCalledTimes(reads);expect(f.status).not.toHaveBeenCalled();
});
