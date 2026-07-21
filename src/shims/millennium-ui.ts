// The Millennium API shim installs a Decky-compatible DFL facade before the
// rest of the bundle evaluates. Reuse the mature Deck Shelves UI fallbacks on
// top of that facade instead of duplicating the component adapter.
export * from "./decky-ui";

import { createElement, type ReactNode } from "react";
import { DialogButton, Focusable } from "./decky-ui";

type MillenniumTab = {
  id: string;
  title: string;
  content: ReactNode;
  renderTabAddon?: () => ReactNode;
};

type MillenniumTabsProps = {
  tabs: MillenniumTab[];
  activeTab: string;
  onShowTab: (id: string) => void;
  autoFocusContents?: boolean;
};

function tabButtonStyle(active: boolean): Record<string, string | number> {
  return {
    minWidth: 0,
    width: "auto",
    height: 36,
    padding: "6px 20px",
    borderRadius: 18,
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    background: active ? "#f5f5f5" : "transparent",
    color: active ? "#20242b" : "rgba(255,255,255,0.75)",
  };
}

function changeTab(props: MillenniumTabsProps, delta: number): void {
  if (!props.tabs.length) return;
  const current = Math.max(0, props.tabs.findIndex((tab) => tab.id === props.activeTab));
  const next = (current + delta + props.tabs.length) % props.tabs.length;
  props.onShowTab(props.tabs[next].id);
}

/* @steambrew/client 5.8.5's Tabs fallback waits forever for
   `window.DeckyPluginLoader.routerHook.routes`, an object Millennium does not
   expose. Keep the same controlled Tabs contract while rendering a small
   native-feeling tab strip directly. This is used by Add Shelf and both shelf
   editors, so none of those dialogs can get stranded on SteamSpinner. */
export function Tabs(props: MillenniumTabsProps) {
  const selected = props.tabs.find((tab) => tab.id === props.activeTab) ?? props.tabs[0];
  const onButtonDown = (event: any) => {
    const button = event?.detail?.button ?? event?.button;
    if (button === 5) changeTab(props, -1);
    else if (button === 6) changeTab(props, 1);
  };
  return createElement(
    Focusable,
    {
      style: { display: "flex", flexDirection: "column", minHeight: 0, height: "100%" },
      onButtonDown,
      noFocusRing: true,
    },
    createElement(
      Focusable,
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "0 0 12px",
          flexShrink: 0,
        },
        "flow-children": "row",
        noFocusRing: true,
      },
      createElement("span", { style: { fontSize: 11, fontWeight: 700, opacity: 0.8, marginRight: 8 } }, "LB"),
      ...props.tabs.map((tab) => createElement(
        DialogButton,
        {
          key: tab.id,
          "data-ds-page-tab-id": tab.id,
          style: tabButtonStyle(tab.id === selected?.id),
          onClick: () => props.onShowTab(tab.id),
          onOKButton: () => props.onShowTab(tab.id),
          onOKActionDescription: tab.title,
        },
        tab.title,
        tab.renderTabAddon?.(),
      )),
      createElement("span", { style: { fontSize: 11, fontWeight: 700, opacity: 0.8, marginLeft: 8 } }, "RB"),
    ),
    createElement(
      "div",
      {
        style: {
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
      },
      selected?.content ?? null,
    ),
  );
}
