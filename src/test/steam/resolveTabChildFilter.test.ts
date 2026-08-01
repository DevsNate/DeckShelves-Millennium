import { afterEach, describe, expect, it } from 'vitest'
import {
  invalidateAppOverviewCache,
  resolveShelfAppIds,
  type AppOverview,
} from '../../steam'
import { setPreferredSteamWindow } from '../../runtime/steamHost'

const originalWindow = (globalThis as any).window

function app(appid: number, display_name: string): AppOverview {
  return { appid, display_name }
}

afterEach(() => {
  invalidateAppOverviewCache()
  setPreferredSteamWindow(null)
  if (originalWindow === undefined) delete (globalThis as any).window
  else (globalThis as any).window = originalWindow
})

describe('tab child-filter resolution', () => {
  it('filters the complete dynamic tab before applying the shelf limit', async () => {
    const apps = [
      ...Array.from({ length: 25 }, (_, index) => app(index + 1, `Game ${String(index + 1).padStart(2, '0')}`)),
      app(101, 'Elden Ring'),
      app(102, 'Hollow Knight'),
      app(103, 'Hollow Knight: Silksong'),
    ]
    const steamWindow = {
      SteamClient: {
        Apps: {
          GetAllAppOverviews: async () => apps,
        },
      },
    }
    ;(globalThis as any).window = steamWindow
    setPreferredSteamWindow(steamWindow as unknown as Window)
    invalidateAppOverviewCache()

    const result = await resolveShelfAppIds({
      type: 'tab',
      tab: 'all',
      childFilter: {
        mode: 'or',
        items: [
          { type: 'nameIncludes', params: { text: 'elden' } },
          { type: 'nameIncludes', params: { text: 'hollow' } },
        ],
      },
    }, 20)

    expect(result).toEqual([101, 102, 103])
  })
})
