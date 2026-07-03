import { useState } from 'react'
import { PARKE_URL } from '../constants'

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

  const icon =
    iconIndex === 0
      ? "(='X'=)"
      : iconIndex === 1
        ? '(^-^*)'
        : iconIndex === 2
          ? '(o^^)o'
          : '(;-;)'

  const qrImageUrl = PARKE_URL + '/' + serial

  const handler = {
    downloadClick: () => {
      downloadQrCode(serial)
    },

    createClick: () => {
      setSerial('mr1nzp99')
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
    serial
  }
}
