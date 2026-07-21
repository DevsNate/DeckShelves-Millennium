import { afterEach, describe, expect, it } from 'vitest'
import {
  flowChildrenProps,
  isMillenniumNavigationRuntime,
  millenniumCardNavKey,
  millenniumShelfRowProps,
  millenniumShelfSectionProps,
} from '../../core/steamOSVersion'

const runtimeFlag = '__DECK_SHELVES_MILLENNIUM__'
const originalFlag = (globalThis as any)[runtimeFlag]

afterEach(() => {
  if (originalFlag === undefined) delete (globalThis as any)[runtimeFlag]
  else (globalThis as any)[runtimeFlag] = originalFlag
})

describe('Millennium Steam navigation contract', () => {
  it('does not change the Decky navigation props', () => {
    delete (globalThis as any)[runtimeFlag]

    expect(isMillenniumNavigationRuntime()).toBe(false)
    expect(flowChildrenProps('horizontal')).toEqual({})
    expect(millenniumShelfSectionProps('recent')).toEqual({})
    expect(millenniumShelfRowProps('recent')).toEqual({})
    expect(millenniumCardNavKey('recent', 123)).toBeUndefined()
  })

  it('uses the current Steam row and column values in Millennium', () => {
    ;(globalThis as any)[runtimeFlag] = true

    expect(flowChildrenProps('horizontal')).toEqual({ 'flow-children': 'row' })
    expect(flowChildrenProps('row')).toEqual({ 'flow-children': 'row' })
    expect(flowChildrenProps('vertical')).toEqual({ 'flow-children': 'column' })
    expect(flowChildrenProps('column')).toEqual({ 'flow-children': 'column' })
  })

  it('gives each shelf and row a stable native navigation identity', () => {
    ;(globalThis as any)[runtimeFlag] = true

    expect(millenniumShelfSectionProps('long-sessions', 'Long Sessions')).toEqual({
      navKey: 'deck-shelves:shelf:long-sessions',
      focusable: false,
      noFocusRing: true,
      navEntryPreferPosition: 2,
      scrollIntoViewWhenChildFocused: true,
      'flow-children': 'column',
    })
    expect(millenniumShelfRowProps('long-sessions', 'Long Sessions')).toEqual({
      navKey: 'deck-shelves:row:long-sessions',
      focusable: false,
      noFocusRing: true,
      navEntryPreferPosition: 2,
      scrollIntoViewWhenChildFocused: true,
      'flow-children': 'row',
    })
  })

  it('keys cards by shelf and item so duplicate apps remain unambiguous', () => {
    ;(globalThis as any)[runtimeFlag] = true

    expect(millenniumCardNavKey('recent', 123)).toBe('deck-shelves:card:recent:123')
    expect(millenniumCardNavKey('long-sessions', 123)).toBe('deck-shelves:card:long-sessions:123')
    expect(millenniumCardNavKey(undefined, undefined, 7)).toBe('deck-shelves:card:shelf:index-7')
  })
})
