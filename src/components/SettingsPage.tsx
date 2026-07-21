import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, Focusable } from "../runtime/host/decky";
import { Navigation } from "@decky/ui";
import { useSettingsController } from "../features/settings/controller";
import { PageHeader } from "./ui/PageHeader";
import { VersionFooter } from "./ui/VersionFooter";
import { DeckQAMStyles } from "./styles/DeckQAMStyles";
import { ShelvesDetail } from "./settings/details/ShelvesDetail";
import { ProfilesDetail } from "./settings/details/ProfilesDetail";
import { IntegrationsDetail } from "./settings/details/IntegrationsDetail";
import { ButtonBindingsDetail } from "./settings/details/ButtonBindingsDetail";
import { BackupDetail } from "./settings/details/BackupDetail";
import { AdvancedDetail } from "./settings/details/AdvancedDetail";
import { DeveloperDetail } from "./settings/details/DeveloperDetail";
import { StatisticsDetail } from "./settings/details/StatisticsDetail";
import { SuggestionsDetail } from "./settings/details/SuggestionsDetail";
import { BookmarkIcon, PersonIcon, PuzzleIcon, GamepadIcon, SaveIcon, ToolsIcon, SlidersIcon, SparkleIcon, GearIcon } from "./icons";
import { useLightMode, useAdvancedMode } from "./ui/lightMode";
import { hasExternalIntegrations } from "../core/pluginApi";
import { consumePendingSettingsTab } from "../runtime/settingsNav";
import { getPreferredSteamDocument } from "../runtime/steamHost";

function tabLabel(icon: React.ReactNode, text: string): string {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      {text}
    </span>
  ) as unknown as string;
}

type SettingsController = ReturnType<typeof useSettingsController>;

function buildSettingsTabs(
  controller: SettingsController,
  t: (k: string) => string,
  flags: { lightMode: boolean; showIntegrations: boolean; advancedMode: boolean; devMode: boolean },
) {
  const { lightMode, showIntegrations, advancedMode, devMode } = flags;
  return [
    { id: "shelves",      title: tabLabel(<BookmarkIcon />, t("settings_card_shelves_title")),      content: <ShelvesDetail        controller={controller} t={t} /> },
    { id: "profiles",     title: tabLabel(<PersonIcon />,   t("settings_card_profiles_title")),     content: <ProfilesDetail       controller={controller} t={t} /> },
    ...(showIntegrations ? [
      { id: "integrations", title: tabLabel(<PuzzleIcon />,   t("settings_card_integrations_title")), content: <IntegrationsDetail   controller={controller} t={t} /> },
    ] : []),
    ...(lightMode ? [] : [
      { id: "bindings",     title: tabLabel(<GamepadIcon />,  t("settings_card_bindings_title")),     content: <ButtonBindingsDetail controller={controller} t={t} /> },
    ]),
    { id: "backup",       title: tabLabel(<SaveIcon />,     t("settings_card_backup_title")),       content: <BackupDetail         controller={controller} t={t} /> },
    ...(lightMode ? [] : [
      { id: "suggestions",  title: tabLabel(<SparkleIcon />,  t("settings_card_suggestions_title")),  content: <SuggestionsDetail    controller={controller} t={t} /> },
      { id: "statistics",   title: tabLabel(<SlidersIcon />,  t("settings_card_statistics_title")),   content: <StatisticsDetail     controller={controller} t={t} /> },
    ]),
    ...(advancedMode ? [
      { id: "advanced",     title: tabLabel(<ToolsIcon />,    t("settings_card_advanced_title")),     content: <AdvancedDetail       controller={controller} t={t} /> },
    ] : []),
    ...(devMode ? [
      { id: "developer",    title: tabLabel(<GearIcon />,     t("settings_card_developer_title")),    content: <DeveloperDetail      controller={controller} t={t} /> },
    ] : []),
  ];
}

export function SettingsPage() {
  const controller = useSettingsController();
  const lightMode = useLightMode();
  const advancedMode = useAdvancedMode();
  const devMode = advancedMode && (controller.settings as any)?.devModeEnabled === true;
  // Integrations tab: always in advanced mode; otherwise only when a
  // third-party plugin is present (and never in light mode). Shortcuts +
  // Statistics hide in light mode; Advanced tools show only in advanced.
  const showIntegrations = advancedMode || (hasExternalIntegrations() && !lightMode);
  // Deep-link target (e.g. the "new suggestions" toast → Suggestions tab). The
  // suggestions tab is hidden in light mode; fall back to the default there.
  const [activeTab, setActiveTab] = useState(() => {
    const pending = consumePendingSettingsTab();
    if (pending === "suggestions" && lightMode) return "shelves";
    return pending ?? "shelves";
  });
  const t = useCallback(
    (key: string) => (controller.t as (k: string) => string)(key),
    [controller.t],
  );
  const goBack = useCallback(() => {
    try { Navigation.NavigateBack(); } catch {}
  }, []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initialTabFocusDone = useRef(false);

  useEffect(() => {
    if (!controller.settings || initialTabFocusDone.current) return;
    if ((globalThis as any).__DECK_SHELVES_MILLENNIUM__ !== true) return;
    const doc = getPreferredSteamDocument();
    const frame = (doc.defaultView ?? window).requestAnimationFrame(() => {
      const page = doc.querySelector(".deck-shelves-settings-page");
      const buttons = page?.querySelectorAll<HTMLElement>("[data-ds-page-tab-id]") ?? [];
      const target = Array.from(buttons).find((button) => button.dataset.dsPageTabId === activeTab);
      if (!target) return;
      try { target.focus({ preventScroll: true }); }
      catch { try { target.focus(); } catch {} }
      initialTabFocusDone.current = true;
    });
    return () => (doc.defaultView ?? window).cancelAnimationFrame(frame);
  }, [activeTab, controller.settings]);

  useEffect(() => {
    const scrollHost = scrollRef.current;
    if (!scrollHost) return;
    let frame: number | null = null;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target || !scrollHost.contains(target)) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        const hostRect = scrollHost.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const topEdge = hostRect.top + 12;
        const bottomEdge = hostRect.bottom - 16;
        let delta = 0;
        if (targetRect.top < topEdge) delta = targetRect.top - topEdge;
        else if (targetRect.bottom > bottomEdge) delta = targetRect.bottom - bottomEdge;
        if (Math.abs(delta) < 1) return;
        try { scrollHost.scrollBy({ top: delta, behavior: "smooth" }); }
        catch { scrollHost.scrollTop += delta; }
      });
    };
    scrollHost.addEventListener("focusin", onFocusIn, true);
    return () => {
      scrollHost.removeEventListener("focusin", onFocusIn, true);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [activeTab]);

  if (!controller.settings) return null;

  return (
    <Focusable
      className="deck-shelves-settings-page"
      flow-children="vertical"
      onCancelButton={goBack}
      style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", color: "var(--ds-text, #fff)" }}
    >
      <DeckQAMStyles />
      <PageHeader title={t("settings_page_title")} onBack={goBack} active="settings" />
      <div
        ref={scrollRef}
        className="ds-settings-page-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}
      >
        <Tabs
          activeTab={activeTab}
          onShowTab={setActiveTab}
          tabs={buildSettingsTabs(controller, t, { lightMode, showIntegrations, advancedMode, devMode })}
        />
      </div>
      <VersionFooter />
    </Focusable>
  );
}
