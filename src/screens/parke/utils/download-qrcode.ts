export const downloadQrCode = (serial: string, className: string) => {
  const canvas = document.querySelector(className) as HTMLCanvasElement
  console.log(canvas)
  if (!canvas) return
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `qr-${serial}.png`
  a.click()
}
