// 파일 칸의 일(올리기·비우기)은 data/tech-file-actions.ts로 옮겼다 — 대시보드·Monday 표·물 세 레이아웃이 같이
// 쓴다. 여기는 물 이름(WaterFileActions·WaterFileTarget)으로 다시 내보내기만 한다. 물 서랍(record-drawer.tsx)이
// 아직 이 자리에서 가져온다 — 그쪽 import를 data로 바꾸면 이 파일은 지워도 된다.
export {
  techFileActions,
  type TechFileActions as WaterFileActions,
  type TechFileTarget as WaterFileTarget,
} from '../../../data/tech-file-actions'
