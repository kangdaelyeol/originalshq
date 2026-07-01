import { type PropsWithChildren } from 'react'
import { ParkeContext } from './parke-context'

const serialData = ['abcd', 'abce', 'abcf']

export const ParkeContextProvider = ({ children }: PropsWithChildren) => {
  return (
    <ParkeContext.Provider value={{ serialList: serialData }}>
      {children}
    </ParkeContext.Provider>
  )
}
