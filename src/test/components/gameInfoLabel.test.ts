// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cloneGameInfoLabel, shouldShowGameInfoOverlay } from '../../components/shelf/gameInfoLabel';

describe('cloneGameInfoLabel', () => {
  it('preserves the complete custom-card label structure', () => {
    const card = document.createElement('div');
    card.innerHTML = '<div class="ds-card-label"><div class="ds-card-label-name">Portal 2</div><div class="ds-card-status">10 hrs</div></div>';

    const clone = cloneGameInfoLabel(card);

    expect(clone).not.toBe(card.querySelector('.ds-card-label'));
    expect(clone?.textContent).toBe('Portal 210 hrs');
  });

  it('does not clone native title/status DOM', () => {
    const card = document.createElement('div');
    card.className = 'ds-card ds-card--native';
    card.setAttribute('data-name', 'ELDEN RING');
    card.innerHTML = '<div class="steam-native-info"><div class="steam-marquee"><div class="ds-native-game-name">ELDEN RING</div></div><div class="ds-native-status-line"><svg class="DownloadArrow"></svg><span>LAST TWO WEEKS: 1 MIN</span></div></div>';

    expect(cloneGameInfoLabel(card)).toBeNull();
  });

  it('honors native-card name and status visibility settings', () => {
    const card = document.createElement('div');
    card.className = 'ds-card ds-card--native';
    card.setAttribute('data-name', 'ELDEN RING');
    card.setAttribute('data-ds-hide-game-name', 'true');
    card.setAttribute('data-ds-hide-status', 'true');
    card.innerHTML = '<div class="ds-native-status-line">LAST TWO WEEKS: 1 MIN</div>';

    expect(cloneGameInfoLabel(card)).toBeNull();
  });

  it('shows a selected-item header only for the shelf that owns focus', () => {
    expect(shouldShowGameInfoOverlay(true, true, true)).toBe(true);
    expect(shouldShowGameInfoOverlay(true, true, false)).toBe(false);
    expect(shouldShowGameInfoOverlay(true, false, true)).toBe(false);
  });

});
