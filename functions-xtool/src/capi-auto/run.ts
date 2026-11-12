// CAPI 자동 전송 실행 — Monday 동기화 20분 뒤(sendCapiAutoScheduled)에
// 돈다. 방금 저장된 Monday item에서 보낼 때가 된 기록을 골라(rules.ts), 수동
// 전송 모달과 같이 리드(CAPI 관리 탭의 lead 문서)를 찾거나 만들고 Meta
// CAPI 이벤트(상담 Contact · 결제 Purchase)를 보낸 뒤 그 기록을 리드에
// 더한다. 결과는 batchRuns(/log의 "CAPI 자동 전송")에 남는다.
//
// 어느 item을 이미 처리했는지는 capiAuto/state 문서 하나에 둔다(item마다
// 문서를 두면 실행마다 수천 건을 읽어야 한다).
import { Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'
import { GA4_CONSULTATION_EVENTS } from '../constants'
import { sendGa4Event } from '../ga4'
import { expectedValueOf, sendMetaEvent, topDevice } from '../meta'
import { buildCustomers, detectBoardKind } from '../monday/customers'
import { getCustomer, listBoardItems, listBoards } from '../monday/firestore'
import type { MondayBoardKind, MondayCustomer } from '../monday/types'
import type {
  ConsultationRecord,
  Device,
  Lead,
  PurchaseRecord,
} from '../types'
import {
  generateEventId,
  generateExternalId,
  generateRecordId,
} from '../utils'
import {
  CAPI_AUTO_MAX_ATTEMPTS,
  CAPI_AUTO_MAX_SENDS,
  CAPI_AUTO_START_DAY,
  alreadySent,
  collectCandidates,
  consultationDevices,
  domesticDigits,
  isAutoBoard,
  leadFieldsOf,
  maskPhone,
  planOf,
  purchaseDevice,
  sentManuallyThatDay,
  type AutoCandidate,
} from './rules'

const STATE_DOC = 'capiAuto/state'
const LEADS_COLLECTION = 'lead'
// 다른 실행이 도는 중이면 건너뛴다 — 함수 제한 시간(9분)보다 조금 길게.
const LEASE_MS = 10 * 60_000

/** item id → 처리 결과. baseline은 자동 전송을 켜기 전에 수동으로 보낸
 * 것으로 친 기록, manual은 같은 날 수동 전송 기록이 있어 건너뛴 기록. */
type Handled = 'baseline' | 'sent' | 'manual' | 'failed'

interface StateDoc {
  /** 처음 실행해 baseline을 만든 시각 — 없으면 아직 한 번도 안 돌았다. */
  baselineAt: number | null
  /** Record<itemId, Handled>를 JSON으로 — 키가 수천 개라 맵 필드로 두면
   * 문서 색인 한도(2만)에 걸린다. */
  handledJson: string
  /** Record<itemId, 실패 횟수>를 JSON으로. */
  failuresJson: string
  runningUntil: number
}

export interface CapiAutoSecrets {
  pixelId: string
  accessToken: string
  ga4MeasurementId: string
  ga4ApiSecret: string
}

/** 결과의 한 줄 — /log 화면에 그대로 보인다. */
export interface CapiAutoEntry {
  itemId: string
  board: string
  kind: AutoCandidate['kind']
  name: string
  phone: string
  /** 이벤트 날짜(한국). */
  day: string
  device: Device
  /** 보낸(보낼) 금액 — 상담은 기기 예상 금액, 결제는 결제 금액. */
  value: number
  /** 기존 리드에 더했는지(아니면 새 리드). */
  existingLead: boolean
  leadId?: string
  eventId?: string
  reason?: string
}

export interface CapiAutoResult {
  live: boolean
  startDay: string
  /** 이번 실행이 처음이라 baseline을 만들었는지. */
  baselineCreated: boolean
  /** 자동 전송 대상으로 걸린 보드 — 이름으로 고르므로 여기서 확인한다. */
  boards: { id: string; name: string; kind: MondayBoardKind }[]
  /** 보낼 때가 된 기록 전체(이미 처리한 것 포함). */
  readyCount: number
  /** 이번에 baseline으로 넘긴 수. */
  baselineCount: number
  /** 미리보기 — 실제로 켜면 보낼 기록. 아래 네 목록은 앞 LISTED_MAX건만
   * 담는다(미리보기가 길어지면 실행 기록이 batchRuns 한도에 걸려 잘린다).
   * 전체 수는 counts. */
  preview: CapiAutoEntry[]
  sent: CapiAutoEntry[]
  skipped: CapiAutoEntry[]
  failed: CapiAutoEntry[]
  counts: Record<ListKey, number>
  /** 한 번에 보내는 수(CAPI_AUTO_MAX_SENDS)를 넘어 다음 실행으로 미룬 수. */
  deferredCount: number
  /** 다른 실행이 돌고 있어 건너뛰었으면 true. */
  busy?: boolean
}

type ListKey = 'preview' | 'sent' | 'skipped' | 'failed'
const LISTED_MAX = 200

/** 목록에 한 줄 — 앞 LISTED_MAX건까지만 담고 수는 늘 센다. */
const listEntry = (
  result: CapiAutoResult,
  key: ListKey,
  entry: CapiAutoEntry,
) => {
  result.counts[key] += 1
  if (result[key].length < LISTED_MAX) result[key].push(entry)
}

const parseMap = <T>(json: string | undefined): Record<string, T> => {
  try {
    return json ? (JSON.parse(json) as Record<string, T>) : {}
  } catch {
    return {}
  }
}

/** 실행 자리를 잡는다 — 다른 실행이 잡고 있으면 null. */
const acquire = async (db: Firestore, now: number) => {
  const ref = db.doc(STATE_DOC)
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const data = (snapshot.data() ?? {}) as Partial<StateDoc>
    if ((data.runningUntil ?? 0) > now) return null
    tx.set(ref, { runningUntil: now + LEASE_MS }, { merge: true })
    return {
      baselineAt: data.baselineAt ?? null,
      handled: parseMap<Handled>(data.handledJson),
      failures: parseMap<number>(data.failuresJson),
    }
  })
}

