import pluginEntry from "./index";

const PLUGIN_NAME = "deck-shelves";

declare global {
  interface Window {
    PLUGIN_LIST?: Record<string, any>;
    MILLENNIUM_SIDEBAR_NAVIGATION_PANELS?: Record<string, any>;
    MILLENNIUM_BACKEND_IPC?: { postMessage?: (type: number, payload: unknown) => void };
  }
}

// Millennium executes a plugin's Dist/index.js as a module script. Its TTC
// compiler normally appends this registration wrapper; the Vite port needs to
// provide the equivalent explicitly.
void (async () => {
  try {
    window.PLUGIN_LIST ??= {};
    window.PLUGIN_LIST[PLUGIN_NAME] ??= {};
    Object.assign(window.PLUGIN_LIST[PLUGIN_NAME], {
      default: pluginEntry,
      __millennium_internal_plugin_name_do_not_use_or_change__: PLUGIN_NAME,
    });

    const plugin = await pluginEntry();
    if (plugin && (plugin as any).title !== undefined && (plugin as any).icon !== undefined && (plugin as any).content !== undefined) {
      window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS ??= {};
      window.MILLENNIUM_SIDEBAR_NAVIGATION_PANELS[PLUGIN_NAME] = plugin;
    }
    window.MILLENNIUM_BACKEND_IPC?.postMessage?.(1, { pluginName: PLUGIN_NAME });
  } catch (error) {
    console.error("Deck Shelves Millennium bootstrap failed", error);
  }
})();

export default pluginEntry;
