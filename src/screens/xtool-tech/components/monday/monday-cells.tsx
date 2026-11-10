import { Check, FileText, MapPin, Timer, UserRound } from 'lucide-react'
import type { CSSProperties } from 'react'
import { initialsOf } from '@/xtool-auth/use-xtool-session'
import type { TechCellValue, TechColumn } from '@xtool-core/tech-boards'
import { usePhotoOf } from '../../data/tech-profiles'
import { isPhoneColumn } from '@xtool-core/tech-edit'
import { formatPhone } from '@xtool-core/tech-stage'
import { elapsedSeconds, formatDuration, hasTime, timeTracking, useTickingNow } from '@xtool-core/time-tracking'
import { cx } from '@/ohq-ui/lib/cx'
import { personColor } from '../../lib/person-color'
import { useAssigneeHover } from '../assignee-hover'
import { fileCount, isChecked, mondayDate, parseJson, splitText } from './monday-values'

// Monday 표 칸 하나 — 컬럼 타입마다 Monday 다크 모드처럼 그린다.

/** 사람 동그라미 하나 — 프로필 사진이 있으면 사진, 없으면 이름 색 + 이니셜. */
export function PersonAvatar({ name, photo }: { name: string; photo?: string }) {
  return (
    <span className={cx('mon-avatar', photo && 'has-photo')} style={{ '--avatar': personColor(name) } as CSSProperties}>
      {photo ? <img src={photo} alt="" /> : initialsOf(name, '')}
    </span>
  )
}

/** 사람 동그라미 — Monday처럼 둘까지 겹쳐 그리고 나머지는 +N, 비어 있으면 빈 사람 모양. */
function People({ names }: { names: string[] }) {
  const photoOf = usePhotoOf()
  // 칸에는 동그라미만 보여서 한 명이어도 마우스를 올리면 이름 카드를 띄운다.
  const hover = useAssigneeHover(names)
  if (names.length === 0) {
    return (
      <span className="mon-people__empty" aria-label="담당자 없음">
        <UserRound size={15} strokeWidth={2.8} aria-hidden />
      </span>
    )
  }
  const shown = names.length > 2 ? names.slice(0, 1) : names
  return (
    <span className="mon-people" {...hover.anchorProps}>
      {shown.map((name, i) => (
        <PersonAvatar key={`${name}-${i}`} name={name} photo={photoOf(name)} />
      ))}
      {names.length > 2 && <span className="mon-avatar mon-avatar--more">+{names.length - 1}</span>}
      <span className="sr-only">{names.join(', ')}</span>
      {hover.card}
    </span>
  )
}

/** 시간 추적(타이머) — 켜져 있으면 1초마다 올라간다(값은 Monday에서 켜고 끌 때만 바뀐다 — time-tracking.ts) */
function TimeTrackingView({ cell }: { cell: TechCellValue | undefined }) {
  const t = timeTracking(cell)
  const now = useTickingNow(!!t?.running)
  if (!t) return cell?.text?.trim() ? <span className="mon-text">{cell.text}</span> : null
  if (!hasTime(t)) return null
  return (
    <span className={cx('mon-timer', t.running && 'is-running')} title={t.running ? '진행 중' : '멈춤'}>
      <Timer size={13} aria-hidden />
      <span className="mon-text">{formatDuration(elapsedSeconds(t, now))}</span>
    </span>
  )
}

interface CellViewProps {
  column: TechColumn
  cell: TechCellValue | undefined
}

/** 칸 안에 보이는 값 */
export function CellView({ column, cell }: CellViewProps) {
  const text = cell?.text?.trim() ?? ''
  switch (column.type) {
    case 'status':
      return <span className="mon-status__label">{text}</span>
    case 'dropdown':
    case 'board_relation':
      return (
        <span className="mon-chips">
          {splitText(text).map((label, i) => (
            <span key={`${label}-${i}`} className="mon-chip">
              {label}
            </span>
          ))}
        </span>
      )
    // 담당자(엑스툴, 'assignee')는 기술팀 이름이 글자로 적혀 있다(monday-values visibleColumns).
    case 'people':
    case 'assignee':
      return <People names={splitText(text)} />
    case 'date':
      return text ? <span className="mon-text">{mondayDate(text)}</span> : null
    case 'checkbox':
      return (
        <span className={cx('mon-check', isChecked(cell) && 'is-on')} aria-label={isChecked(cell) ? '체크됨' : '체크 안 됨'}>
          {isChecked(cell) && <Check size={13} strokeWidth={3} aria-hidden />}
        </span>
      )
    case 'location':
      return text ? (
        <span className="mon-location">
          <MapPin size={13} aria-hidden />
          <span className="mon-text">{text}</span>
        </span>
      ) : null
    case 'link': {
      const url = String(parseJson(cell?.value)?.url ?? '')
      return url ? (
        <a className="mon-link mon-text" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {text || url}
        </a>
      ) : null
    }
    case 'phone':
      // 글자 칸과 같은 모양 — 010-1234-5678
      return text ? <span className="mon-text">{formatPhone(text) ?? text}</span> : null
    case 'time_tracking':
      return <TimeTrackingView cell={cell} />
    case 'file': {
      const count = fileCount(cell)
      return count > 0 ? (
        <span className="mon-file" title={`파일 ${count}개`}>
          <FileText size={14} aria-hidden />
          {count}
        </span>
      ) : null
    }
    default:
      if (text && isPhoneColumn(column)) return <span className="mon-text">{formatPhone(text) ?? text}</span>
      return text ? <span className="mon-text">{text}</span> : null
  }
}
