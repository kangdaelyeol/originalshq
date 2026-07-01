import { createContext } from 'react'

export interface ParkeContextValue {
  serialList: string[]
}

export const ParkeContext = createContext({} as ParkeContextValue)
