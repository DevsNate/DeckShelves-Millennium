import { describe, expect, it } from "vitest";
import { miniCarouselTitleGapCompensation } from "../../components/shelf/miniCarouselSpacing";

describe("Mini Carousel title-to-card spacing", () => {
  it("adds only the native centered-scale inset missing from Deck Shelves", () => {
    expect(miniCarouselTitleGapCompensation(340, 0.9)).toBeCloseTo(14.4, 5);
  });

  it("leaves the existing title gap unchanged without Mini Carousel scaling", () => {
    expect(miniCarouselTitleGapCompensation(340, 1)).toBe(0);
  });

  it("never pulls the carousel closer for enlarged or invalid scales", () => {
    expect(miniCarouselTitleGapCompensation(340, 1.1)).toBe(0);
    expect(miniCarouselTitleGapCompensation(Number.NaN, 0.9)).toBe(0);
  });
});
