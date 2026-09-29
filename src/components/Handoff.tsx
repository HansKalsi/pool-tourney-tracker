import { createContext, useContext } from 'react'

/**
 * Lets a popover step aside while a dialog opened from inside it is showing, then come back.
 * Anything inside a <HandoffContext.Provider> that opens a dialog calls `suspend()` first and
 * passes `resume` as the dialog's "closed" callback. If the popover's component has unmounted
 * in the meantime (e.g. the game was deleted), resuming is simply a no-op.
 */
export interface Handoff {
  suspend: () => void
  resume: () => void
}

export const HandoffContext = createContext<Handoff | null>(null)

export const useHandoff = () => useContext(HandoffContext)