type LeadDoc = Omit<Lead, 'id'> & { id: string }

/** 번호로 리드 찾기 — 여럿이면 가장 최근에 접수된 것(수동 전송과 같은
 * 규칙). */
const leadIndex = (leads: LeadDoc[]) => {
  const byPhone = new Map<string, LeadDoc[]>()
  for (const lead of leads) {
    const key = domesticDigits(lead.ph ?? '')
    if (!key) continue
    byPhone.set(key, [...(byPhone.get(key) ?? []), lead])
  }
  const latest = (lead: LeadDoc) =>
    Math.max(0, ...(lead.intakes ?? []).map((intake) => intake.at))
  return {
    find: (phone: string): LeadDoc | null =>
      [...(byPhone.get(domesticDigits(phone)) ?? [])].sort(
        (a, b) => latest(b) - latest(a),
      )[0] ?? null,
    put: (lead: LeadDoc) => {
      const key = domesticDigits(lead.ph)
      const others = (byPhone.get(key) ?? []).filter(
        (each) => each.id !== lead.id,
      )
      byPhone.set(key, [...others, lead])
    },
  }
}

/** 보낼 기기·금액. */
const eventOf = (candidate: AutoCandidate) => {
  if (candidate.kind === 'consultation') {
    const devices = consultationDevices(candidate.record)
    const device = topDevice(devices)
    return { devices, device, value: expectedValueOf(device) }
  }
  const device = purchaseDevice(candidate.record)
  return { devices: [device], device, value: candidate.record.amount }
}

/** 결과 한 줄을 만든다. */
const entryOf = (
  candidate: AutoCandidate,
  lead: LeadDoc | null,
  extra: Partial<CapiAutoEntry> = {},
): CapiAutoEntry => {
  const { device, value } = eventOf(candidate)
  return {
    itemId: candidate.itemId,
    board: candidate.boardName,
    kind: candidate.kind,
    name: candidate.name,
    phone: maskPhone(candidate.phone),
    day: candidate.day,
    device,
    value,
    existingLead: lead !== null,
    ...(lead ? { leadId: lead.id } : {}),
    ...extra,
  }
}

/**
 * 기록 하나를 보낸다 — Meta에 먼저 보내고, 성공하면 리드를 만들거나(새
 * 고객) 기존 리드에 기록을 더한다. 보내기가 실패하면 리드를 만들지 않는다.
 * 상담은 수동 전송(contactLead)처럼 기기에 정해 둔 GA4 이벤트도 보낸다.
 */
