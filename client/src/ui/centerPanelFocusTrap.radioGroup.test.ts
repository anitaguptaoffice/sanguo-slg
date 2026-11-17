import { afterEach, expect, it, vi } from "vitest";
import { createCenterPanelFocusTrap, listCenterPanelFocusables } from "./centerPanelFocusTrap";
import { listOverlayFocusables } from "./overlayFocusTrap";

const traps: ReturnType<typeof createCenterPanelFocusTrap>[] = [];
afterEach(() => { traps.splice(0).forEach(t => t.dispose()); document.body.replaceChildren(); });
function fixture(html = '<button id="first">first</button><input id="a" type="radio" name="g" checked><input id="b" type="radio" name="g">') {
  const root = document.createElement("div");
  root.innerHTML = html; document.body.append(root);
  const trigger = document.createElement("button"); document.body.append(trigger);
  const close = vi.fn(), trap = createCenterPanelFocusTrap(root, close);
  traps.push(trap); trap.setOpen(true, trigger);
  const node = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
  return { root, node, trigger, close, trap };
}
function key(target: HTMLElement, name = "Tab", shiftKey = false) {
  const event = new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(event); return event;
}
const ids = (root: HTMLElement, backward = false) => listCenterPanelFocusables(root, backward).map(n => n.id);

it.each(["a", "b"])("wraps selected %s and preserves the shared overlay list", selected => {
  const { root, node } = fixture();
  node(selected).checked = true; node(selected).focus();
  expect(ids(root)).toEqual(["first", selected]);
  expect(listOverlayFocusables(root).map(n => n.id)).toEqual(["first", "a", "b"]);
  expect(key(node(selected)).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(node("first"));
  expect(key(node("first"), "Tab", true).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(node(selected));
});

it("recomputes checked selection without caching, changing order or selecting a radio", () => {
  const { root, node } = fixture();
  expect(ids(root)).toEqual(["first", "a"]);
  node("b").checked = true;
  expect(ids(root)).toEqual(["first", "b"]);
  expect(node("a").checked).toBe(false);
  expect(node("b").checked).toBe(true);
});

it.each([false, true])("uses directional no-checked entry (reverse=%s)", backward => {
  const { root, node } = fixture(); node("a").checked = false;
  expect(ids(root, backward)).toEqual(["first", backward ? "b" : "a"]);
  expect([node("a").checked, node("b").checked]).toEqual([false, false]);
  if (backward) {
    expect(key(node("first"), "Tab", true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(node("b"));
  }
});

it.each(["a", "b"])("uses current no-checked member %s as the group exit", active => {
  const { root, node } = fixture(); node("a").checked = false; node(active).focus();
  expect(ids(root)).toEqual(["first", active]);
  expect(key(node(active)).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(node("first"));
  expect([node("a").checked, node("b").checked]).toEqual([false, false]);
});

it("preserves the exit position of a programmatically focused unchecked member", () => {
  const { root, node } = fixture('<input id="a" type="radio" name="g"><button id="middle">middle</button><input id="b" type="radio" name="g" checked>');
  node("a").focus();
  expect(ids(root)).toEqual(["a", "middle"]);
  expect(key(node("a")).defaultPrevented).toBe(false);
  expect(node("b").checked).toBe(true);
});

it.each([
  'disabled', 'tabindex="-1"', 'hidden', 'style="display:none"', 'style="visibility:hidden"',
])("ignores an ineligible checked sibling: %s", attrs => {
  const { root } = fixture(`<button id="first">first</button><input id="a" type="radio" name="g"><input id="b" type="radio" name="g" checked ${attrs}>`);
  expect(ids(root)).toEqual(["first", "a"]);
});

it.each([
  '<fieldset disabled>', '<div hidden>', '<div style="display:none">',
  '<div style="visibility:hidden">', '<details><summary>title</summary>',
])("ignores radios hidden/disabled by ancestor %s", opening => {
  const tag = opening.slice(1).split(/[ >]/)[0];
  const { root } = fixture(`<button id="first">first</button><input id="a" type="radio" name="g">${opening}<input id="b" type="radio" name="g" checked></${tag}>`);
  expect(ids(root)).toEqual(["first", "a"]);
});

it("retains an explicitly visible radio under a visibility-hidden ancestor", () => {
  const { root, node } = fixture('<button id="first">first</button><div style="visibility:hidden"><input id="a" type="radio" name="g" checked style="visibility:visible"><input id="b" type="radio" name="g" style="visibility:visible"></div>');
  expect(getComputedStyle(node("a")).visibility).toBe("visible");
  expect(ids(root)).toEqual(["first", "a"]);
  node("a").focus();
  expect(key(node("a")).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(node("first"));
});

it("keeps a radio in a closed disclosure summary and excludes inert radio ancestry", () => {
  const { root, node } = fixture('<button id="first">first</button><details><summary><input id="a" type="radio" name="g"></summary><input id="b" type="radio" name="g"></details>');
  expect(ids(root)).toEqual(["first", "a"]);
  node("a").parentElement!.inert = true;
  expect(ids(root)).toEqual(["first"]);
});

it("does not conflate names, unnamed radios or different form owners", () => {
  const { root } = fixture('<button id="first">first</button><form id="f1"></form><form id="f2"></form>' +
    '<input id="a" type="radio" name="g" form="f1" checked><input id="b" type="radio" name="g" form="f2" checked>' +
    '<input id="c" type="radio" name="other" checked><input id="d" type="radio"><input id="e" type="radio">');
  expect(ids(root)).toEqual(["first", "a", "b", "c", "d", "e"]);
});

it("groups external form-associated descendants with the same actual owner", () => {
  const { root, node } = fixture('<button id="first">first</button><form id="owner"></form>' +
    '<input id="a" type="radio" name="g" form="owner" checked><input id="b" type="radio" name="g" form="owner">');
  expect(node("a").form).toBe(node("b").form);
  expect(ids(root)).toEqual(["first", "a"]);
});

it("does not merge same-name radios across actual tree roots", () => {
  const { root } = fixture();
  const host = document.createElement("div"); root.append(host);
  const shadow = host.attachShadow({ mode: "open" }), inside = document.createElement("div");
  inside.innerHTML = '<input id="x" type="radio" name="g"><input id="y" type="radio" name="g" checked>';
  shadow.append(inside);
  expect(ids(root)).toEqual(["first", "a"]);
  expect(ids(inside)).toEqual(["y"]);
});

it("keeps Escape restoration and never intercepts Arrow keys", () => {
  const { node, close, trigger, trap } = fixture(); node("a").focus();
  for (const arrow of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    expect(key(node("a"), arrow).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(node("a"));
  }
  expect(key(node("a"), "Escape").defaultPrevented).toBe(true);
  expect(close).toHaveBeenCalledOnce(); expect(trap.isActive()).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("uses checked first-group boundary on reverse exit and retains nonradio interior", () => {
  const { node } = fixture('<input id="a" type="radio" name="g"><input id="b" type="radio" name="g" checked><button id="last">last</button>');
  node("b").focus();
  expect(key(node("b"), "Tab", true).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(node("last"));
  expect(key(node("last")).defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(node("b"));
});
