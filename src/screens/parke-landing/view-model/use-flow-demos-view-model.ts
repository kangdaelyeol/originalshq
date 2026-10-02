import { useState } from 'react'

/** Co-ride demo: who the reader picked in the mock push notification. */
export const useCoRideChoiceViewModel = () => {
  const [selected, setSelected] = useState<string | null>(null)

  return {
    state: { selected },
    actions: {
      select: setSelected,
      /** Switching tabs starts the demo over. */
      reset: () => setSelected(null),
    },
  }
}

/** Caller demo steps: 0 scan the QR, 1 the web page, 2 the call placed. */
export const useCallerFlowViewModel = () => {
  const [step, setStep] = useState(0)

  return {
    state: { step },
    actions: {
      goToStep: setStep,
      /** The call button doubles as "back to the page" once pressed. */
      toggleCall: () => setStep((current) => (current === 2 ? 1 : 2)),
    },
  }
}
