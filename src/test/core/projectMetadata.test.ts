import { afterEach, describe, expect, it } from "vitest";
import {
  getProjectLinks,
  getRuntimeHostKind,
  getRuntimeVersion,
  getRuntimeVersionLabel,
} from "../../core/projectMetadata";

const flag = "__DECK_SHELVES_MILLENNIUM__";

afterEach(() => {
  delete (globalThis as any)[flag];
});

describe("project metadata", () => {
  it("uses upstream package identity for the Decky build", () => {
    expect(getRuntimeHostKind()).toBe("decky");
    expect(getRuntimeVersion()).toBe("3.1.0");
    expect(getProjectLinks().releasesUrl).toBe("https://github.com/santojon/Deck-Shelves/releases");
  });

  it("uses an independent port version for Millennium", () => {
    (globalThis as any)[flag] = true;
    expect(getRuntimeHostKind()).toBe("millennium");
    expect(getRuntimeVersion()).toBe("3.1.0");
    expect(getRuntimeVersionLabel()).toBe("3.1.0 (upstream 3.1.0)");
  });

  it("uses the configured Millennium repository for port links", () => {
    (globalThis as any)[flag] = true;
    const links = getProjectLinks();
    expect(links.releasesUrl).toBe("https://github.com/DevsNate/DeckShelves-Millennium/releases");
    expect(links.issuesUrl).toBe("https://github.com/DevsNate/DeckShelves-Millennium/issues/new");
    expect(links.sourceUrl).toBe("https://github.com/DevsNate/DeckShelves-Millennium");
  });
});