const sendOne = async (
  db: Firestore,
  candidate: AutoCandidate,
  customer: MondayCustomer,
  existing: LeadDoc | null,
  secrets: CapiAutoSecrets,
): Promise<{ lead: LeadDoc; eventId: string }> => {
  const { devices, device, value } = eventOf(candidate)
  const base: Omit<Lead, 'id'> = existing ?? {
    ...leadFieldsOf(customer, candidate),
    ip: '',
    user_agent: '',
    intakes: [],
    consultations: [],
    purchases: [],
  }
  const externalId = base.externalId || generateExternalId(base.ph)
  const lead = { ...base, externalId }

  const eventId = generateEventId()
  const sent = await sendMetaEvent({
    pixelId: secrets.pixelId,
    accessToken: secrets.accessToken,
    eventName: candidate.kind === 'consultation' ? 'Contact' : 'Purchase',
    lead,
    customData: { currency: 'KRW', value },
    eventTimeMs: candidate.at,
    eventId,
  })
  if (!sent.ok) {
    throw new Error(
      `Meta CAPI 전송 실패: ${JSON.stringify(sent.result).slice(0, 300)}`,
    )
  }

  const auto = { itemId: candidate.itemId, boardName: candidate.boardName }
  const record: ConsultationRecord | PurchaseRecord =
    candidate.kind === 'consultation'
      ? {
          id: generateRecordId(),
          at: candidate.at,
          device,
          devices,
          externalId,
          eventId,
          auto,
        }
      : {
          id: generateRecordId(),
          at: candidate.at,
          device,
          price: value,
          externalId,
          eventId,
          auto,
        }
  const key = candidate.kind === 'consultation' ? 'consultations' : 'purchases'

  let saved: LeadDoc
  if (existing) {
    // 보내는 사이 다른 요청이 같은 리드를 고쳤을 수 있어 트랜잭션으로.
    const ref = db.collection(LEADS_COLLECTION).doc(existing.id)
    saved = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref)
      if (!snapshot.exists) throw new Error('리드가 그사이 지워졌습니다')
      const fresh = snapshot.data() as Omit<Lead, 'id'>
      const patch = {
        [key]: [...((fresh[key] ?? []) as unknown[]), record],
        externalId: fresh.externalId || externalId,
      }
      tx.update(ref, patch)
      return { ...fresh, ...patch, id: existing.id } as LeadDoc
    })
  } else {
    const data: Omit<Lead, 'id'> = {
      ...lead,
      intakes: [{ id: generateRecordId(), at: candidate.at, device }],
      consultations:
        key === 'consultations' ? [record as ConsultationRecord] : [],
      purchases: key === 'purchases' ? [record as PurchaseRecord] : [],
    }
    const ref = await db.collection(LEADS_COLLECTION).add(data)
    saved = { ...data, id: ref.id }
  }

  // GA4 — Meta 전송과 저장까지 끝난 뒤라 실패해도 되돌리지 않는다.
  const ga4Event =
    candidate.kind === 'consultation' ? GA4_CONSULTATION_EVENTS[device] : null
  if (ga4Event) {
    try {
      await sendGa4Event({
        measurementId: secrets.ga4MeasurementId,
        apiSecret: secrets.ga4ApiSecret,
        clientId: saved.ga4ClientId || externalId,
        name: ga4Event.name,
        params: { currency: 'KRW', value: ga4Event.value },
        eventTimeMs: candidate.at,
      })
    } catch (error) {
      logger.error('CAPI 자동 전송: GA4 전송 중 오류', error)
    }
  }
  return { lead: saved, eventId }
}

/**
 * 자동 전송을 한 번 돈다. live가 false면 Meta에 보내지 않고 보낼 목록만
 * 돌려준다(처음 실행의 baseline은 그때도 만든다 — 켠 뒤 지난 기록이 한꺼번에
 * 나가지 않게). getSecrets는 실제로 보낼 때만 부른다.
 */
