type PluginFactory = (serverAPI?: { routerHook: any }) => unknown;

const root: any = globalThis as any;
const win: any = root.window ?? root;
// Millennium exposes one shared client SDK instance to every plugin. Reusing
// it avoids bundling and constructing a second router/toaster hook tree.
const client = win.MILLENNIUM_API as any;
if (!client) throw new Error("Deck Shelves: Millennium client API is not available.");
root.__DECK_SHELVES_MILLENNIUM__ = true;
win.__DECK_SHELVES_MILLENNIUM__ = true;
const GAMEPAD_MODE = client.EUIMode?.GamePad ?? 4;

// Millennium's router hook defaults patches and global components to Desktop.
// Deck Shelves targets Steam's Big Picture/GamePad router, so keep the Decky
// call shape while supplying the correct mode on every affected operation.
export const routerHook = new Proxy(client.routerHook, {
  get(target, property) {
    if (property === "addPatch") {
      return (path: string, patch: any) => target.addPatch(path, patch, GAMEPAD_MODE);
    }
    if (property === "removePatch") {
      return (path: string, patch: any) => target.removePatch(path, patch, GAMEPAD_MODE);
    }
    if (property === "addGlobalComponent") {
      return (name: string, component: any) => target.addGlobalComponent(name, component, GAMEPAD_MODE);
    }
    if (property === "removeGlobalComponent") {
      return (name: string) => target.removeGlobalComponent(name, GAMEPAD_MODE);
    }
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

// Several optional Deck Shelves integrations discover Decky Frontend Lib
// lazily. Expose Millennium's equivalent primitives under that compatibility
// name, with the mode-correct router hook overriding the SDK default.
const facade = { ...client, routerHook };
root.DFL ??= facade;
root.deckyFrontendLib ??= facade;
win.DFL ??= facade;
win.deckyFrontendLib ??= facade;

export function definePlugin(factory: PluginFactory) {
  return client.definePlugin(() => factory({ routerHook }));
}

function parseBackendResult<T>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  const trimmed = value.trim();
  if (!trimmed) return value as T;
  const isJsonContainer = trimmed[0] === "{" || trimmed[0] === "[" || trimmed[0] === '"';
  const isJsonPrimitive = trimmed === "true" || trimmed === "false" || trimmed === "null" || /^-?\d+(?:\.\d+)?$/.test(trimmed);
  if (!isJsonContainer && !isJsonPrimitive) return value as T;
  try { return JSON.parse(trimmed) as T; } catch { return value as T; }
}

export async function call<TArgs extends unknown[], TResult>(method: string, ...args: TArgs): Promise<TResult> {
  const transport = win.Millennium?.callServerMethod;
  if (typeof transport !== "function") {
    throw new Error(`Deck Shelves: Millennium backend not ready for ${method}`);
  }
  let kwargs: Record<string, unknown> = {};
  if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
    kwargs = args[0] as Record<string, unknown>;
  } else if (args.length === 1) {
    const primitiveKeys: Record<string, string> = {
      read_image_b64: "path",
      get_wishlist: "community_url",
      list_launcher_games: "launcher_id",
    };
    kwargs[primitiveKeys[method] ?? "value"] = args[0];
  } else if (args.length > 1) {
    kwargs.args = args;
  }
  // Millennium's Lua bridge transports primitive kwargs consistently, while
  // nested JavaScript objects can arrive as an opaque value on some builds.
  // Keep Decky's public call shape, but serialize the settings payload at this
  // adapter boundary; the Millennium backend accepts both this and native
  // tables so the implementation remains forward-compatible.
  if (method === "set_settings" && kwargs.settings && typeof kwargs.settings === "object") {
    kwargs = { ...kwargs, settings: JSON.stringify(kwargs.settings) };
  }
  if ((method === "export_backup" || method === "write_json_file") && Object.keys(kwargs).length > 1) {
    kwargs = { payload: JSON.stringify(kwargs) };
  }
  return parseBackendResult<TResult>(await transport.call(win.Millennium, "deck-shelves", method, kwargs));
}

export function callable<TArgs extends unknown[], TResult>(method: string) {
  return (...args: TArgs) => call<TArgs, TResult>(method, ...args);
}

export const toaster = client.toaster;

export const FileSelectionType = { FILE: 0, FOLDER: 1 } as const;

// Millennium currently has no SDK file-picker counterpart. The existing Deck
// Shelves dialogs already tolerate a cancelled picker and retain manual paths.
export async function openFilePicker(..._args: unknown[]): Promise<null> {
  return null;
}
