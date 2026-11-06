// 디자인 랩 — 공용 부품 카탈로그와 디자인 견본(D1~D10·D13·D14·D16). 랩을 여는 화면에서만 가져다 쓴다(무대·카탈로그
// 스타일도 같이 받는다). 견본 각각의 코드·스타일은 그 탭을 열 때 따로 받는다(showcases.ts).
import './styles/lab.scss'

export { CatalogSpec, UiCatalog } from './catalog'
export { SHOWCASES, type ShowcaseKey } from './showcases'
