import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAutoRefresh } from './use-auto-refresh'
import {
  deleteInquiries,
  getInquiries,
  getInquirySettings,
  retryInquiry,
  saveInquirySettings,
  type Inquiry,
  type InquirySettings,
} from '../client/inquiry-client'
import { keptDays, useIncrementalList } from './use-incremental-list'

// 이어 받기로는 다른 사람이 지운 문의를 알 수 없어서, 이만큼 지나면 기간
// 전체를 다시 받아 맞춘다.
const FULL_RELOAD_MS = 10 * 60_000

const KEEP_KEY = 'inquiry'
const inquiryIdOf = (inquiry: Inquiry) => inquiry.id
const inquiryTimeOf = (inquiry: Inquiry) => inquiry.receivedAt

export const INQUIRY_PERIOD_OPTIONS = [
  { days: 1, label: '오늘' },
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
] as const

export type InquiryFilter = 'all' | 'problem'

/** 문자 내용 자리표시자 — 서버(inquiry/index.ts의 renderTemplate)와 같다. */
export const TEMPLATE_TOKENS = ['{고객명}', '{기기}', '{전화번호}'] as const

/** 문자 길이(byte) — 한글 등은 2byte. 90byte를 넘으면 LMS로 나간다. */
export const smsBytes = (text: string) =>
  [...text].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)

/** 단문(SMS) 한도 — 넘으면 장문(LMS)으로 나가고 제목이 붙는다. */
export const SMS_MAX_BYTES = 90

/** 장문(LMS) 제목 한도 — 서버(inquiry/solapi.ts)와 같다. */
export const LMS_SUBJECT_MAX_BYTES = 40

/** 미리보기용 — 서버와 같은 규칙으로 예시 값을 넣는다. */
export const previewTemplate = (template: string) =>
  template
    .split('{고객명}')
    .join('홍길동')
    .split('{기기}')
    .join('F2 울트라')
    .split('{전화번호}')
    .join('010-1234-5678')

const isProblem = (inquiry: Inquiry) =>
  inquiry.monday.status !== 'success' || inquiry.sms.status === 'failed'

/** 검색 — 고객명에 그대로 들어 있거나, 숫자만 비교해 번호에 들어 있으면
 * 맞는다(010-1234-5678을 "1234"나 "01012345678"로 찾을 수 있게). */
const matchesSearch = (inquiry: Inquiry, query: string) => {
  const text = query.trim().toLowerCase()
  if (!text) return true
  if (inquiry.name.toLowerCase().includes(text)) return true
  if (inquiry.company?.toLowerCase().includes(text)) return true
  const digits = text.replace(/\D/g, '')
  return digits.length >= 2 && inquiry.phone.replace(/\D/g, '').includes(digits)
}

/**
 * /log의 "문의 접수" 탭 — 웹사이트 상담 신청(inquiries)이 Monday 보드에
 * 등록되고 접수 안내 문자가 나갔는지 확인한다. 실패한 단계는 다시 실행하고,
 * 문자 설정(발송 여부·발신 번호·내용)도 여기서 고친다. 1분마다 다시 받는다.
 */
