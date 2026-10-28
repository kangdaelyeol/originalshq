import { useState } from 'react'
import { downloadQrCode, getIcon, getSerialUrl } from '../utils'
import { useParkeContext } from '../context'

export const usePanel = () => {
  const [modalActive, setModalActive] = useState(false)
  const [serial, setSerial] = useState('')
  const [saving, setSaving] = useState(false)
  const [iconIndex] = useState(() => Math.floor(Math.random() * 4))
  const { addSerial } = useParkeContext()

  const icon = getIcon(iconIndex)

  const qrImageUrl = getSerialUrl(serial)

  const handler = {
    downloadClick: () => {
      const className = '.qr-code-canvas'
      downloadQrCode(serial, className)
    },

    // DB(allow/)에 저장된 뒤에야 QR을 보여준다 — 저장 안 된 QR을 뽑아 쓰는
    // 일이 없게. 실패는 토스트로 알린다.
    createClick: async () => {
      if (saving) return
      const newSerial = Date.now().toString(36)
      setSaving(true)
      const ok = await addSerial(newSerial)
      setSaving(false)
      if (ok) setSerial(newSerial)
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
    saving,
  }
}
