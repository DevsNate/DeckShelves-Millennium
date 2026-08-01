// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { buildShelfStylesheet } from "../../components/shelf/shelfStylesheetTemplate";

const css = buildShelfStylesheet({
  cardRadius: "4px",
  cardW: 155,
  cardH: 232,
  cardArtH: 232,
  cardGap: 11,
  featuredW: 509,
  featuredH: 238,
  featuredArtH: 238,
});

describe("shelf title opacity cascade", () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it("lets auto-hide win while native opacity matching is enabled", () => {
    const style = document.createElement("style");
    style.textContent = css;
    const root = document.createElement("div");
    root.className = "deck-shelves-root";
    root.dataset.dsMatchNativeShelfTitleOpacity = "true";
    const title = document.createElement("div");
    title.className = "ds-shelf-title";
    title.dataset.dsTitleAutoHide = "true";
    title.dataset.dsTitleVisible = "false";
    root.append(title);
    document.head.append(style);
    document.body.append(root);

    expect(getComputedStyle(title).opacity).toBe("0");
  });

  it("emits an authoritative mirrored title-color rule", () => {
    expect(css).toContain(
      "#deck-shelves-home-root .deck-shelves-root .ds-shelf-title",
    );
    expect(css).toContain(
      "color: var(--ds-native-heading-color, inherit) !important",
    );
  });
});
