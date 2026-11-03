import { useEffect } from 'react'

/**
 * 브라우저 탭의 제목·아이콘(파비콘)을 이 화면에 있는 동안만 바꾸고, 나가면 되돌린다 —
 * index.html은 originalshq의 다른 화면과 같이 쓰므로 고치지 않는다.
 */
export function useDocumentHead(title: string, iconUrl: string): void {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')]
    const previous = links.map((link) => ({ link, href: link.getAttribute('href') ?? '', type: link.type }))
    if (links.length === 0) {
      const link = document.createElement('link')
      link.rel = 'icon'
      document.head.append(link)
      links.push(link)
    }
    for (const link of links) {
      link.type = 'image/png'
      link.href = iconUrl
    }

    return () => {
      document.title = previousTitle
      for (const link of links) {
        const before = previous.find((p) => p.link === link)
        if (!before) link.remove()
        else {
          link.setAttribute('href', before.href)
          link.type = before.type
        }
      }
    }
  }, [title, iconUrl])
}
