import { describe, expect, it } from "vitest";
import {
  isOwnedShelfRenderChild,
  shouldRenderHomeShelves,
} from "../../components/home/renderState";

describe("home shelf render state", () => {
  it("renders when the only visible shelf is a smart shelf", () => {
    expect(shouldRenderHomeShelves(true, [{ id: "smart-only" }])).toBe(true);
  });

  it("does not render an enabled but empty shelf container", () => {
    expect(shouldRenderHomeShelves(true, [])).toBe(false);
  });

  it("does not render shelves while the plugin is disabled", () => {
    expect(shouldRenderHomeShelves(false, [{ id: "smart-only" }])).toBe(false);
  });
});

describe("home shelf child ownership", () => {
  function child(classes: string[], containsShelf = false) {
    return {
      classList: { contains: (className: string) => classes.includes(className) },
      querySelector: () => containsShelf ? {} : null,
    };
  }

  it("keeps a shelf loading placeholder visible", () => {
    expect(isOwnedShelfRenderChild(child(["ds-shelf-loading"]))).toBe(true);
  });

  it("keeps a resolved shelf visible", () => {
    expect(isOwnedShelfRenderChild(child(["Panel", "ds-shelf"]))).toBe(true);
  });

  it("keeps the temporary manual-refresh wrapper visible", () => {
    expect(isOwnedShelfRenderChild(child([], true))).toBe(true);
  });

  it("still identifies unrelated injected children as foreign", () => {
    expect(isOwnedShelfRenderChild(child(["steam-empty-state"]))).toBe(false);
  });
});
