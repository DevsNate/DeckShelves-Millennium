import { describe, expect, it } from 'vitest';
import { buildShelfStylesheet } from '../../components/shelf/shelfStylesheetTemplate';

const css = buildShelfStylesheet({
  cardRadius: '4px',
  cardW: 155,
  cardH: 232,
  cardArtH: 232,
  cardGap: 11,
  featuredW: 509,
  featuredH: 238,
  featuredArtH: 238,
});

describe('native card layout CSS', () => {
  it('prevents shelves from shrinking and clipping their row overhang', () => {
    expect(css).toContain('flex-shrink: 0 !important');
    expect(css).toContain('#deck-shelves-home-root .deck-shelves-root > .ds-shelf:nth-child(1) { z-index: 74 !important; }');
    expect(css).toContain('#deck-shelves-home-root .deck-shelves-root > .ds-shelf:nth-child(64) { z-index: 11 !important; }');
    expect(css).toContain('#deck-shelves-home-root .deck-shelves-root');
    expect(css).toContain('isolation: auto !important');
    expect(css).toContain('position: relative !important');
    expect(css).toContain('#deck-shelves-home-root .deck-shelves-root > .ds-shelf .ds-row-scroll');
    expect(css).toContain('#deck-shelves-home-root .deck-shelves-root > .ds-shelf .ds-native-carousel-root,');
    expect(css).toContain('overflow: visible !important');
  });

  it('uses Steam portrait and featured focus depths', () => {
    expect(css).toContain('transform: perspective(300px) translateZ(15px)');
    expect(css).toContain('.ds-card--featured.gpfocus');
    expect(css).toContain('transform: perspective(300px) translateZ(7px)');
  });

  it('lets Steam own native capsule effects without a duplicate custom shell', () => {
    expect(css).toContain('.ds-card.ds-card--native.gpfocus');
    expect(css).toContain('transition: none !important');
    expect(css).not.toContain('.ds-card:not(.ds-card--native) *:focus');
    expect(css).not.toContain('#deck-shelves-home-root .Focusable.gpfocus,');
  });

  it('keeps every Deck Shelves carousel compact under the global Art Hero compatibility flag', () => {
    expect(css).toContain('data-ds-art-hero-active="true"');
    expect(css).toContain('data-ds-keep-shelves-stacked="true"');
    expect(css).toContain('.ds-native-carousel-root');
    expect(css).toContain('height: var(--ds-native-carousel-height) !important');
    expect(css).toContain('top: 0 !important');
    expect(css).toContain('position: static !important');
    expect(css).toContain('margin-top: 8px !important');
    expect(css).toContain('transition-delay: 0.14s !important');
    expect(css).not.toContain('data-ds-ignore-art-hero');
  });

  it('does not override CSS Loader artwork framing for full-screen heroes', () => {
    expect(css).not.toContain('.ds-shelf[data-ds-full-screen-hero="true"] .ds-per-shelf-hero-img');
    expect(css).toContain('object-position: var(--ds-hero-position, 50% 18%)');
  });

  it('fades the native Recent Games heading without removing its layout slot', () => {
    expect(css).toContain('[data-ds-recents-title-faded="true"]');
    expect(css).toContain('opacity: 0 !important');
    expect(css).not.toContain('[data-ds-recents-title-faded="true"] {\n      display: none');
  });

  it('moves custom labels only after the above-row copy is ready', () => {
    expect(css).toContain('.ds-shelf[data-ds-info-above-ready="true"] .ds-card .ds-card-label');
    expect(css).not.toContain('.ds-shelf[data-ds-info-above-ready="true"] .ds-card--native .ds-native-game-name');
    expect(css).not.toContain('.ds-shelf[data-ds-info-above-ready="true"] .ds-card--native .ds-native-status-line');
    expect(css).not.toContain('.ds-shelf[data-ds-info-above="true"] .ds-card .ds-card-label');
  });

  it('repositions Steam original native game-info element instead of cloning it', () => {
    expect(css).toContain('.ds-shelf[data-ds-info-above="true"] .ds-native-carousel-root');
    expect(css).toContain('height: calc(var(--ds-native-carousel-height) + var(--ds-info-above-space)) !important');
    expect(css).toContain('overflow: hidden !important');
    expect(css).toContain('.ds-shelf:not([data-ds-info-above="true"]) [data-ds-native-card="true"] .ZkD6We6MqGbOsa9K3yiY3');
    expect(css).toContain('#deck-shelves-home-root .ds-shelf[data-ds-info-above="true"] .ds-card--native .gpfocuswithin > .ZkD6We6MqGbOsa9K3yiY3');
    expect(css).toContain('#deck-shelves-home-root .ds-shelf[data-ds-info-above="true"] .ds-card--native.gpfocus .ds-native-game-info-root');
    expect(css).toContain('top: var(--met-game-carousel-font-height, -3.5em) !important');
    expect(css).toContain('position: absolute !important');
    expect(css).not.toContain('transition-delay: 0.4s !important');
    expect(css).not.toContain('.ds-native-game-info-clone');
    expect(css).toContain('[data-ds-hover-suppress-native-label="true"]) .ZkD6We6MqGbOsa9K3yiY3');
  });
});
