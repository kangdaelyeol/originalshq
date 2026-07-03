import { useState, type PropsWithChildren } from 'react'
import { ParkeContext } from './parke-context'

export const ParkeContextProvider = ({ children }: PropsWithChildren) => {
  const [serialData, setSerialData] = useState(['abcd', 'abce', 'abcf'])
  
  const addSerial = (serial: string) => {
    setSerialData((prev) => [...prev, serial])
    return
  }

  const removeSerial = (serial: string) => {
    setSerialData((prev) => prev.filter((s) => s !== serial))
    return
  }

  return (
    <ParkeContext.Provider
      value={{ serialList: serialData, addSerial, removeSerial }}
    >
      {children}
    </ParkeContext.Provider>
  )
}
