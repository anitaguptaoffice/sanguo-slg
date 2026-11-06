import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MarchListPanel } from "./MarchListPanel";
import { WorldPanels } from "./WorldPanels";
import { MILITARY_LIST_FILTER_SESSION_KEY } from "@/net/militaryListFilter";
const dispose:Array<()=>void>=[];
beforeEach(()=>sessionStorage.clear());afterEach(()=>{dispose.splice(0).forEach(fn=>fn());});
async function setup(){
 const mount=document.createElement("div"), grid={x:60,y:60};
 const marches=[{march_id:1,to_x:60,to_y:60,phase:2,purpose:1},{march_id:2,to_x:10,to_y:20,phase:2,purpose:1}];
 const gateway={listMarches:vi.fn().mockResolvedValue({marches,total:2}),listPlayerCities:vi.fn().mockResolvedValue({cities:[{city_id:1,x:60,y:60,name:"A"},{city_id:2,x:10,y:20,name:"B"}]})};
 const panel=new MarchListPanel(mount,gateway as never,()=>1,vi.fn(),{getWorldSelectedGrid:()=>grid});panel.attach();panel.toggle();
 await vi.waitFor(()=>expect(mount.querySelector('li[data-march-id="2"]')).toBeTruthy());dispose.push(()=>panel.detach());
 const ids=()=>Array.from(mount.querySelectorAll('li[data-march-id]')).map(el=>Number(el.getAttribute("data-march-id")));
 return {panel,mount,grid,marches,gateway,ids};
}
it.each(["world","manual"])("destination link reveals B under old %s A filter",async mode=>{
 const f=await setup();if(mode==="world")f.panel.syncWorldGridSelection(f.grid);else f.panel.setDestFilter(60,60);
 expect(f.panel.selectMarchByDest(10,20)).toBe(true);expect(f.panel.getSelectedMarchId()).toBe(2);expect(f.ids()).toContain(2);expect(f.panel.getDestFilter()).toEqual({x:10,y:20});
});
it.each(["return","pending","stationed"])("destination link clears incompatible phase %s but retains ETA sort",async phase=>{
 const f=await setup();(f.panel as any).setListFilter({phase,etaSort:"eta_desc"});f.panel.selectMarchByDest(10,20);
 expect(f.ids()).toContain(2);expect((f.panel as any).listFilter).toEqual({phase:"all",etaSort:"eta_desc"});expect(JSON.parse(sessionStorage.getItem(MILITARY_LIST_FILTER_SESSION_KEY)!)).toEqual({phase:"all",etaSort:"eta_desc"});
});
it("compatible filters remain unchanged and manual filtering still works afterwards",async()=>{
 const f=await setup();f.panel.setDestFilter(10,20);(f.panel as any).setListFilter({phase:"outbound",etaSort:"eta_desc"});f.panel.selectMarchByDest(10,20);
 expect((f.panel as any).listFilter.phase).toBe("outbound");expect(f.panel.getDestFilter()).toEqual({x:10,y:20});f.panel.setDestFilter(60,60);expect(f.ids()).toEqual([1]);
});
it.each([[99,99],[NaN,20]])("missing/invalid destination %s,%s is a no-op",async(x,y)=>{
 const f=await setup();f.panel.setDestFilter(60,60);f.panel.selectMarchById(1);(f.panel as any).setListFilter({phase:"outbound",etaSort:"eta_desc"});
 expect(f.panel.selectMarchByDest(x,y)).toBe(false);expect(f.panel.getSelectedMarchId()).toBe(1);expect(f.panel.getDestFilter()).toEqual({x:60,y:60});expect((f.panel as any).listFilter.phase).toBe("outbound");
});
it("phase transition stays visible after an incompatible phase was cleared",async()=>{
 const f=await setup();(f.panel as any).setListFilter({phase:"return",etaSort:"eta_asc"});f.panel.selectMarchByDest(10,20);f.gateway.listMarches.mockResolvedValueOnce({marches:[f.marches[0],{...f.marches[1],phase:3}],total:2});await(f.panel as any).refreshList();expect(f.ids()).toContain(2);expect(f.panel.getSelectedMarchId()).toBe(2);
});
it("authoritative disappearance clears selection without fabricating a row",async()=>{
 const f=await setup();f.panel.selectMarchByDest(10,20);f.gateway.listMarches.mockResolvedValueOnce({marches:[f.marches[0]],total:1});await(f.panel as any).refreshList();expect(f.panel.getSelectedMarchId()).toBeNull();expect(f.ids()).not.toContain(2);
});
it("production world B count click reveals B while world selection remains A",async()=>{
 const f=await setup(),form=document.createElement("div");form.innerHTML='<input data-field="to-x"><input data-field="to-y">';
 const world=new WorldPanels(f.mount,f.gateway as never,()=>({cityId:1,player:{},wallet:{},buildings:[],cityTroops:[],bag:[]}) as never,{marchFormRoot:form},vi.fn(),{getMarchesSnapshot:()=>f.marches,onGridSelectionChange:g=>{if(g)Object.assign(f.grid,g);f.panel.syncWorldGridSelection(g);},onMarchCountClick:g=>f.panel.selectMarchByDest(g.x,g.y)});world.attach();dispose.push(()=>world.detach());world.toggle();
 await vi.waitFor(()=>expect(f.mount.querySelector('li[data-city-id="1"]')).toBeTruthy());f.mount.querySelector('li[data-city-id="1"]')!.dispatchEvent(new MouseEvent("click",{bubbles:true}));
 f.mount.querySelector<HTMLButtonElement>('button[data-action="world-march-count"][data-x="10"]')!.click();await Promise.resolve();
 expect(world.getSelectedGrid()).toEqual({x:60,y:60});expect(f.panel.isOpen()).toBe(true);expect(f.panel.getSelectedMarchId()).toBe(2);expect(f.ids()).toContain(2);
});
it("unavailable world grid becomes an explicit target while all mode stays all",async()=>{
 const f=await setup();(f.panel as any).getWorldSelectedGrid=()=>null;f.panel.setDestFilterMode("world");f.panel.selectMarchByDest(10,20);expect(f.ids()).toContain(2);expect(f.panel.getDestFilter()).toEqual({x:10,y:20});
 f.panel.setDestFilterMode("all");f.panel.selectMarchByDest(10,20);expect(f.panel.getDestFilter()).toBeNull();expect(f.ids()).toContain(1);
});
