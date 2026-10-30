import { useRef, useState } from 'react'
import {
  INITIAL_CREATE_LEAD_FORM,
  type CreateLeadFormValues,
} from '@/screens/xtool-lead-manager/types'
import type { Lead, MondayCustomer } from '@/screens/xtool-lead-manager/entity'
import { leadClient } from '@/screens/xtool-lead-manager/client'
import {
  buildMondayCapiForm,
  findLeadByPhone,
  sameDayRecordCount,
  type MondayCapiSource,
} from '@/screens/xtool-lead-manager/utils'

/** 보낼 곳 — 같은 번호의 리드에 더하기 / 새 리드를 만들어 더하기. */
export type MondayCapiTarget = 'existing' | 'new'

type LeadsStatus = 'loading' | 'ready' | 'error'

/** 보낸 결과 — 모달 안에 그대로 보여 준다(Monday 탭에는 토스트가 없다). */
export type MondayCapiResult =
  | { ok: true; lead: Lead; created: boolean; eventId: string | null }
  | { ok: false; message: string; leadCreated: boolean }

interface MondayCapiDeps {
  /** 보낸 뒤 리드 탭 목록을 새로 받는다 — 탭을 넘어가면 바로 보이게. */
  fetchLeads: () => Promise<void>
}

/*
 * Monday 고객 상세의 상담·구매 기록 → Meta CAPI 전송 + 리드 탭으로 옮기기.
 *
 * 기록의 "CAPI 전송"을 누르면 그 기록으로 미리 채운 폼(buildMondayCapiForm)을
 * 모달로 띄우고, 고쳐서 "전송"을 눌러야 실제로 보낸다. 보내는 방식은 리드
 * 탭의 상담·구매 등록과 같다(contactLead / purchaseLead가 CAPI를 보낸다):
 *   - 리드 탭에 같은 번호의 리드가 있으면(기본) 그 리드에 상담·구매를 더한다.
 *   - 없거나 "새 리드로"를 고르면 리드를 만들고(createLead) 이어서 더한다.
 * 같은 번호 확인은 모달을 열 때마다 리드 목록을 새로 받아서 한다.
 */
export const useMondayCapiViewModel = ({ fetchLeads }: MondayCapiDeps) => {
  const [source, setSource] = useState<MondayCapiSource | null>(null)
  const [form, setForm] = useState<CreateLeadFormValues>(
    INITIAL_CREATE_LEAD_FORM,
  )
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsStatus, setLeadsStatus] = useState<LeadsStatus>('loading')
  const [target, setTarget] = useState<MondayCapiTarget>('existing')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MondayCapiResult | null>(null)
  // 목록을 받는 사이 다른 기록으로 다시 열었으면 늦게 온 응답은 버린다.
  const openCount = useRef(0)

  const open = async (customer: MondayCustomer, next: MondayCapiSource) => {
    setSource(next)
    setForm(buildMondayCapiForm(customer, next))
    setTarget('existing')
    setError(null)
    setResult(null)
    setLeadsStatus('loading')
    const current = ++openCount.current
    const res = await leadClient.getAll()
    if (current !== openCount.current) return
    if (res.ok) {
      setLeads(res.data.leads)
      setLeadsStatus('ready')
    } else {
      console.error(res.error)
      setLeadsStatus('error')
    }
  }

  const close = () => {
    if (sending) return
    setSource(null)
  }

  const updateField = (field: keyof CreateLeadFormValues, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'ph' ? value.replace(/\D/g, '') : value,
    }))
  }

  const toggleTest = () =>
    setForm((prev) => ({ ...prev, isTest: !prev.isTest }))

  // 번호를 고치면 그 번호로 다시 찾는다.
  const match = leadsStatus === 'ready' ? findLeadByPhone(leads, form.ph) : null
  const useExisting = match !== null && target === 'existing'
  // 폼의 시각 — 비워 두면 보낼 때 "지금"(eventTime)을 쓴다.
  const formAt = form.createdAt ? new Date(form.createdAt).getTime() : NaN
  const sameDay =
    match && source && !Number.isNaN(formAt)
      ? sameDayRecordCount(match, source.kind, formAt)
      : 0

  const send = async () => {
    if (!source || sending) return
    const price = Number(form.price)
    if (!form.ph) {
      setError('전화번호를 입력해 주세요.')
      return
    }
    if (source.kind === 'purchase' && !(price > 0)) {
      setError('구매 금액은 0보다 커야 합니다.')
      return
    }
    const at = form.createdAt ? formAt : Date.now()
    if (Number.isNaN(at)) {
      setError('시각을 확인해 주세요.')
      return
    }

    setSending(true)
    setError(null)
    const testEventCode =
      form.isTest && form.testEventCode.trim()
        ? { test_event_code: form.testEventCode.trim() }
        : {}
    // 리드 탭의 상담·구매 등록과 같은 호출 — 서버가 CAPI를 보내고 기록을 더한다.
    const register = (id: string) =>
      source.kind === 'consultation'
        ? leadClient.registerConsultation({
            id,
            device: form.device,
            at,
            ...testEventCode,
          })
        : leadClient.registerPurchase({
            id,
            device: form.device,
            price,
            at,
            ...testEventCode,
          })

    let leadId = match?.id ?? ''
    let created = false
    if (!useExisting) {
      const createRes = await leadClient.create({ ...form, createdAt: at })
      if (!createRes.ok) {
        setResult({ ok: false, message: createRes.error, leadCreated: false })
        setSending(false)
        return
      }
      leadId = createRes.data.id
      created = true
    }

    const res = await register(leadId)
    if (res.ok) {
      const records =
        source.kind === 'consultation'
          ? res.data.consultations
          : res.data.purchases
      setResult({
        ok: true,
        lead: res.data,
        created,
        eventId: records.at(-1)?.eventId ?? null,
      })
      // 같은 모달에서 다시 열면 방금 것까지 보고 중복을 알리게.
      setLeads((prev) => [
        ...prev.filter((lead) => lead.id !== res.data.id),
        res.data,
      ])
    } else {
      setResult({ ok: false, message: res.error, leadCreated: created })
    }
    setSending(false)
    if (created || res.ok) await fetchLeads()
  }

  return {
    state: {
      source,
      form,
      leadsStatus,
      match,
      target,
      useExisting,
      sameDay,
      sending,
      error,
      result,
    },
    actions: {
      open,
      close,
      send,
      updateField,
      toggleTest,
      changeTestCode: (code: string) =>
        setForm((prev) => ({ ...prev, testEventCode: code })),
      changeTarget: setTarget,
    },
  }
}
