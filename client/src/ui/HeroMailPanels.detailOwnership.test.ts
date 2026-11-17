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
 const gateway={getSessionId:()=>token,getSessionGeneration:()=>generation,getBoundServerId:()=>1,listPlayerBag:vi.fn(async()=>({items:[]})),listPlayerHeroes:vi.fn(async()=>({heroes:[{hero_id:7,level:1},{hero_id:8,level:1}],total_count:2})),getHeroDetail:vi.fn(),upgradeHero:vi.fn(async(_s:number,id:number)=>({hero_id:id,previous_level:1,level:2}))};
 const mount=document.createElement("div");document.body.append(mount);
 const session={serverId:1,cityId:1,player:{player_id:1},wallet:{},buildings:[],cityTroops:[],bag:[]} as MainCitySession;
 const status=vi.fn();const panel=new HeroMailPanels(mount,gateway as unknown as GatewayPort,()=>session,()=>{},status);panels.push(panel);panel.attach();panel.toggleHero();await flush();
 const click=(id:number)=>mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();
 return {panel,raw:panel as unknown as Record<string,any>,gateway,session,status,click,mount,detailText:()=>mount.querySelector('[data-role="hero-detail"]')?.textContent??"",relogin(){token="b";generation++;}};
}
it("reverse detail completion cannot show A while upgrade targets B",async()=>{
 const f=await setup(),a=deferred(),b=deferred();f.gateway.getHeroDetail.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);f.click(7);f.click(8);
 b.resolve(detail(8));await flush();a.resolve(detail(7));await flush();expect(f.detailText()).toContain("Hero 8");expect(f.detailText()).not.toContain("Hero 7");
 f.mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!.click();await flush();expect(f.gateway.upgradeHero).toHaveBeenCalledWith(1,8);
});
it("old rejection cannot end new loading or replace its eventual detail",async()=>{
 const f=await setup(),a=deferred(),b=deferred();f.gateway.getHeroDetail.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);f.click(7);f.click(8);a.reject(new Error("old failure"));await flush();expect(f.raw.heroDetailLoading).toBe(true);expect(f.detailText()).not.toContain("old failure");b.resolve(detail(8));await flush();expect(f.detailText()).toContain("Hero 8");
});
it("A to B to A uses the newest request, not matching ID alone",async()=>{
 const f=await setup(),a=deferred(),b=deferred(),next=deferred();f.gateway.getHeroDetail.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(next.promise);f.click(7);f.click(8);f.click(7);next.resolve({...detail(7),template_name:"Newest"});await flush();a.resolve(detail(7));b.resolve(detail(8));await flush();expect(f.detailText()).toContain("Newest");
});
it.each(["relogin","player","city","detach","back","close"])("invalidates pending detail after %s",async change=>{
 const f=await setup(),a=deferred();f.gateway.getHeroDetail.mockReturnValueOnce(a.promise);f.click(7);
 if(change==="relogin")f.relogin();else if(change==="player")f.session.player.player_id=2;else if(change==="city")f.session.cityId=2;else if(change==="detach")f.panel.detach();else if(change==="close")f.panel.toggleHero();else f.raw.restoreHeroListFromReturnState();
 f.status.mockClear();a.resolve(detail(7));await flush();expect(f.raw.heroDetail).toBeNull();expect(f.status).not.toHaveBeenCalled();
});
it("rejects mismatched identity and allows a later valid retry",async()=>{
 const f=await setup();f.gateway.getHeroDetail.mockResolvedValueOnce(detail(8)).mockResolvedValueOnce(detail(7));f.click(7);await flush();expect(f.raw.heroDetail).toBeNull();expect(f.raw.heroDetailError).toBeTruthy();f.click(7);await flush();expect(f.detailText()).toContain("Hero 7");
});
it("close and reopen invalidate the old detail even before list refresh finishes",async()=>{
 const f=await setup(),old=deferred(),list=deferred();f.gateway.getHeroDetail.mockReturnValueOnce(old.promise);f.click(7);f.panel.toggleHero();
 f.gateway.listPlayerHeroes.mockReturnValueOnce(list.promise);f.panel.toggleHero();old.resolve(detail(7));await flush();expect(f.raw.heroDetail).toBeNull();
 f.gateway.getHeroDetail.mockResolvedValueOnce(detail(7));list.resolve({heroes:[{hero_id:7,level:1},{hero_id:8,level:1}]});await flush();f.click(7);await flush();expect(f.detailText()).toContain("Hero 7");
});
it.each(["deep","highlight"])("late %s list wait cannot steal a newer hero selection",async path=>{
 const f=await setup(),list=deferred();f.gateway.listPlayerHeroes.mockReturnValueOnce(list.promise);f.gateway.getHeroDetail.mockResolvedValue(detail(8));
 if(path==="deep")f.raw.heroes=[];
 const pending=path==="deep"?f.panel.openHeroDetailDeepLink(7):f.panel.openAndHighlightHero(7);
 if(path==="deep")f.panel.openAndHighlightHero(8);else f.click(8);await flush();list.resolve({heroes:[{hero_id:7,level:1},{hero_id:8,level:1}]});await pending;await flush();
 expect(f.raw.selectedHeroId).toBe(8);expect(f.detailText()).toContain("Hero 8");expect(f.gateway.getHeroDetail).toHaveBeenCalledTimes(1);
});
it("list restore started before a click cannot overwrite the selected hero",async()=>{
 const f=await setup(),list=deferred();f.gateway.listPlayerHeroes.mockReturnValueOnce(list.promise);f.gateway.getHeroDetail.mockResolvedValue(detail(8));
 const pending=f.raw.refreshHeroes({restoreSelection:true});f.click(8);await flush();list.resolve({heroes:[{hero_id:7,level:1},{hero_id:8,level:1}]});await pending;
 expect(f.raw.selectedHeroId).toBe(8);expect(f.gateway.getHeroDetail).toHaveBeenCalledTimes(1);expect(f.detailText()).toContain("Hero 8");
});
it("highlight list wait removes old actionable detail before changing targets",async()=>{
 const f=await setup();f.gateway.getHeroDetail.mockResolvedValueOnce(detail(7));f.click(7);await flush();
 const list=deferred();f.gateway.listPlayerHeroes.mockReturnValueOnce(list.promise);f.panel.openAndHighlightHero(8);
 expect(f.raw.selectedHeroId).toBe(8);expect(f.detailText()).not.toContain("Hero 7");expect(f.mount.querySelector('[data-action="hero-upgrade"]')).toBeNull();
 f.gateway.getHeroDetail.mockResolvedValueOnce(detail(8));list.resolve({heroes:[{hero_id:7},{hero_id:8}]});await flush();expect(f.detailText()).toContain("Hero 8");
});
it("reopening during an old list request still restores saved detail",async()=>{
 const f=await setup();f.panel.toggleHero();sessionStorage.clear();sessionStorage.setItem("hero-detail-selected-id","7");
 const list=deferred();f.gateway.listPlayerHeroes.mockReturnValueOnce(list.promise);f.gateway.getHeroDetail.mockResolvedValue(detail(7));
 f.panel.toggleHero();f.panel.toggleHero();f.panel.toggleHero();list.resolve({heroes:[{hero_id:7},{hero_id:8}]});await flush();await flush();
 expect(f.raw.selectedHeroId).toBe(7);expect(f.detailText()).toContain("Hero 7");
});
it("restored detail completion after Back does not publish obsolete status",async()=>{
 const f=await setup();sessionStorage.setItem("hero-detail-selected-id","7");const d=deferred();f.gateway.getHeroDetail.mockReturnValueOnce(d.promise);
 const request=f.raw.refreshHeroes({restoreSelection:true});await flush();f.raw.restoreHeroListFromReturnState();f.status.mockClear();d.resolve(detail(7));await request;
 expect(f.status).not.toHaveBeenCalled();expect(f.raw.heroDetailCollapsed).toBe(true);
});

