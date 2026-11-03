import { lazy, type ComponentType } from 'react'

// 디자인 견본(D1~D10) — 참고 영상의 디자인을 옮긴 것. 묶음마다 코드와 스타일을 따로 받는다(그 탭을 열 때만).
// 한 번에 넣으면 견본을 보지 않는 사람도 견본(WebGL 셰이더·아이콘 150개, 스타일 약 110KB 등)까지 받게 된다.

export type ShowcaseKey = 'design1' | 'design2' | 'design3' | 'design4' | 'design5' | 'design6' | 'design7' | 'design8' | 'design9' | 'design10'

export const SHOWCASES: readonly { value: ShowcaseKey; label: string; Component: ComponentType }[] = [
  {
    value: 'design1',
    label: 'D1',
    Component: lazy(() =>
      Promise.all([import('./showcase/design1/design1-showcase'), import('./styles/showcase/design1.scss')]).then(
        ([m]) => ({ default: m.Design1Showcase }),
      ),
    ),
  },
  {
    value: 'design2',
    label: 'D2',
    Component: lazy(() =>
      Promise.all([import('./showcase/design2/design2-showcase'), import('./styles/showcase/design2.scss')]).then(
        ([m]) => ({ default: m.Design2Showcase }),
      ),
    ),
  },
  {
    value: 'design3',
    label: 'D3',
    Component: lazy(() =>
      Promise.all([import('./showcase/design3/design3-showcase'), import('./styles/showcase/design3.scss')]).then(
        ([m]) => ({ default: m.Design3Showcase }),
      ),
    ),
  },
  {
    value: 'design4',
    label: 'D4',
    Component: lazy(() =>
      Promise.all([import('./showcase/design4/design4-showcase'), import('./styles/showcase/design4.scss')]).then(
        ([m]) => ({ default: m.Design4Showcase }),
      ),
    ),
  },
  {
    value: 'design5',
    label: 'D5',
    Component: lazy(() =>
      Promise.all([import('./showcase/design5/design5-showcase'), import('./styles/showcase/design5.scss')]).then(
        ([m]) => ({ default: m.Design5Showcase }),
      ),
    ),
  },
  {
    value: 'design6',
    label: 'D6',
    Component: lazy(() =>
      Promise.all([import('./showcase/design6/design6-showcase'), import('./styles/showcase/design6.scss')]).then(
        ([m]) => ({ default: m.Design6Showcase }),
      ),
    ),
  },
  {
    value: 'design7',
    label: 'D7',
    Component: lazy(() =>
      Promise.all([import('./showcase/design7/design7-showcase'), import('./styles/showcase/design7.scss')]).then(
        ([m]) => ({ default: m.Design7Showcase }),
      ),
    ),
  },
  {
    value: 'design8',
    label: 'D8',
    Component: lazy(() =>
      Promise.all([import('./showcase/design8/design8-showcase'), import('./styles/showcase/design8.scss')]).then(
        ([m]) => ({ default: m.Design8Showcase }),
      ),
    ),
  },
  {
    value: 'design9',
    label: 'D9',
    Component: lazy(() =>
      Promise.all([import('./showcase/design9/design9-showcase'), import('./styles/showcase/design9.scss')]).then(
        ([m]) => ({ default: m.Design9Showcase }),
      ),
    ),
  },
  {
    value: 'design10',
    label: 'D10',
    Component: lazy(() =>
      Promise.all([import('./showcase/design10/design10-showcase'), import('./styles/showcase/design10.scss')]).then(
        ([m]) => ({ default: m.Design10Showcase }),
      ),
    ),
  },
]
