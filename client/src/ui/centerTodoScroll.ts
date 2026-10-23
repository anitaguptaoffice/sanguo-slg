export const TODO_SCROLL_TARGET_ATTR = "data-todo-scroll-target";

export function scrollCenterTodoTarget(root: HTMLElement, scrollTargetId: string): boolean {
  const el = root.querySelector<HTMLElement>(`[${TODO_SCROLL_TARGET_ATTR}="${scrollTargetId}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: "nearest" });
  return true;
}
