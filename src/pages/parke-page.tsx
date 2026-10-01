import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import '@/screens/parke-landing/styles/index.scss'

const GEIST_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap'

const TITLE = 'Parké 파르케 — 앱을 열지 않아도, 연락 대상은 알아서'
const DESCRIPTION =
  '가족이 함께 쓰는 차를 위한 자동 주차번호판. 앱을 열지 않아도 등록 사용자를 인식해 연락 대상을 전환합니다. QR로 열린 웹페이지에서 안심번호로 연락하세요.'

/**
 * Layout for the Parké product site. `.parke-page` is the scope every rule in
 * `screens/parke-landing/styles` hangs off, so it has to wrap the whole route.
 */
export const ParkePage = () => {
  useEffect(() => {
    // The handoff styled `html`/`body` directly; here the page is one node in
    // a larger app, so the document-level bits are set and undone by hand.
    const previousTitle = document.title
    const previousBackground = document.body.style.backgroundColor
    document.title = TITLE
    document.body.style.backgroundColor = '#0c0d0c'

    const description = document.createElement('meta')
    description.name = 'description'
    description.content = DESCRIPTION
    document.head.append(description)

    return () => {
      document.title = previousTitle
      document.body.style.backgroundColor = previousBackground
      description.remove()
    }
  }, [])

  useEffect(() => {
    // Replaces next/font's Geist. Loaded on this route only.
    if (document.head.querySelector(`link[href="${GEIST_HREF}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = GEIST_HREF
    document.head.append(link)
  }, [])

  return (
    <div className="parke-page">
      <Outlet />
    </div>
  )
}