it("review: an older list finally cannot unlock a newer reopen list request", async () => {
 const f=await setup(); f.panel.toggleHero(); const old=deferred(), fresh=deferred();
 f.gateway.listPlayerHeroes.mockClear(); f.gateway.listPlayerHeroes.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
 f.panel.toggleHero(); f.panel.toggleHero(); f.panel.toggleHero();
 expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(2); expect(f.raw.heroesRefreshInflight).toBe(true);
 old.resolve({heroes:[{hero_id:7}]}); await flush();
 expect(f.raw.heroesRefreshInflight).toBe(true);
 await f.raw.refreshHeroes(); expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(2);
 fresh.resolve({heroes:[{hero_id:7},{hero_id:8}]}); await flush(); expect(f.raw.heroesRefreshInflight).toBe(false);
});

it("review: an old restore completion must not publish after switching to a peer panel", async () => {
 const f=await setup(); sessionStorage.setItem("hero-detail-selected-id","7"); const pending=deferred();
 f.gateway.getHeroDetail.mockReturnValueOnce(pending.promise); const refresh=f.raw.refreshHeroes({restoreSelection:true}); await flush();
 f.panel.openMailPanel(); await flush(); f.status.mockClear(); pending.resolve(detail(7)); await refresh;
 expect(f.status).not.toHaveBeenCalled(); expect(f.panel.getHeroRoot().classList.contains("hidden")).toBe(true);
});
it("actor change lets the same settled list request release its lock for retry",async()=>{
 const f=await setup(),d=deferred();f.gateway.listPlayerHeroes.mockReturnValueOnce(d.promise);const request=f.raw.refreshHeroes();
 f.relogin();d.resolve({heroes:[{hero_id:99}]});await request;expect(f.raw.heroesRefreshInflight).toBe(false);
 await f.raw.refreshHeroes();expect(f.raw.heroes.map((h:any)=>h.hero_id)).toEqual([7,8]);
});


it("review: pending list restoration cannot erase a newer valid non-listed deep link", async () => {
 const f=await setup(), list=deferred(), pending=deferred(); f.gateway.listPlayerHeroes.mockReturnValueOnce(list.promise);
 const restore=f.raw.refreshHeroes({restoreSelection:true}); f.gateway.getHeroDetail.mockReturnValue(pending.promise);
 const navigation=f.panel.openHeroDetailDeepLink(123);
 list.resolve({heroes:[{hero_id:7},{hero_id:8}]}); await flush();
 expect(f.raw.selectedHeroId).toBe(123); pending.resolve(detail(123)); await navigation; await restore;
 expect(f.detailText()).toContain("Hero 123");
});
it("detaching during a list read does not block loading after reattach",async()=>{
 const f=await setup(),d=deferred();f.gateway.listPlayerHeroes.mockReturnValueOnce(d.promise);const old=f.raw.refreshHeroes();f.panel.detach();
 f.panel.attach();f.panel.toggleHero();await flush();expect(f.raw.heroesRefreshInflight).toBe(false);expect(f.raw.heroes.map((h:any)=>h.hero_id)).toEqual([7,8]);
 d.resolve({heroes:[{hero_id:99}]});await old;expect(f.raw.heroes.map((h:any)=>h.hero_id)).toEqual([7,8]);
});
