import { useState } from 'react'
import { downloadQrCode, getIcon, getSerialUrl } from '../utils'
import { useParkeContext } from '../context'

export const usePanel = () => {
  const [modalActive, setModalActive] = useState(false)
  const [serial, setSerial] = useState('')
  const [iconIndex] = useState(() => Math.floor(Math.random() * 4))
  const { addSerial } = useParkeContext()

  const icon = getIcon(iconIndex)

  const qrImageUrl = getSerialUrl(serial)

  const handler = {
    downloadClick: () => {
      const className = '.qr-code-canvas'
      downloadQrCode(serial, className)
    },

    createClick: () => {
      const newSerial = Date.now().toString(36)
      setSerial(newSerial)
      addSerial(newSerial)
    },

    frameClick: () => {
      setModalActive(true)
    },

    closeClick: () => {
      setModalActive(false)
    },
  }

  return {
    handler,
    modalActive,
    icon,
    qrImageUrl,
    serial,
  }
}
