import { useCallback } from 'react'
import {
  Assignees,
  BarList,
  GlassCard,
  PhoneLink,
  RecordDrawer,
  RecordTable,
  StagePill,
  StatCard,
} from '../../components/layout-parts'
import type { RecordColumn } from '../../components/board/record-table'
import { countBy } from '@/ohq-ui/charts/chart-utils'
import { usePeriod } from '../../context/period-context'
import { PERIOD_COMPARE } from '../../data/period'
import type { InquiryRecord, TechBoardDoc } from '../../data/tech-boards'
import { formatPhone, splitNames } from '../../data/tech-stage'
import {
  byDateAsc,
  byDateDesc,
  koreaToday,
  periodRange,
  shortDate,
} from '../../lib/dates'
import { useItemParam } from '../../lib/use-item-param'
import { inquiryKpis, receivedIn } from './inquiry-kpis'
import type { BoardDrawerProps } from './registry'

type R = InquiryRecord

const assigneesOf = (r: R) => splitNames(r.assignee)
const searchOf = (r: R) =>
  [
    r.name,
    r.phone,
    r.deviceSeries,
    r.device,
    r.type,
    r.content,
    r.resolution,
    r.assignee,
  ].join(' ')
/** 기기 — 계열(F 시리즈)과 고객이 적은 이름, "기타"는 뺀다. */
const deviceOf = (r: R) =>
  [r.deviceSeries, r.device].filter((v) => v && v !== '기타').join(' · ') ||
  null

const COLUMNS: RecordColumn<R>[] = [
  {
    key: 'name',
    header: '고객명',
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="cell-person">
        <strong>{r.name || '(이름 없음)'}</strong>
        <small>{formatPhone(r.phone) ?? '연락처 없음'}</small>
      </span>
    ),
  },
  {
    key: 'device',
    header: '기기',
    sortValue: (r) => deviceOf(r),
    cell: (r) => deviceOf(r) ?? '—',
  },
  {
    key: 'type',
    header: '문의 종류',
    sortValue: (r) => r.type,
    cell: (r) => r.type ?? '—',
  },
  {
    key: 'content',
    header: '문의 내용',
    sortValue: (r) => r.content,
    cell: (r) => <span className="cell-clip">{r.content ?? '—'}</span>,
    className: 'cell-wide',
  },
  {
    key: 'received',
    header: '접수일',
    sortValue: (r) => r.receivedAt,
    cell: (r) => shortDate(r.receivedAt),
    className: 'table__muted',
  },
  {
    key: 'assignee',
    header: '담당자',
    sortValue: (r) => assigneesOf(r)[0],
    cell: (r) => <Assignees names={assigneesOf(r)} />,
  },
  {
    key: 'stage',
    header: '단계',
    sortValue: (r) => r.stage,
    cell: (r) => <StagePill stage={r.stage} status={r.status} />,
  },
]

/** 아톡문의 — 카카오톡 상담: 신규 접수 → 1차 안내 → 상담 진행중 → 장기 상담 → 완료. */
export function InquiryBoard({ doc }: { doc: TechBoardDoc<'techInquiry'> }) {
  const { period } = usePeriod()
  const [selectedId, setSelectedId] = useItemParam()
  const close = useCallback(() => setSelectedId(null), [setSelectedId])
  const today = koreaToday()
  const { current } = periodRange(period, today)
  const names = PERIOD_COMPARE[period]

  const records = doc.records
  const received = receivedIn(records, current)

  return (
    <>
      <div className="grid grid--kpi">
        {inquiryKpis(doc, period, today).map(({ key, ...card }) => (
          <StatCard key={key} {...card} />
        ))}
      </div>

      <div className="board-body">
        <RecordTable
          title="문의 목록"
          records={records}
          columns={COLUMNS}
          assigneesOf={assigneesOf}
          searchOf={searchOf}
          sortOpen={(a, b) => byDateAsc(a.receivedAt, b.receivedAt)}
          sortDone={(a, b) => byDateDesc(a.receivedAt, b.receivedAt)}
          onSelect={(r) => setSelectedId(r.itemId)}
          selectedId={selectedId}
          searchPlaceholder="고객·기기·문의 내용 검색"
        />

        <div className="grid grid--pair board-body__side">
          <GlassCard
            title="문의 종류"
            subtitle={`${names.current} ${received.length}건`}
          >
            <BarList
              items={countBy(received.map((r) => r.type))}
              ariaLabel="문의 종류별 접수"
              empty="이 기간에 접수된 문의가 없어요."
            />
          </GlassCard>
          <GlassCard
            title="기기 계열"
            subtitle={`${names.current} ${received.length}건`}
          >
            <BarList
              items={countBy(received.map((r) => r.deviceSeries))}
              ariaLabel="기기 계열별 접수"
              empty="이 기간에 접수된 문의가 없어요."
            />
          </GlassCard>
        </div>
      </div>

      <InquiryDrawer doc={doc} selectedId={selectedId} onClose={close} />
    </>
  )
}

/** 아톡문의 상세 서랍 — 보드 화면과 내 업무(registry)가 같이 연다. eyebrow를 주면 보드 이름 대신 그것을 쓴다. */
export function InquiryDrawer({ doc, selectedId, onClose, eyebrow }: BoardDrawerProps<'techInquiry'>) {
  const selected = doc.records.find((r) => r.itemId === selectedId) ?? null
  return (
    <RecordDrawer
      record={selected}
      eyebrow={eyebrow ?? doc.name}
      onClose={onClose}
      fields={
        selected
          ? [
              { label: '기기', value: deviceOf(selected) },
              { label: '문의 종류', value: selected.type },
              { label: '접수일', value: shortDate(selected.receivedAt) },
              {
                label: '담당자',
                value: assigneesOf(selected).join(', ') || null,
              },
              {
                label: '연락처',
                value: selected.phone ? (
                  <PhoneLink phone={selected.phone} />
                ) : null,
              },
            ]
          : []
      }
      texts={
        selected
          ? [
              { label: '문의 내용', text: selected.content },
              { label: '해결 방안', text: selected.resolution },
            ]
          : []
      }
    >
    </RecordDrawer>
  )
}
