import type { ComponentType } from 'react'

export interface LoaderProps {
  /** 한 변 길이 — 숫자는 px. 기본은 참고 영상의 칸 크기(62). */
  size?: number | string
  className?: string
}

export interface LoaderEntry {
  /** 컴포넌트 이름 그대로 — 견본에서 마우스를 올리면 보여 준다(빌드하면 함수 이름이 줄어들어 따로 적는다). */
  name: string
  Component: ComponentType<LoaderProps>
}

export interface LoaderGroup {
  label: string
  items: LoaderEntry[]
}
