import { getAllSteamDocuments } from "../../../runtime/steamHost";
import { showGameMenu } from "../../../core/steamGameMenu";
import { logInfo } from "../../../runtime/logger";
import {
  getOverlayFocusedAppId,
  getOverlayFirstCachedAppId,
  isRecentsReplaceInjecting,
} from "../../../runtime/recentsReplace";
import { OPTIONS_BUTTON } from "./constants";

const patchedMenuControllers = new WeakSet<object>();
const DOM_MENU_DEDUPE_MS = 500;

type DomMenuDispatch = {
  card: HTMLElement;
  eventType: string;
  at: number;
};

let lastDomMenuDispatch: DomMenuDispatch | null = null;

function findFocusedDsCard(): HTMLElement | null {
  for (const d of getAllSteamDocuments()) {
    const el = (
      d.querySelector(".ds-card.gpfocus") ??
      d.querySelector(".ds-card:focus")
    ) as HTMLElement | null;
    if (el) return el;
  }
  try {
    const el = (globalThis as any).__ds_last_focused_card as HTMLElement | null;
    if (el?.isConnected) return el;
  } catch {}
  return null;
}

function readCardIds(el: HTMLElement): { appid: number; shelfId?: string } {
  const appid = Number(el.getAttribute("data-appid") ?? 0);
  const shelfId = el.getAttribute("data-shelfid") ?? undefined;
  return { appid, shelfId: shelfId || undefined };
}

export function resolveDsCardForMenuEvent(
  eventType: string,
  target: EventTarget | null,
  focusedCard: HTMLElement | null,
): HTMLElement | null {
  const fromTarget = (target as HTMLElement | null)?.closest?.(".ds-card") as HTMLElement | null;
  // A mouse context menu belongs only to the card under the pointer. Falling
  // back to controller focus makes blank shelf/hero space open a stale card.
  if (eventType === "contextmenu") return fromTarget;
  return fromTarget ?? focusedCard;
}

export function isRecentsOverlayMenuTargetAllowed(
  eventType: string,
  target: EventTarget | null,
): boolean {
  if (eventType !== "contextmenu") return true;
  return !!(target as HTMLElement | null)?.closest?.('[role="link"]');
}

function closestNativeGameLink(target: EventTarget | null): HTMLElement | null {
  return (target as HTMLElement | null)?.closest?.('[role="link"]') as HTMLElement | null;
}

// Native Recent Games cards have no Deck Shelves data attrs. Follow the
// pointed card's React owner instead of borrowing controller focus.
function positiveAppId(value: unknown): number {
  const appid = Number(value ?? 0);
  return Number.isFinite(appid) && appid > 0 ? appid : 0;
}

function appIdFromNativeFiberProps(props: any): number {
  const candidates = [
    props?.appid,
    props?.nAppID,
    props?.app?.appid,
    props?.app?.nAppID,
    props?.overview?.appid,
    props?.overview?.nAppID,
  ];
  return candidates.map(positiveAppId).find((appid) => appid > 0) ?? 0;
}

export function resolveNativeCarouselAppId(target: EventTarget | null): number {
  const link = closestNativeGameLink(target);
  if (!link) return 0;
  const fiberKey = Object.keys(link).find((key) => key.startsWith("__reactFiber$"));
  let fiber = fiberKey ? (link as any)[fiberKey] : null;
  for (let depth = 0; fiber && depth < 25; depth++, fiber = fiber.return) {
    const appid = appIdFromNativeFiberProps(fiber.memoizedProps ?? fiber.pendingProps);
    if (appid > 0) return appid;
  }
  return 0;
}

export function isDeckShelvesHomeTarget(target: EventTarget | null): boolean {
  const ownerDocument = (target as Node | null)?.ownerDocument;
  return !!ownerDocument?.querySelector?.("#deck-shelves-home-root");
}

export function hasNativeCardMenuOwner(card: HTMLElement): boolean {
  return card.matches?.(".ds-card--native") === true;
}

export function isDuplicateDomMenuDispatch(
  previous: DomMenuDispatch | null,
  card: HTMLElement,
  eventType: string,
  at: number,
): boolean {
  return !!(
    previous &&
    previous.card === card &&
    previous.eventType !== eventType &&
    at - previous.at >= 0 &&
    at - previous.at <= DOM_MENU_DEDUPE_MS
  );
}

function interceptMenuBtn(button: number): boolean {
  if (button !== OPTIONS_BUTTON) return false;
  try {
    const focused = findFocusedDsCard();
    if (focused) {
      if (hasNativeCardMenuOwner(focused)) return false;
      const { appid, shelfId } = readCardIds(focused);
      if (appid > 0) { showGameMenu(appid, shelfId); return true; }
    }
    // Recents overlay: intercept unconditionally — native handler crashes on
    // replaced cards. Use tracked focused appid, falling back to first cached.
    if (isRecentsReplaceInjecting()) {
      const appid = getOverlayFocusedAppId() || getOverlayFirstCachedAppId();
      if (appid > 0) { showGameMenu(appid); return true; }
      return true;
    }
  } catch { return false; }
  return false;
}

