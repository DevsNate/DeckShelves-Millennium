/* Focus helper for Deck Shelves-owned overlays (search and side navigation).
   Home shelf ordering/restoration is intentionally left to Steam's native
   React and GamepadNav tree. */

function getFocusNavController(): any {
  return (globalThis as any).FocusNavController;
}

function getNavTrees(): any[] {
  const ctrl = getFocusNavController();
  if (!ctrl) return [];
  const out: any[] = [];
  for (const context of [ctrl.m_ActiveContext, ctrl.m_LastActiveContext]) {
    for (const tree of (context?.m_rgGamepadNavigationTrees ?? [])) {
      if (!out.includes(tree)) out.push(tree);
    }
  }
  return out;
}

function findNavNodeForElement(element: HTMLElement): any {
  const walk = (node: any): any => {
    const nodeElement = node?.m_element ?? node?.Element ?? node?.m_pElement ?? node?.element;
    if (nodeElement === element) return node;
    for (const child of (node?.m_rgChildren ?? node?.m_children ?? node?.children ?? [])) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const tree of getNavTrees()) {
    const found = walk(tree?.m_Root ?? tree?.Root ?? tree?.m_root);
    if (found) return found;
  }
  return null;
}

export function focusElement(element: HTMLElement): boolean {
  const node = findNavNodeForElement(element);
  try {
    if (typeof node?.BTakeFocus === "function") {
      node.BTakeFocus(2);
      return true;
    }
    element.focus?.();
  } catch {}
  return false;
}
