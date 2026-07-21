import type { ReactElement } from 'react'
import { showModal } from '../../../runtime/host/decky'
import { logInfo } from '../../../runtime/logger'
import { getPreferredSteamWindow } from '../../../runtime/steamHost'

export function openManagedModal(render: (close: () => void) => ReactElement) {
  let handle: any = null
  const close = () => {
    try {
      if (typeof handle === 'function') return handle()
      if (handle?.Close) return handle.Close()
      if (handle?.closeModal) return handle.closeModal()
      if (handle?.props?.closeModal) return handle.props.closeModal()
    } catch (e) { logInfo("SETTINGS", "modal close failed", String(e)) }
  }
  try {
    const parent = (globalThis as any).__DECK_SHELVES_MILLENNIUM__
      ? getPreferredSteamWindow()
      : undefined
    handle = showModal(render(close), parent as any, {
      strTitle: 'Deck Shelves',
      bHideMainWindowForPopouts: false,
    } as any)
  } catch (e) {
    logInfo("SETTINGS", "modal open failed", String(e))
  }
  return close
}