export const useInquiryLogViewModel = () => {
  const [days, setDays] = useState(() => keptDays(KEEP_KEY) ?? 7)
  const [filter, setFilter] = useState<InquiryFilter>('all')
  const [search, setSearch] = useState('')
  // 기기 필터 — null이면 전체.
  const [device, setDevice] = useState<string | null>(null)
  // 체크한 접수 기록(id) — 한 번에 지운다.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [deleting, setDeleting] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  // 다시 실행 중인 "id:step" — 버튼을 잠근다.
  const [retrying, setRetrying] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // 문자 설정 — 서버 값과, 화면에서 고치는 중인 값.
  const [settings, setSettings] = useState<InquirySettings | null>(null)
  const [draft, setDraft] = useState<Omit<InquirySettings, 'updatedAt'> | null>(
    null,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)

  // 기간 전체를 다시 받았을 때 목록에서 사라진 기록은 선택에서도 뺀다.
  const pruneSelection = useCallback((list: Inquiry[]) => {
    const ids = new Set(list.map((each) => each.id))
    setSelected((chosen) => new Set([...chosen].filter((id) => ids.has(id))))
  }, [])
  // 받기·이어 받기·탭을 오갈 때 보관은 공용 훅이 맡는다. 이어 받기로는 남이 지운
  // 문의를 알 수 없어서 10분마다 기간 전체를 다시 받는다.
  const {
    items: inquiries,
    setItems: setInquiries,
    status,
    error,
    fetchedAt,
    now,
    load,
  } = useIncrementalList({
    keepKey: KEEP_KEY,
    days,
    fetchPage: getInquiries,
    idOf: inquiryIdOf,
    timeOf: inquiryTimeOf,
    fullEveryMs: FULL_RELOAD_MS,
    onFull: pruneSelection,
  })

  // 1분마다 다시 받는다(탭이 숨겨져 있으면 건너뛴다).
  useAutoRefresh(load)

  useEffect(() => {
    ;(async () => {
      const res = await getInquirySettings()
      if (!res.ok) {
        setSettingsMessage(res.error)
        return
      }
      setSettings(res.data.settings)
      setDraft(res.data.settings)
    })()
  }, [])

  const retry = useCallback(
    async (id: string, step: 'monday' | 'sms') => {
      setRetrying(`${id}:${step}`)
      setActionError(null)
      const res = await retryInquiry(id, step)
      setRetrying(null)
      if (!res.ok) {
        setActionError(res.error)
        return
      }
      setInquiries((prev) =>
        prev.map((each) => (each.id === id ? res.data.inquiry : each)),
      )
    },
    [setInquiries],
  )

  /** 저장 — 실패하면 오류 문구, 성공하면 null(저장 알림용). */
  const saveSettings = useCallback(async (): Promise<string | null> => {
    if (!draft) return null
    setSaving(true)
    setSettingsMessage(null)
    const res = await saveInquirySettings(draft)
    setSaving(false)
    if (!res.ok) {
      setSettingsMessage(res.error)
      return res.error
    }
    setSettings(res.data.settings)
    setDraft(res.data.settings)
    return null
  }, [draft])

  const summary = useMemo(
    () => ({
      total: inquiries.length,
      mondayOk: inquiries.filter((i) => i.monday.status === 'success').length,
      mondayFailed: inquiries.filter((i) => i.monday.status !== 'success')
        .length,
      smsOk: inquiries.filter((i) => i.sms.status === 'success').length,
      smsFailed: inquiries.filter((i) => i.sms.status === 'failed').length,
    }),
    [inquiries],
  )

  const rows = useMemo(
    () =>
      inquiries.filter(
        (each) =>
          (filter === 'all' || isProblem(each)) &&
          (device === null || each.device === device) &&
          matchesSearch(each, search),
      ),
    [inquiries, filter, device, search],
  )

  // 기기별 건수(기간 안 전체 기준) — 기기 필터 목록에 같이 보여 준다.
  const deviceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const each of inquiries) {
      counts.set(each.device, (counts.get(each.device) ?? 0) + 1)
    }
    return counts
  }, [inquiries])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** 지금 보이는 줄 전체를 선택/해제 — 전부 선택돼 있으면 해제한다. */
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const visible = rows.map((each) => each.id)
      const allOn = visible.length > 0 && visible.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of visible) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [rows])

  const deleteSelected = useCallback(async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    setDeleting(true)
    setActionError(null)
    const res = await deleteInquiries(ids)
    setDeleting(false)
    if (!res.ok) {
      setActionError(res.error)
      return
    }
    const removed = new Set(ids)
    setInquiries((prev) => prev.filter((each) => !removed.has(each.id)))
    setSelected(new Set())
    setOpenId((prev) => (prev && removed.has(prev) ? null : prev))
  }, [selected, setInquiries])

  const visibleSelected = rows.filter((each) => selected.has(each.id)).length

  const dirty =
    !!draft &&
    !!settings &&
    (draft.smsEnabled !== settings.smsEnabled ||
      draft.senderNumber !== settings.senderNumber ||
      draft.template !== settings.template ||
      draft.subject !== settings.subject)

  return {
    state: {
      // 기간 안의 신청 전부(거르기 전) — 흐름 그림 노드의 상세 패널이 쓴다.
      inquiries,
      days,
      filter,
      search,
      device,
      deviceCounts,
      selected,
      visibleSelected,
      deleting,
      rows,
      status,
      error,
      fetchedAt,
      now,
      summary,
      openId,
      retrying,
      actionError,
      settings,
      draft,
      dirty,
      settingsOpen,
      saving,
      settingsMessage,
    },
    actions: {
      changeDays: setDays,
      changeFilter: setFilter,
      changeSearch: setSearch,
      changeDevice: setDevice,
      toggleSelect,
      toggleSelectAll,
      deleteSelected,
      reload: () => load({ full: true }),
      toggleOpen: (id: string) =>
        setOpenId((prev) => (prev === id ? null : id)),
      retry,
      toggleSettings: () => setSettingsOpen((prev) => !prev),
      updateDraft: (patch: Partial<Omit<InquirySettings, 'updatedAt'>>) =>
        setDraft((prev) => (prev ? { ...prev, ...patch } : prev)),
      saveSettings,
    },
  }
}
