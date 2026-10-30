import '@/screens/xtool-lead-manager/styles/nav.scss'
import '@/screens/xtool-lead-manager/styles/main.scss'
import '@/screens/xtool-lead-manager/styles/monday-stats.scss'
import '@/screens/xtool-lead-manager/styles/ga-tracking.scss'
import '@/screens/xtool-lead-manager/styles/funnel-glass.scss'
import { Fingerprint, Radar, RefreshCw, UserX, X } from 'lucide-react'
import {
  AutoHeight,
  LoadingPanel,
  Segmented,
  StatTile,
} from '@/components/glass'
import { useRef } from 'react'
import { useModal } from '@/screens/xtool-lead-manager/hooks/use-modal'
import {
  eventSource,
  shortPath,
  type GaTrackingRow,
} from '@/screens/xtool-lead-manager/utils'
import type {
  GaTrackingFilter,
  useGaTrackingViewModel,
} from '@/screens/xtool-lead-manager/view-model'

type GaTrackingProps = ReturnType<typeof useGaTrackingViewModel>

const FILTER_LABEL: Record<GaTrackingFilter, string> = {
  misentry: '오기입만',
  all: 'GA ClientId 있는 상담 전체',
}

/** ms → "10/21 14:03:21"(KST). */
const formatTime = (ms: number | null): string => {
  if (ms === null) return '-'
  const iso = new Date(ms + 9 * 3_600_000).toISOString()
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))} ${iso.slice(11, 19)}`
}

/** GA ClientId를 짧게 — 앞 4자리…뒤 4자리. */
const shortClientId = (id: string) =>
  id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id

/** 한 사람의 GA4 이벤트 — 시간순. 세션(GA4가 나눈 방문)이 바뀌는 곳에 번호를
 * 붙여, 몇 번째 방문에서 무엇을 했는지 보이게 한다. */
const Timeline = ({ row }: { row: GaTrackingRow }) => {
  if (row.events.length === 0) {
    return (
      <p className="ga_tracking_empty">
        이 GA ClientId로 찾은 GA4 이벤트가 없습니다. 아직 BigQuery로 넘어오지
        않았거나(일별 내보내기는 다음 날 반영), 다른 브라우저에서 문의했을 수
        있습니다.
      </p>
    )
  }
  const sessionNumber = new Map<number, number>()
  for (const event of row.events) {
    if (event.sessionId !== null && !sessionNumber.has(event.sessionId)) {
      sessionNumber.set(event.sessionId, sessionNumber.size + 1)
    }
  }
  return (
    <table className="stats_table ga_tracking_timeline">
      <thead>
        <tr>
          <th>시각</th>
          <th>방문</th>
          <th>이벤트</th>
          <th>페이지</th>
          <th>유입</th>
        </tr>
      </thead>
      <tbody>
        {row.events.map((event, index) => {
          const session =
            event.sessionId === null ? null : sessionNumber.get(event.sessionId)
          const newSession =
            index > 0 && event.sessionId !== row.events[index - 1].sessionId
          return (
            <tr
              key={`${event.at}-${index}`}
              className={newSession ? 'ga_tracking_session_start' : undefined}
            >
              <td>{formatTime(event.at)}</td>
              <td>{session ? `${session}번째` : '-'}</td>
              <td>
                <span className="ga_tracking_event">{event.name}</span>
              </td>
              <td title={event.pageLocation ?? undefined}>
                {event.pageTitle ?? shortPath(event.pageLocation) ?? '-'}
              </td>
              <td>{eventSource(event) ?? '-'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** 한 사람의 추적 상세(모달) — 위에 상담 정보와 요약, 아래에 GA4 이벤트
 * 타임라인. Esc·바깥 클릭·닫기 버튼으로 닫는다. */
const TrackingModal = ({
  row,
  onClose,
}: {
  row: GaTrackingRow
  onClose: () => void
}) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { consultation } = row

  useModal(onClose, closeRef)

  const facts: [string, string][] = [
    ['접수일', consultation.receivedAt ?? '-'],
    ['보드', consultation.boardName],
    ['입력한 번호', consultation.phoneRaw ?? '-'],
    ['상태', consultation.status ?? '-'],
    ['GA ClientId', consultation.gaClientId],
    ['이벤트', `${row.events.length}건`],
    ['방문', `${row.sessionCount}회`],
    ['첫 유입', row.firstTouch ?? '-'],
    ['기기', row.device ?? '-'],
    ['위치', row.location ?? '-'],
    ['첫 활동', formatTime(row.firstAt)],
    ['마지막 활동', formatTime(row.lastAt)],
  ]

  return (
    <div className="ga_tracking_modal" onClick={onClose}>
      <div
        className="ga_tracking_dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ga-tracking-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ga_tracking_dialog_head">
          <h2 id="ga-tracking-title">
            {consultation.url ? (
              <a href={consultation.url} target="_blank" rel="noreferrer">
                {consultation.name}
              </a>
            ) : (
              consultation.name
            )}
            {consultation.misentry && (
              <span className="ga_tracking_badge">오기입</span>
            )}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="ga_tracking_close"
            aria-label="닫기"
            onClick={onClose}
          >
            <X strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <dl className="ga_tracking_facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="ga_tracking_dialog_body">
          <Timeline row={row} />
        </div>
      </div>
    </div>
  )
}

/**
 * 오기입 추적 탭 — 상담 보드에 GA ClientId가 적힌 문의를, 같은 id의 GA4
 * 이벤트(BigQuery)와 맞춰 본다. 오기입 문의가 실제 사람이 번호를 잘못 적은
 * 것인지, 스팸·봇인지 판단하는 데 쓴다(유입 경로, 기기, 방문 횟수, 폼 제출 전
 * 행동).
 */
export const GaTracking = ({ state, actions }: GaTrackingProps) => {
  const {
    status,
    filter,
    rows,
    totalCount,
    misentryCount,
    matchedCount,
    openItemId,
    collectedAt,
    lastResult,
    collectError,
    collecting,
  } = state
  const ready = status === 'ready'
  const openRow =
    rows.find((row) => row.consultation.itemId === openItemId) ?? null

  return (
    <>
      <div className="lead_manager_nav monday_stats_nav ga_nav glass_theme">
        <div className="inner">
          <Segmented
            options={FILTER_LABEL}
            value={filter}
            onChange={actions.changeFilter}
            label="보기"
            size="md"
          />
          <button
            type="button"
            className="stats_reset"
            disabled={collecting}
            onClick={() => void actions.collectNow()}
          >
            <RefreshCw
              strokeWidth={1.8}
              className={collecting ? 'is-spinning' : undefined}
              aria-hidden="true"
            />
            {collecting ? '수집 중…' : '지금 수집'}
          </button>
        </div>
      </div>

      <div className="xtool-main monday_stats ga_tracking ga_main glass_theme">
        <div className="wrapper">
          {status === 'error' ? (
            <div className="monday_error">
              <p>오기입 추적 데이터를 불러오지 못했습니다.</p>
              <button type="button" onClick={() => void actions.reload()}>
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* 위 줄 — 건수 요약(보기 선택과 무관). */}
              <div className="stats_tiles ga_tiles">
                <StatTile
                  icon={Fingerprint}
                  label="GA ClientId 있는 상담"
                  value={
                    ready ? `${totalCount.toLocaleString('ko-KR')}건` : '-'
                  }
                  sub="상담 보드에 GA ClientId가 적힌 문의"
                />
                <StatTile
                  icon={UserX}
                  label="오기입"
                  value={
                    ready ? `${misentryCount.toLocaleString('ko-KR')}건` : '-'
                  }
                  warn={misentryCount > 0}
                  sub={
                    totalCount > 0
                      ? `GA ClientId 있는 상담의 ${((misentryCount / totalCount) * 100).toFixed(1)}%`
                      : undefined
                  }
                  onGo={
                    filter === 'misentry'
                      ? undefined
                      : () => actions.changeFilter('misentry')
                  }
                  linkLabel="오기입만 보기"
                />
                <StatTile
                  icon={Radar}
                  label="GA4에서 찾은 건"
                  value={
                    ready ? `${matchedCount.toLocaleString('ko-KR')}건` : '-'
                  }
                  sub={`지금 목록 ${rows.length.toLocaleString('ko-KR')}건 중`}
                />
                <StatTile
                  icon={RefreshCw}
                  label="마지막 수집"
                  value={collectedAt ? formatTime(collectedAt) : '-'}
                  sub="Monday 동기화 직후 자동 · 당일 이벤트는 다음 날"
                />
              </div>
              {/* 불러오는 동안은 카드에 로딩만 → 다 받으면 제목·설명·표가 그
                  높이에서 자라며 흐릿하게 떠오른다. */}
              <section className="stats_card">
                <AutoHeight>
                  {status !== 'ready' ? (
                    <LoadingPanel
                      label="오기입 추적 데이터를 불러오는 중"
                      minHeight={420}
                    />
                  ) : (
                    <div className="glass_reveal">
                      <h2>GA4 이벤트로 본 문의자</h2>
                      <p className="stats_desc">
                        상담 보드의 GA ClientId와 GA4 BigQuery의 사용자 id가
                        같은 이벤트를 모았습니다. 줄을 누르면 그 사람의 이벤트가
                        시간순으로 모달에 뜹니다. 이벤트는 Monday 동기화(매일
                        09·11·13·15·17·22시) 직후 자동으로 수집되고, GA4
                        내보내기가 일별이라 당일 이벤트는 다음 날 들어옵니다.
                        {collectedAt
                          ? ` 마지막 수집 ${formatTime(collectedAt)}`
                          : ' 아직 수집한 적이 없습니다 — "지금 수집"을 눌러 주세요.'}
                        {lastResult &&
                          ` · 이번 수집에서 새 id ${lastResult.newClientIds}개, 갱신 ${lastResult.writtenDocs}명, 읽은 데이터 ${(lastResult.bytesProcessed / 1024 ** 2).toFixed(1)}MB`}
                      </p>
                      {collectError && (
                        <p className="ga_tracking_error">
                          GA4 이벤트 수집에 실패했습니다 — {collectError}
                        </p>
                      )}
                      {rows.length === 0 ? (
                        <p className="ga_tracking_empty">
                          해당하는 상담이 없습니다.
                        </p>
                      ) : (
                        <div className="ga_tracking_scroll">
                          <table className="stats_table ga_tracking_table">
                            <thead>
                              <tr>
                                <th>접수일</th>
                                <th>보드</th>
                                <th>이름</th>
                                <th>입력한 번호</th>
                                <th>상태</th>
                                <th>GA ClientId</th>
                                <th>이벤트</th>
                                <th>방문</th>
                                <th>첫 유입</th>
                                <th>기기</th>
                                <th>위치</th>
                                <th>마지막 활동</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const { consultation } = row
                                return (
                                  <tr
                                    key={consultation.itemId}
                                    className="ga_tracking_row"
                                    onClick={() =>
                                      actions.openRow(consultation.itemId)
                                    }
                                  >
                                    <td>{consultation.receivedAt ?? '-'}</td>
                                    <td>{consultation.boardName}</td>
                                    <td>
                                      {consultation.url ? (
                                        <a
                                          href={consultation.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {consultation.name}
                                        </a>
                                      ) : (
                                        consultation.name
                                      )}
                                    </td>
                                    <td>{consultation.phoneRaw ?? '-'}</td>
                                    <td
                                      className={
                                        consultation.misentry
                                          ? 'ga_tracking_misentry'
                                          : undefined
                                      }
                                    >
                                      {consultation.status ?? '-'}
                                    </td>
                                    <td title={consultation.gaClientId}>
                                      {shortClientId(consultation.gaClientId)}
                                    </td>
                                    <td>{row.events.length}</td>
                                    <td>{row.sessionCount}</td>
                                    <td>{row.firstTouch ?? '-'}</td>
                                    <td>{row.device ?? '-'}</td>
                                    <td>{row.location ?? '-'}</td>
                                    <td>{formatTime(row.lastAt)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </AutoHeight>
              </section>
            </>
          )}
        </div>
        {openRow && <TrackingModal row={openRow} onClose={actions.closeRow} />}
      </div>
    </>
  )
}
