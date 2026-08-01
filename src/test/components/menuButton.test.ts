import { describe, expect, it } from "vitest";
import {
  hasNativeCardMenuOwner,
  isDeckShelvesHomeTarget,
  isDuplicateDomMenuDispatch,
  isRecentsOverlayMenuTargetAllowed,
  resolveDsCardForMenuEvent,
  resolveNativeCarouselAppId,
} from "../../components/home/navPatches/menuButton";

function selectorTarget(selectorToMatch: string, card: HTMLElement): EventTarget {
  return {
    closest: (selector: string) => selector === selectorToMatch ? card : null,
  } as unknown as EventTarget;
}

function blankTarget(): EventTarget {
  return { closest: () => null } as unknown as EventTarget;
}

function fakeCard(native = false): HTMLElement {
  return {
    matches: (selector: string) => native && selector === ".ds-card--native",
  } as unknown as HTMLElement;
}

function nativeCarouselTarget(appid: number): EventTarget {
  const link = {
    __reactFiber$test: {
      memoizedProps: {},
      return: {
        memoizedProps: { app: { appid } },
        return: null,
      },
    },
  } as unknown as HTMLElement;
  return selectorTarget('[role="link"]', link);
}

describe("Deck Shelves menu event ownership", () => {
  it("does not borrow controller focus for a mouse right-click on blank space", () => {
    const focused = fakeCard();

    expect(resolveDsCardForMenuEvent("contextmenu", blankTarget(), focused)).toBeNull();
  });

  it("uses the card under the pointer for a mouse right-click", () => {
    const pointed = fakeCard();
    const focused = fakeCard();

    expect(resolveDsCardForMenuEvent("contextmenu", selectorTarget(".ds-card", pointed), focused)).toBe(pointed);
  });

  it("retains the focused-card fallback for controller menu events", () => {
    const focused = fakeCard();

    expect(resolveDsCardForMenuEvent("vgp_onmenubutton", blankTarget(), focused)).toBe(focused);
  });

  it("recognizes native-backed cards that own Steam's full menu lifecycle", () => {
    expect(hasNativeCardMenuOwner(fakeCard(true))).toBe(true);
    expect(hasNativeCardMenuOwner(fakeCard(false))).toBe(false);
  });

  it("requires a native grid card hit for a recents-overlay mouse menu", () => {
    const nativeCard = fakeCard();

    expect(isRecentsOverlayMenuTargetAllowed("contextmenu", blankTarget())).toBe(false);
    expect(isRecentsOverlayMenuTargetAllowed(
      "contextmenu",
      selectorTarget('[role="link"]', nativeCard),
    )).toBe(true);
    expect(isRecentsOverlayMenuTargetAllowed("vgp_onmenubutton", blankTarget())).toBe(true);
  });

  it("resolves the pointed native Recent Games card through Steam's React owner", () => {
    expect(resolveNativeCarouselAppId(nativeCarouselTarget(2483190))).toBe(2483190);
    expect(resolveNativeCarouselAppId(blankTarget())).toBe(0);
  });

  it("recognizes targets in the mounted Deck Shelves Home document", () => {
    const homeDocument = {
      querySelector: (selector: string) => selector === "#deck-shelves-home-root" ? {} : null,
    };
    const target = { ownerDocument: homeDocument } as unknown as EventTarget;
    const offHomeTarget = {
      ownerDocument: { querySelector: () => null },
    } as unknown as EventTarget;

    expect(isDeckShelvesHomeTarget(target)).toBe(true);
    expect(isDeckShelvesHomeTarget(offHomeTarget)).toBe(false);
  });

  it("deduplicates paired mouse and virtual menu events for the same card", () => {
    const card = fakeCard();
    const previous = { card, eventType: "contextmenu", at: 1_000 };

    expect(isDuplicateDomMenuDispatch(previous, card, "vgp_onmenubutton", 1_250)).toBe(true);
    expect(isDuplicateDomMenuDispatch(previous, card, "contextmenu", 1_250)).toBe(false);
    expect(isDuplicateDomMenuDispatch(previous, fakeCard(), "vgp_onmenubutton", 1_250)).toBe(false);
    expect(isDuplicateDomMenuDispatch(previous, card, "vgp_onmenubutton", 1_501)).toBe(false);
  });
});
