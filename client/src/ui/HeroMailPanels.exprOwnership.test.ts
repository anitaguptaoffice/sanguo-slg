import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const panels:HeroMailPanels[]=[];const flush=()=>new Promise(r=>setTimeout(r,0));
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
beforeEach(()=>sessionStorage.clear());afterEach(()=>{panels.splice(0).forEach(p=>p.detach());document.body.innerHTML="";});
const actions=["cancel","finish","faster"] as const;
const result=(action:string)=>action==="cancel"?{hero_id:7,status:1}:{hero_id:7,status:1,exp:320,exp_gained:40};
async function setup(action:typeof actions[number]){
 let generation=1;const detail=(id:number)=>({hero_id:id,template_cfg_id:1001,template_name:id===7?"Hero A":"Hero B",level:id===7?2:5,exp:id===7?280:900,exp_toward_next:80,upgrade_exp_required:100});
 const gateway={getBoundServerId:()=>1,getSessionId:()=>"t",getSessionGeneration:()=>generation,listPlayerBag:vi.fn(async()=>({items:[]})),listPlayerHeroes:vi.fn(async()=>({heroes:[{hero_id:7,level:2},{hero_id:9,level:5}],total_count:2})),getHeroDetail:vi.fn(async(_sid:number,id:number)=>detail(id)),beginHeroExpr:vi.fn(async()=>({hero_id:7,status:4,ends_at_ms:Date.now()+(action==="finish"?-1:3600000),gold_spent:20,hours:1})),cancelHeroExpr:vi.fn(),finishHeroExpr:vi.fn(),fasterHeroExpr:vi.fn()};
 const session={serverId:1,cityId:1,player:{player_id:1},wallet:{gold:10000},bag:[],buildings:[],cityTroops:[]} as MainCitySession;
 const mount=document.createElement("div");document.body.append(mount);const status=vi.fn(),patch=vi.fn(p=>Object.assign(session,p));const panel=new HeroMailPanels(mount,gateway as unknown as GatewayPort,()=>session,patch,status);panels.push(panel);panel.attach();panel.toggleHero();await flush();
 const click=async(id:number)=>{mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();await flush();};await click(7);
 const button=(name:string)=>mount.querySelector<HTMLButtonElement>(`[data-action="hero-expr-${name}"]`)!;button("begin").click();await flush();patch.mockClear();
 const rpc=gateway[action==="cancel"?"cancelHeroExpr":action==="finish"?"finishHeroExpr":"fasterHeroExpr"],d=deferred();rpc.mockReturnValueOnce(d.promise);
 return {panel,raw:panel as any,mount,status,patch,session,gateway,click,button,rpc,d,relogin:()=>{generation++;}};
}
it.each(actions)("%s late receipt preserves A success without corrupting B",async action=>{
 const f=await setup(action);f.button(action).click();await f.click(9);f.status.mockClear();f.d.resolve(result(action));await flush();
 expect(f.raw.selectedHeroId).toBe(9);expect(f.raw.heroDetail).toMatchObject({hero_id:9,template_name:"Hero B",level:5,exp:900});expect(f.raw.heroes.find((h:any)=>h.hero_id===7).level).toBe(2);expect(f.raw.heroes.find((h:any)=>h.hero_id===7).status).toBe(1);expect(f.status).not.toHaveBeenCalled();expect(f.patch).not.toHaveBeenCalled();expect(f.session.wallet.gold).toBe(9980);
 await f.click(7);expect(f.raw.heroDetail.expr_ends_at_ms).toBeUndefined();expect(f.rpc).toHaveBeenCalledTimes(1);
});
it.each(actions)("%s late failure does not overwrite B feedback",async action=>{
 const f=await setup(action);f.button(action).click();await f.click(9);f.status.mockClear();f.d.reject(new Error("old failure"));await flush();expect(f.raw.heroDetail.hero_id).toBe(9);expect(f.status).not.toHaveBeenCalled();expect(f.mount.querySelector('[data-role="hero-expr-form-error"]')?.textContent??"").not.toContain("old failure");expect(f.raw.heroExprSubmitState).toBe("idle");
});
it.each(actions)("%s actor change ignores old receipt and old cache",async action=>{
 const f=await setup(action);f.button(action).click();f.relogin();await f.click(7);f.status.mockClear();f.d.resolve(result(action));await flush();expect(f.status).not.toHaveBeenCalled();expect(f.patch).not.toHaveBeenCalled();expect(f.raw.heroDetail.expr_ends_at_ms).toBeUndefined();expect(f.raw.heroDetail.exp).toBe(280);
});
it.each(actions)("%s current receipt preserves ordinary behavior and no replay",async action=>{
 const f=await setup(action);f.button(action).click();f.button(action).click();f.d.resolve(result(action));await flush();expect(f.rpc).toHaveBeenCalledTimes(1);expect(f.raw.heroDetail).toMatchObject({hero_id:7,level:2,status:1,exp:action==="cancel"?280:320});expect(f.raw.heroExprSubmitState).toBe("idle");expect(f.patch).not.toHaveBeenCalled();
});
it.each(["close","detach"])("settlement after %s retains original success without presentation",async mode=>{
 const f=await setup("finish");f.button("finish").click();if(mode==="close")f.panel.toggleHero();else f.panel.detach();f.status.mockClear();f.d.resolve(result("finish"));await flush();expect(f.status).not.toHaveBeenCalled();expect(f.raw.heroes.find((h:any)=>h.hero_id===7).exp).toBe(320);if(mode==="detach")f.panel.attach();await f.panel.openHeroDetailDeepLink(7);await flush();expect(f.raw.heroDetail.expr_ends_at_ms).toBeUndefined();
});
it("same-hero newer detail is read afresh after settlement, not overwritten with an older level",async()=>{
 const f=await setup("finish"),read=deferred();f.button("finish").click();f.gateway.getHeroDetail.mockReturnValueOnce(read.promise);const viewing=f.raw.loadHeroDetail(7);f.gateway.getHeroDetail.mockResolvedValue({hero_id:7,template_cfg_id:1001,template_name:"Hero A",level:3,exp:320,exp_toward_next:20,upgrade_exp_required:200});
 f.d.resolve(result("finish"));await flush();read.resolve({hero_id:7,level:2,exp:280});await viewing;await flush();expect(f.raw.heroDetail).toMatchObject({hero_id:7,level:3,exp:320});expect(f.raw.heroDetail.expr_ends_at_ms).toBeUndefined();expect(f.rpc).toHaveBeenCalledTimes(1);
});
it("same-view unrelated stat/level updates survive the settlement",async()=>{
 const f=await setup("finish");f.button("finish").click();f.raw.heroDetail={...f.raw.heroDetail,level:3,loyalty:99,exp:300,exp_current:0,exp_to_next:200};f.d.resolve(result("finish"));await flush();expect(f.raw.heroDetail).toMatchObject({hero_id:7,level:3,loyalty:99,exp:320,exp_current:20});
});
it("mismatched receipt is rejected without polluting either hero",async()=>{
 const f=await setup("finish");f.button("finish").click();f.d.resolve({...result("finish"),hero_id:9});await flush();expect(f.raw.heroDetail.hero_id).toBe(7);expect(f.raw.heroDetail.exp).toBe(280);expect(f.raw.heroExprSubmitState).toBe("error");expect(f.patch).not.toHaveBeenCalled();
});
it("current failure preserves training snapshot and permits an explicit later action",async()=>{
 const f=await setup("cancel");f.button("cancel").click();f.d.reject(new Error("current error"));await flush();expect(f.raw.heroExprSubmitState).toBe("error");expect(f.raw.heroDetail.status).toBe(4);expect(f.status).toHaveBeenLastCalledWith(expect.stringContaining("current error"));expect(f.rpc).toHaveBeenCalledTimes(1);
});
it("global single-flight remains effective after switching away and back",async()=>{
 const f=await setup("finish");f.button("finish").click();await f.click(9);await f.click(7);f.button("finish").click();f.button("begin").click();expect(f.rpc).toHaveBeenCalledTimes(1);expect(f.gateway.beginHeroExpr).toHaveBeenCalledTimes(1);f.d.resolve(result("finish"));await flush();
});
