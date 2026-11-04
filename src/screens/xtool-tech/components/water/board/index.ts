// tech 물 부품(D7) — 보드 칸·편집 칸·기록 표·서랍·토스트. 기존 tech 부품(components/board·layout/toaster)과
// 같은 props라 그대로 바꿔 끼울 수 있다(물 판에만 있는 옵션은 더했다). 스타일은 ../styles/_board.scss.
export { WaterAssignees, WaterPhoneLink, WaterStagePill } from './cells'
export { WaterChipPicker } from './chip-picker'
export { WaterDateTimeInput } from './date-time-input'
export { WaterDrawerShell } from './drawer-shell'
export { WaterAddButton, WaterTextLink } from './links'
export { WaterLocationInput } from './location-input'
export { WaterMultiSelect } from './multi-select'
export {
  WaterDrawerList,
  WaterRecordDrawer,
  type WaterDrawerField,
} from './record-drawer'
export { WaterRecordTable } from './record-table'
export { WaterToaster } from './toaster'
// 파일 칸(상세 서랍) — 스타일은 ../styles/_files.scss. 올리기·비우기는 세 레이아웃이 같이 쓰는
// data/tech-file-actions.ts(물 이름으로 다시 내보낸다)
export { WaterItemFiles } from './water-item-files'
export {
  techFileActions,
  type TechFileActions as WaterFileActions,
  type TechFileTarget as WaterFileTarget,
} from '../../../data/tech-file-actions'
