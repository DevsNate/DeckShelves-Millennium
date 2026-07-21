type SuppressedNode = {
  owner: HTMLElement;
  focusable: unknown;
};

const suppressedNodes = new Map<any, SuppressedNode>();

function navigationTrees(): any[] {
  const controller = (globalThis as any).FocusNavController;
  const trees: any[] = [];
  for (const context of [controller?.m_ActiveContext, controller?.m_LastActiveContext]) {
    for (const tree of context?.m_rgGamepadNavigationTrees ?? []) {
      if (!trees.includes(tree)) trees.push(tree);
    }
  }
  return trees;
}

function visitNavigationNode(node: any, visit: (candidate: any) => void): void {
  if (!node) return;
  visit(node);
  for (const child of node.m_rgChildren ?? []) visitNavigationNode(child, visit);
}

/** Remove a hidden Steam subtree from GamepadNav without deleting React DOM. */
export function suppressFocusNavigationWithin(owner: HTMLElement): void {
  for (const tree of navigationTrees()) {
    visitNavigationNode(tree?.m_Root, (node) => {
      const element = node?.m_element as HTMLElement | undefined;
      const properties = node?.m_Properties;
      if (!element || !properties || properties.focusable !== true) return;
      if (element !== owner && !owner.contains(element)) return;
      if (!suppressedNodes.has(node)) {
        suppressedNodes.set(node, { owner, focusable: properties.focusable });
      }
      properties.focusable = false;
    });
  }
}

export function restoreFocusNavigationWithin(owner: HTMLElement): void {
  for (const [node, saved] of Array.from(suppressedNodes.entries())) {
    if (saved.owner !== owner) continue;
    if (node?.m_Properties) node.m_Properties.focusable = saved.focusable;
    suppressedNodes.delete(node);
  }
}
