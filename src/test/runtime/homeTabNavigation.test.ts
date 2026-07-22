import { afterEach, describe, expect, it } from "vitest";
import {
  restoreFocusNavigationWithin,
  shouldHandleDownAtHiddenHomeTabsBoundary,
  suppressFocusNavigationWithin,
} from "../../runtime/homeTabNavigation";

const owners: HTMLElement[] = [];

afterEach(() => {
  for (const owner of owners.splice(0)) restoreFocusNavigationWithin(owner);
  delete (globalThis as any).FocusNavController;
});

describe("hidden Home tab navigation", () => {
  it("suppresses and restores focusable nodes inside the hidden subtree", () => {
    const tab = {} as HTMLElement;
    const outside = {} as HTMLElement;
    const owner = { contains: (element: HTMLElement) => element === tab } as HTMLElement;
    owners.push(owner);
    const tabNode = { m_element: tab, m_Properties: { focusable: true }, m_rgChildren: [] };
    const outsideNode = { m_element: outside, m_Properties: { focusable: true }, m_rgChildren: [] };
    const root = { m_rgChildren: [tabNode, outsideNode] };
    (globalThis as any).FocusNavController = {
      m_ActiveContext: { m_rgGamepadNavigationTrees: [{ m_Root: root }] },
    };

    suppressFocusNavigationWithin(owner);
    expect(tabNode.m_Properties.focusable).toBe(false);
    expect(outsideNode.m_Properties.focusable).toBe(true);

    restoreFocusNavigationWithin(owner);
    expect(tabNode.m_Properties.focusable).toBe(true);
  });

  it("suppresses late replacement nodes retained in the last active context", () => {
    const firstTab = {} as HTMLElement;
    const replacementTab = {} as HTMLElement;
    const owner = {
      contains: (element: HTMLElement) => element === firstTab || element === replacementTab,
    } as HTMLElement;
    owners.push(owner);

    const firstNode = { m_element: firstTab, m_Properties: { focusable: true }, m_rgChildren: [] };
    const replacementNode = { m_element: replacementTab, m_Properties: { focusable: true }, m_rgChildren: [] };
    const controller = {
      m_ActiveContext: { m_rgGamepadNavigationTrees: [{ m_Root: { m_rgChildren: [firstNode] } }] },
      m_LastActiveContext: undefined as any,
    };
    (globalThis as any).FocusNavController = controller;

    suppressFocusNavigationWithin(owner);
    expect(firstNode.m_Properties.focusable).toBe(false);

    controller.m_ActiveContext = { m_rgGamepadNavigationTrees: [] };
    controller.m_LastActiveContext = {
      m_rgGamepadNavigationTrees: [{ m_Root: { m_rgChildren: [replacementNode] } }],
    };
    suppressFocusNavigationWithin(owner);
    expect(replacementNode.m_Properties.focusable).toBe(false);

    restoreFocusNavigationWithin(owner);
    expect(firstNode.m_Properties.focusable).toBe(true);
    expect(replacementNode.m_Properties.focusable).toBe(true);
  });

  it("handles Down only on the final shelf while Home tabs are hidden", () => {
    const first = {} as HTMLElement;
    const last = {} as HTMLElement;
    const shelves = { length: 2, item: (index: number) => [first, last][index] };
    const root = { querySelectorAll: () => shelves } as unknown as HTMLElement;
    first.closest = () => root;
    last.closest = () => root;

    expect(shouldHandleDownAtHiddenHomeTabsBoundary(first, true)).toBe(false);
    expect(shouldHandleDownAtHiddenHomeTabsBoundary(last, true)).toBe(true);
    expect(shouldHandleDownAtHiddenHomeTabsBoundary(last, false)).toBe(false);
  });

  it("does not intercept shelves outside the injected Home root", () => {
    const shelf = { closest: () => null } as unknown as HTMLElement;

    expect(shouldHandleDownAtHiddenHomeTabsBoundary(shelf, true)).toBe(false);
  });
});
