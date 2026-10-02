import { useState } from 'react'

/** Which internal part the "Intelligence inside" hotspots are pointing at. */
export const useSensorPartsViewModel = () => {
  const [part, setPart] = useState(0)

  return {
    state: { part },
    actions: { selectPart: setPart },
  }
}
