import { STATUS_ICON, STATUS_LABEL, type SlotState } from '../utils/batch-run'

/** 상태 배지 — 기호 + 이름. 색만으로 구분하지 않는다. */
export const StatusBadge = ({ state }: { state: SlotState }) => (
  <span className={`batch-log__badge is-${state}`}>
    {STATUS_ICON[state] && <span aria-hidden="true">{STATUS_ICON[state]}</span>}
    {STATUS_LABEL[state]}
  </span>
)
