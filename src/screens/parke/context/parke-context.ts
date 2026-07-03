import { createContext } from 'react'

export interface ParkeContextValue {
  serialList: string[]
  addSerial: (v: string) => void
  removeSerial: (v: string) => void
}

export const ParkeContext = createContext({} as ParkeContextValue)
