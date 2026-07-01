import { useContext } from 'react'
import { ParkeContext } from './parke-context'

export * from './parke-context-provider'
export const useParkeContext = () => useContext(ParkeContext)
