/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { setRuntimeClassMap } from '../../core/webpackCompat';
import { resolveNativeCardClass } from '../../components/shelf/cardUtils';

function card(classes: string, width: number, height: number, transform = 'none'): HTMLElement {
  const el = document.createElement('div');
  el.className = `native-card ${classes}`;
  el.style.transform = transform;
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
  document.body.appendChild(el);
  return el;
}

describe('resolveNativeCardClass', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setRuntimeClassMap(document, { nativeCard: 'native-card' });
  });

  it('uses an idle portrait sample instead of the leading featured card', () => {
    card('landscape featured hovered', 552, 258, 'translateZ(7px)');
    card('portrait idle', 172, 258);

    const result = resolveNativeCardClass(document);

    expect(result).toContain('portrait');
    expect(result).toContain('idle');
    expect(result).not.toContain('landscape');
    expect(result).not.toContain('featured');
    expect(result).not.toContain('hovered');
  });

  it('uses the landscape sample for a featured Deck Shelves card', () => {
    card('landscape featured', 552, 258);
    card('portrait idle', 172, 258);

    const result = resolveNativeCardClass(document, true);

    expect(result).toContain('landscape');
    expect(result).toContain('featured');
    expect(result).not.toContain('portrait');
  });
});
