import { describe, it, expect } from 'vitest';
import { _labelOverhangPx } from '../../components/DeckRow';

describe('_labelOverhangPx — row paddingBottom budget', () => {
  it('reserves Steam\'s 52 px native title/status band exactly once', () => {
    expect(_labelOverhangPx({ hideStatusLine: true, hideGameNames: true })).toBe(52);
  });

  it('keeps the native band height stable when status visibility changes', () => {
    const off = _labelOverhangPx({ hideStatusLine: true });
    const on = _labelOverhangPx({ hideStatusLine: false });
    expect(on).toBe(off);
  });

  it('reserves more space when per-card description is visible (not below logo)', () => {
    const off = _labelOverhangPx({ enableDescription: false });
    const on = _labelOverhangPx({ enableDescription: true, descriptionBelowLogo: false });
    expect(on).toBeGreaterThan(off);
  });

  it('does NOT add description slot when descriptionBelowLogo is true (description renders in the hero overlay, not below the card)', () => {
    const inHero = _labelOverhangPx({ enableDescription: true, descriptionBelowLogo: true });
    const off = _labelOverhangPx({ enableDescription: false });
    expect(inHero).toBe(off);
  });

  it('adds the description once on top of the fixed native viewport budget', () => {
    const statusOnly = _labelOverhangPx({ hideStatusLine: false, enableDescription: false });
    const descOnly = _labelOverhangPx({ hideStatusLine: true, enableDescription: true });
    const both = _labelOverhangPx({ hideStatusLine: false, enableDescription: true });
    expect(both).toBeGreaterThan(statusOnly);
    expect(both).toBe(descOnly);
  });
});