// eslint-disable-next-line complexity
export function patchMenuButton(): void {
  const DS_DOC_MENU = "__ds_doc_menu__";
  // Register on every Steam document we can see: ds-cards may live in the
  // popup (GamepadUI) while the plugin bundle itself runs in SharedJSContext.
  // Event listeners must live on the document that actually hosts the card.

  // eslint-disable-next-line complexity
  const handleMenu = (evt: Event) => {
    try {
      // vgp_onmenubutton / contextmenu fire on the focused element — read the
      /* target directly before falling back to the focus-based queries. This
         handles cases where __ds_last_focused_card is briefly stale (e.g.
         DispatchVirtualButtonClick intercepted for the wrong card) because the
         document-level capture listener fires once the event IS dispatched on
         the correct element. */
      const card = resolveDsCardForMenuEvent(evt.type, evt.target, findFocusedDsCard());
      if (card) {
        // The borrowed Steam capsule is already mounted and owns the complete
        // native menu lifecycle. Let both mouse and controller events reach it
        // instead of opening the smaller self-built Millennium fallback.
        if (hasNativeCardMenuOwner(card)) return;
        const appid = Number(card.getAttribute("data-appid") ?? 0);
        const shelfId = card.getAttribute("data-shelfid") ?? undefined;
        if (appid > 0) {
          evt.stopImmediatePropagation();
          evt.preventDefault();
          const now = Date.now();
          if (isDuplicateDomMenuDispatch(lastDomMenuDispatch, card, evt.type, now)) {
            lastDomMenuDispatch = null;
            return;
          }
          lastDomMenuDispatch = { card, eventType: evt.type, at: now };
          showGameMenu(appid, shelfId || undefined);
          return;
        }
      }
      // Overlay: intercept unconditionally — native handler crashes on replaced cards.
      if (isRecentsReplaceInjecting()) {
        if (!isRecentsOverlayMenuTargetAllowed(evt.type, evt.target)) {
          // A right-click in the gutter/hero must not leak Chromium's own
          // developer menu, and must not borrow a focused game.
          if (evt.type === "contextmenu" && isDeckShelvesHomeTarget(evt.target)) {
            evt.stopImmediatePropagation();
            evt.preventDefault();
          }
          return;
        }
        evt.stopImmediatePropagation();
        evt.preventDefault();
        const overlayCard = (evt.target as HTMLElement | null)?.closest?.('[role="link"]') as HTMLElement | null;
        if (overlayCard) {
          const now = Date.now();
          if (isDuplicateDomMenuDispatch(lastDomMenuDispatch, overlayCard, evt.type, now)) {
            lastDomMenuDispatch = null;
            return;
          }
          lastDomMenuDispatch = { card: overlayCard, eventType: evt.type, at: now };
        }
        const pointedAppId = evt.type === "contextmenu"
          ? resolveNativeCarouselAppId(evt.target)
          : 0;
        const appid = pointedAppId || getOverlayFocusedAppId() || getOverlayFirstCachedAppId();
        if (appid > 0) showGameMenu(appid);
        return;
      }

      if (evt.type === "contextmenu" && isDeckShelvesHomeTarget(evt.target)) {
        // Native Recent Games cards keep Steam ownership. Everything else is
        // blank Home space; consume it so Chromium's developer menu stays shut.
        if (resolveNativeCarouselAppId(evt.target) > 0) return;
        evt.stopImmediatePropagation();
        evt.preventDefault();
      }
    } catch (e) { logInfo("HOME", "handleMenu failed", String(e)); }
  };
  for (const d of getAllSteamDocuments()) {
    if ((d as any)[DS_DOC_MENU]) continue;
    (d as any)[DS_DOC_MENU] = true;
    d.addEventListener("vgp_onmenubutton", handleMenu, true);
    d.addEventListener("contextmenu", handleMenu, true);
  }

  const ctrl = (globalThis as any).FocusNavController
    ?? (globalThis as any).GamepadNavTree?.m_context?.m_controller;
  if (!ctrl) return;

  if (typeof ctrl.DispatchVirtualButtonClick === "function" && !patchedMenuControllers.has(ctrl)) {
    const orig = ctrl.DispatchVirtualButtonClick.bind(ctrl);
    ctrl.DispatchVirtualButtonClick = (button: number, ...args: any[]) => {
      if (interceptMenuBtn(button)) return;
      return orig(button, ...args);
    };
    patchedMenuControllers.add(ctrl);
    return;
  }

  if (!patchedMenuControllers.has(ctrl)) {
    const proto = Object.getPrototypeOf(ctrl);
    if (proto && !patchedMenuControllers.has(proto) && typeof proto.DispatchVirtualButtonClick === "function") {
      const orig = proto.DispatchVirtualButtonClick;
      proto.DispatchVirtualButtonClick = function(button: number, ...args: any[]) {
        if (interceptMenuBtn(button)) return;
        return orig.apply(this, [button, ...args]);
      };
      patchedMenuControllers.add(proto);
      patchedMenuControllers.add(ctrl);
      return;
    }
  }

  const ctx = ctrl.m_ActiveContext || ctrl.m_LastActiveContext;
  const controller = ctx?.m_controller;
  if (controller && !patchedMenuControllers.has(controller) && typeof controller.DispatchVirtualButtonClick === "function") {
    const origDispatch = controller.DispatchVirtualButtonClick;
    controller.DispatchVirtualButtonClick = function(button: number, ...args: any[]) {
      if (interceptMenuBtn(button)) return;
      return origDispatch.apply(this, [button, ...args]);
    };
    patchedMenuControllers.add(controller);
  }
}
