import { beforeEach, expect, it, vi } from "vitest";
import { ContentPanels } from "./ContentPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const food={offer_id:1001,item_cfg_id:2001,quantity_per_purchase:1,price_resources:{gold:10},purchase_limit:3,purchased_count:0};
const speedup={...food,offer_id:1002,item_cfg_id:2003};
function deferred(){let resolve!:(v:any)=>void,reject!:(e:Error)=>void;const promise=new Promise<any>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
beforeEach(()=>sessionStorage.clear());
async function setup(offers=[food]) {
 const session={serverId:1,cityId:1,player:{player_id:1},wallet:{gold:100},bag:[],buildings:[],cityTroops:[]} as MainCitySession;
 const purchase=vi.fn(()=>new Promise(()=>{})),shelf=vi.fn().mockResolvedValue({offers});
 const gateway={getSessionId:()=>"t",getSessionGeneration:()=>1,getBoundServerId:()=>1,listShopShelf:shelf,purchaseShopOffer:purchase} as unknown as GatewayPort;
 const mount=document.createElement("div");document.body.append(mount);
 const panels=new ContentPanels(mount,gateway,()=>session,vi.fn(),vi.fn());panels.attach();panels.toggleShop();
 await vi.waitFor(()=>expect(mount.querySelector('[data-offer-id="1001"]')).toBeTruthy());
 const buy=mount.querySelector<HTMLButtonElement>('[data-action="buy-offer"]')!;
 const category=(name:string)=>mount.querySelector<HTMLButtonElement>(`[data-shop-category="${name}"]`)!.click();
 const selected=()=>mount.querySelector<HTMLSelectElement>('[data-field="offer-id"]')!.value;
 return {panels,mount,purchase,shelf,buy,category,selected};
}
it.each(["speedup","other"])("empty %s cannot buy a hidden resource offer",async category=>{
 const f=await setup();f.category(category);expect(f.selected()).toBe("");expect(f.buy.disabled).toBe(true);f.buy.click();expect(f.purchase).not.toHaveBeenCalled();
});
it("synthetic clicks cannot bypass empty-category eligibility",async()=>{
 const f=await setup();f.category("speedup");f.buy.dispatchEvent(new MouseEvent("click",{bubbles:true}));expect(f.purchase).not.toHaveBeenCalled();
});
it("returning to a populated category selects and purchases its visible offer",async()=>{
 const f=await setup();f.category("other");f.category("resource");expect(f.selected()).toBe("1001");expect(f.buy.disabled).toBe(false);f.buy.click();expect(f.purchase).toHaveBeenCalledWith(1,1001,1);
});
it("switching populated categories targets the displayed choice",async()=>{
 const f=await setup([food,speedup]);f.category("speedup");expect(f.selected()).toBe("1002");f.buy.click();expect(f.purchase).toHaveBeenCalledWith(1,1002,1);
});
it("refresh preserves a still-visible explicit selection",async()=>{
 const f=await setup([food,{...food,offer_id:1003}]);const select=f.mount.querySelector<HTMLSelectElement>('[data-field="offer-id"]')!;select.value="1003";select.dispatchEvent(new Event("change",{bubbles:true}));await (f.panels as any).refreshShop();expect(f.selected()).toBe("1003");f.buy.click();expect(f.purchase).toHaveBeenCalledWith(1,1003,1);
});
it("error view cannot purchase its old hidden row even through synthetic dispatch",async()=>{
 const f=await setup();f.shelf.mockRejectedValueOnce(new Error("offline"));await (f.panels as any).refreshShop();expect(f.buy.disabled).toBe(true);f.buy.dispatchEvent(new MouseEvent("click",{bubbles:true}));expect(f.purchase).not.toHaveBeenCalled();
});
it("loading view blocks dispatch and empty refresh clears selection",async()=>{
 const f=await setup(),d=deferred();f.shelf.mockReturnValueOnce(d.promise);const read=(f.panels as any).refreshShop();f.buy.dispatchEvent(new MouseEvent("click",{bubbles:true}));expect(f.purchase).not.toHaveBeenCalled();d.resolve({offers:[]});await read;expect(f.selected()).toBe("");expect((f.panels as any).selectedOfferId).toBe(0);expect(f.buy.disabled).toBe(true);
});
