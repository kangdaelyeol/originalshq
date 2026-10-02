import { useState } from 'react'

/** Which parking scenario tab is open. The tab primitive speaks in strings. */
export const useSituationMapViewModel = () => {
  const [scenario, setScenario] = useState('0')

  return {
    state: { scenario },
    actions: { selectScenario: (value: unknown) => setScenario(String(value)) },
  }
}
