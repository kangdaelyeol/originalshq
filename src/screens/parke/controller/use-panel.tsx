import { useState } from 'react'
import { getIcon, getSerialUrl } from '../utils'
import { useParkeContext } from '../context'

const downloadQrCode = (serial: string) => {
  const canvas = document.querySelector('.qr-code-canvas') as HTMLCanvasElement
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `qr-${serial}.png`
  a.click()
}

export const usePanel = () => {
  const [modalActive, setModalActive] = useState(false)
  const [serial, setSerial] = useState('')
  const [iconIndex] = useState(() => Math.floor(Math.random() * 4))
  const { addSerial } = useParkeContext()

  const icon = getIcon(iconIndex)

  const qrImageUrl = getSerialUrl(serial)

  const handler = {
    downloadClick: () => {
      downloadQrCode(serial)
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