export async function runCapiAuto(
  db: Firestore,
  {
    live,
    getSecrets,
    now = Date.now(),
  }: { live: boolean; getSecrets: () => CapiAutoSecrets; now?: number },
): Promise<CapiAutoResult> {
  const result: CapiAutoResult = {
    live,
    startDay: CAPI_AUTO_START_DAY,
    baselineCreated: false,
    boards: [],
    readyCount: 0,
    baselineCount: 0,
    preview: [],
    sent: [],
    skipped: [],
    failed: [],
    counts: { preview: 0, sent: 0, skipped: 0, failed: 0 },
    deferredCount: 0,
  }

  const state = await acquire(db, now)
  if (!state) return { ...result, busy: true }
  const { handled, failures } = state
  // baseline을 다 만든 뒤에만 baselineAt을 적는다 — 그 전에 실패하면 다음
  // 실행이 다시 처음 실행으로 baseline을 만든다.
  let baselineAt = state.baselineAt
  // 처리한 것을 바로바로 남긴다 — 함수가 제한 시간에 걸려 강제로 끝나면
  // finally가 돌지 않아, 끝에서 한 번만 쓰면 그 실행의 결과(보낸 것·실패
  // 횟수)를 다 잃는다.
  const saveState = (extra: Partial<StateDoc> = {}) =>
    db.doc(STATE_DOC).set(
      {
        baselineAt,
        handledJson: JSON.stringify(handled),
        failuresJson: JSON.stringify(failures),
        ...extra,
      },
      { merge: true },
    )

  try {
    // 대상 보드와 그 item — 고객 묶기는 동기화와 같은 함수로(번호·기록 읽는
    // 규칙이 같게). 구매의 UTM 등은 보낼 때 고객 문서 전체에서 다시 읽는다.
    const boards = (await listBoards(db))
      .map((board) => ({
        id: board.id,
        name: board.name,
        kind: detectBoardKind(board.columns),
      }))
      .filter((board) => isAutoBoard(board.name, board.kind))
    result.boards = boards
    const kindByBoardId = new Map(
      boards.map((board) => [board.id, board.kind]),
    )
    const items = (
      await Promise.all(boards.map((board) => listBoardItems(db, board.id)))
    ).flat()
    const { customers } = buildCustomers(items, kindByBoardId, now)
    const ready = collectCandidates(
      customers,
      (boardId) => kindByBoardId.has(boardId),
      now,
    )
    result.readyCount = ready.length

    const baselineDone = state.baselineAt !== null
    const toSend: AutoCandidate[] = []
    for (const candidate of ready) {
      if (handled[candidate.itemId]) continue
      if (planOf(candidate, baselineDone) === 'baseline') {
        handled[candidate.itemId] = 'baseline'
        result.baselineCount += 1
      } else {
        toSend.push(candidate)
      }
    }
    result.baselineCreated = !baselineDone
    baselineAt ??= now
    if (result.baselineCount > 0 || !baselineDone) await saveState()

    if (toSend.length > 0) {
      const snapshot = await db.collection(LEADS_COLLECTION).get()
      const leads = leadIndex(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as LeadDoc,
        ),
      )
      const secrets = live ? getSecrets() : null
      const byPhone = new Map(customers.map((each) => [each.phone, each]))
      let sentCount = 0

      for (const candidate of toSend) {
        const existing = leads.find(candidate.phone)
        if (existing && alreadySent(existing, candidate)) {
          handled[candidate.itemId] = 'sent'
          continue
        }
        if (existing && sentManuallyThatDay(existing, candidate)) {
          if (live) handled[candidate.itemId] = 'manual'
          listEntry(
            result,
            'skipped',
            entryOf(candidate, existing, {
              reason: '같은 날 수동으로 보낸 기록이 있음',
            }),
          )
          continue
        }
        if (!secrets) {
          listEntry(result, 'preview', entryOf(candidate, existing))
          continue
        }
        if (sentCount >= CAPI_AUTO_MAX_SENDS) {
          result.deferredCount += 1
          continue
        }
        sentCount += 1
        try {
          // 구매의 UTM·이메일 등은 다른 보드 기록까지 묶인 고객 문서에서.
          const customer =
            (await getCustomer(db, candidate.phone)) ??
            byPhone.get(candidate.phone)
          if (!customer) throw new Error('고객 문서를 찾지 못했습니다')
          const { lead, eventId } = await sendOne(
            db,
            candidate,
            customer,
            existing,
            secrets,
          )
          leads.put(lead)
          handled[candidate.itemId] = 'sent'
          delete failures[candidate.itemId]
          listEntry(
            result,
            'sent',
            entryOf(candidate, existing, { leadId: lead.id, eventId }),
          )
          await saveState()
        } catch (error) {
          const attempts = (failures[candidate.itemId] ?? 0) + 1
          failures[candidate.itemId] = attempts
          if (attempts >= CAPI_AUTO_MAX_ATTEMPTS) {
            handled[candidate.itemId] = 'failed'
          }
          const message = error instanceof Error ? error.message : String(error)
          logger.error('CAPI 자동 전송 실패:', candidate.itemId, message)
          listEntry(
            result,
            'failed',
            entryOf(candidate, existing, {
              reason: `${message} (${attempts}/${CAPI_AUTO_MAX_ATTEMPTS}회)`,
            }),
          )
          await saveState()
        }
      }
    }
  } finally {
    // 실패해도 지금까지 처리한 것은 남기고 자리를 놓는다.
    await saveState({ runningUntil: 0 })
  }
  return result
}
