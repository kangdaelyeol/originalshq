import * as logger from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/https'
import {
  ConsultationRecord,
  IntakeRecord,
  Lead,
  PurchaseRecord,
} from '../types'
import {
  generateExternalId,
  generateRecordId,
  normalizeDomesticPhone,
  normalizeEmail,
} from '../utils'
import {
  validateCreateLead,
  validateDeleteLead,
  validateUpdateLeadEm,
  validateUpdateLeadFn,
  validateUpdateLeadRemarks,
  validateUpdateLeadTrackingField,
  valiedateUpdateLeadPhone,
} from '../validation'
import { db } from '../app'
import { endpoint, findLead } from '../http'

// ────────────────────────────────
// getAllLeads
// ────────────────────────────────
export const listLeads = onRequest(
  endpoint(
    { name: 'listLeads', method: 'GET' },
    async ({ response }) => {
      // createdAt은 더 이상 리드 최상위 필드가 아니라(intakes 배열로 옮김)
      // orderBy 대상으로 못 쓴다 — Firestore는 orderBy 필드가 없는 문서를
      // 결과에서 아예 빼버리므로, 여기서 정렬하지 않고 프론트(sortLeads,
      // intakes 최신 시각 기준)에 맡긴다.
      const snapshot = await db.collection('lead').get()

      const leads: Lead[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Lead, 'id'>),
      }))

      response.status(200).send({ leads, count: leads.length })
    },
  ),
)

// ────────────────────────────────
// createLead
// ────────────────────────────────
export const createLead = onRequest(
  endpoint(
    {
      name: 'createLead',
      method: 'POST',
      validate: validateCreateLead,
      logLabel: '리드 생성 실패:',
    },
    async ({ response, data }) => {
      const input = data

      const digitsOnlyPhone = normalizeDomesticPhone(
        input.ph.replace(/\D/g, ''),
      )

      const leadData: Omit<Lead, 'id'> = {
        utm_campaign: input.utm_campaign ?? '',
        utm_medium: input.utm_medium ?? '',
        utm_source: input.utm_source ?? '',
        ip: input.ip ?? '',
        fbc: input.fbc ?? '',
        fbp: input.fbp ?? '',
        user_agent: input.user_agent ?? '',
        fn: input.fn ?? '',
        ph: digitsOnlyPhone,
        em: normalizeEmail(input.em ?? ''),
        remarks: input.remarks ?? '',
        // 최초 접수 1건 — device는 호출부가 보냈으면 그대로 싣는다(수기
        // 등록 모달처럼 기기 입력이 없는 호출부도 있어 optional).
        intakes: [
          {
            id: generateRecordId(),
            at: input.createdAt,
            ...(input.device ? { device: input.device } : {}),
          },
        ],
        consultations: [],
        purchases: [],
        externalId: generateExternalId(digitsOnlyPhone),
      }

      const docRef = await db.collection('lead').add(leadData)
      logger.info('리드 생성 완료:', docRef.id)

      response.status(201).send({ id: docRef.id, ...leadData })
    },
  ),
)

// ────────────────────────────────
// createLeadFromContact
// ────────────────────────────────
export const createLeadFromContact = onRequest(
  endpoint(
    {
      name: 'createLeadFromContact',
      method: 'POST',
      validate: validateCreateLead,
      logLabel: '리드 생성 실패:',
    },
    async ({ request, response, data }) => {
      const input = data

      const digitsOnlyPhone = normalizeDomesticPhone(
        input.ph.replace(/\D/g, ''),
      )

      const ip =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        request.ip ||
        ''
      const userAgent = request.headers['user-agent'] ?? ''

      const leadData: Omit<Lead, 'id'> = {
        utm_campaign: input.utm_campaign ?? '',
        utm_medium: input.utm_medium ?? '',
        utm_source: input.utm_source ?? '',
        ip,
        fbc: input.fbc ?? '',
        fbp: input.fbp ?? '',
        user_agent: userAgent,
        fn: input.fn ?? '',
        ph: digitsOnlyPhone,
        em: normalizeEmail(input.em ?? ''),
        remarks: input.remarks ?? '',
        // 최초 접수 1건 — device는 호출부가 보냈으면 그대로 싣는다.
        intakes: [
          {
            id: generateRecordId(),
            at: input.createdAt,
            ...(input.device ? { device: input.device } : {}),
          },
        ],
        consultations: [],
        purchases: [],
        externalId: generateExternalId(digitsOnlyPhone),
        // 쿠키가 없으면(null/빈 값) 필드 자체를 뺀다 — contactLead가 없을 때
        // externalId로 대체한다.
        ...(input.ga4ClientId?.trim()
          ? { ga4ClientId: input.ga4ClientId.trim() }
          : {}),
      }

      const docRef = await db.collection('lead').add(leadData)
      logger.info('리드 생성 완료:', docRef.id)

      response.status(201).send({ id: docRef.id, ...leadData })
    },
  ),
)

// ────────────────────────────────
// updateLeadPhone
// ────────────────────────────────
export const updateLeadPhone = onRequest(
  endpoint(
    {
      name: 'updateLeadPhone',
      method: 'POST',
      validate: valiedateUpdateLeadPhone,
    },
    async ({ response, data }) => {
      const { id, ph } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      const updateData = {
        ph,
        externalId: generateExternalId(ph),
      }

      await docRef.update(updateData)

      response.status(200).send({ id, ...snapshot.data(), ...updateData })
    },
  ),
)

// ────────────────────────────────
// updateLeadFn
// ────────────────────────────────
export const updateLeadFn = onRequest(
  endpoint(
    { name: 'updateLeadFn', method: 'POST', validate: validateUpdateLeadFn },
    async ({ response, data }) => {
      const { id, fn } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ fn })

      response.status(200).send({ id, ...snapshot.data(), fn })
    },
  ),
)

// ────────────────────────────────
// updateLeadEm — 이메일은 externalId(전화번호 해시)와 무관해서 updateLeadPhone
// 처럼 다시 만들 것이 없다. 이미 보낸 상담/구매 이벤트엔 반영되지 않으므로,
// 이메일을 나중에 채운 고객은 이력의 재전송(↻)으로 다시 보내야 em이 실린다.
// ────────────────────────────────
export const updateLeadEm = onRequest(
  endpoint(
    { name: 'updateLeadEm', method: 'POST', validate: validateUpdateLeadEm },
    async ({ response, data }) => {
      const { id, em } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ em })

      response.status(200).send({ id, ...snapshot.data(), em })
    },
  ),
)

// ────────────────────────────────
// updateLeadRemarks
// ────────────────────────────────
export const updateLeadRemarks = onRequest(
  endpoint(
    {
      name: 'updateLeadRemarks',
      method: 'POST',
      validate: validateUpdateLeadRemarks,
    },
    async ({ response, data }) => {
      const { id, remarks } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ remarks })

      response.status(200).send({ id, ...snapshot.data(), remarks })
    },
  ),
)

// ────────────────────────────────
// updateLeadTrackingField — 유입경로/추적정보 섹션(utm_source/utm_medium/
// utm_campaign/ip/fbc/fbp/user_agent)의 자유 텍스트 필드. 전부 같은 모양이라
// updateLeadFn/updateLeadPhone/updateLeadRemarks처럼 필드마다 엔드포인트를
// 따로 두지 않고 field로 골라 하나로 처리한다.
// ────────────────────────────────
export const updateLeadTrackingField = onRequest(
  endpoint(
    {
      name: 'updateLeadTrackingField',
      method: 'POST',
      validate: validateUpdateLeadTrackingField,
    },
    async ({ response, data }) => {
      const { id, field, value } = data

      const found = await findLead(response, id)
      if (!found) return
      const { docRef, snapshot } = found

      await docRef.update({ [field]: value })

      response.status(200).send({ id, ...snapshot.data(), [field]: value })
    },
  ),
)

// ────────────────────────────────
// deleteLead
// ────────────────────────────────
export const deleteLead = onRequest(
  endpoint(
    { name: 'deleteLead', method: 'POST', validate: validateDeleteLead },
    async ({ response, data }) => {
      const { id } = data

      const found = await findLead(response, id)
      if (!found) return
      await found.docRef.delete()

      logger.info('리드 삭제 완료:', id)

      response.status(200).send({ id, deleted: true })
    },
  ),
)

// ────────────────────────────────
// migrateLeadsToArrays — 일회성 마이그레이션. 기존 state/createdAt/purchasedAt/
// price/device 구조의 리드를 consultations/purchases 배열 구조로 변환해
// 추가한다(기존 필드는 지우지 않고 그대로 둔다 — 새 코드가 안 읽으니 무해하고
// 문제 생기면 롤백 가능). 배포 후 한 번 호출해서 실행하고, 정상 확인되면 이
// 함수 자체를 지운다.
//
// 변환 규칙(사용자 확인 완료) — 옛 스키마엔 "상담 시각"을 따로 담는 필드가
// 없고 createdAt이 그 역할을 겸했다(예전 화면에서도 이 컬럼 라벨이
// "상담 시각"이었다 — 리드 구조 재설계 때 "접수일"로 바뀜). 그래서 아래
// contactedAt은 곧 data.createdAt이다.
//   1) state === 'contacted' && contactedAt 있음 → 상담 1건(consultations)
//   2) state === 'purchased' && purchasedAt 있음 → 구매 1건(purchases)
//   3) state === 'purchased' && contactedAt && purchasedAt 둘 다 있음
//      → 상담 1건 + 구매 1건 모두 추가
// ────────────────────────────────
export const migrateLeadsToArrays = onRequest(
  endpoint(
    { name: 'migrateLeadsToArrays', method: 'GET' },
    async ({ response }) => {
      const snapshot = await db.collection('lead').get()
      let migrated = 0
      let skipped = 0

      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>

        // 이미 새 구조로 마이그레이션된 문서는 다시 건드리지 않는다(재실행 안전).
        if (Array.isArray(data.consultations)) {
          skipped += 1
          continue
        }

        const state = data.state as string | undefined
        const device = data.device as string | undefined
        // 옛 스키마엔 상담 시각 전용 필드가 없어 createdAt이 그 역할을 겸한다.
        const contactedAt = (data.createdAt as number) ?? 0
        const purchasedAt = (data.purchasedAt as number) ?? 0
        const price = (data.price as number) ?? 0

        const hasContact =
          (state === 'contacted' || state === 'purchased') &&
          !!device &&
          contactedAt > 0
        const hasPurchase =
          state === 'purchased' && !!device && purchasedAt > 0 && price > 0

        const consultations: ConsultationRecord[] = hasContact
          ? [
              {
                id: generateRecordId(),
                at: contactedAt,
                device: device as ConsultationRecord['device'],
              },
            ]
          : []

        const purchases: PurchaseRecord[] = hasPurchase
          ? [
              {
                id: generateRecordId(),
                at: purchasedAt,
                device: device as PurchaseRecord['device'],
                price,
              },
            ]
          : []

        await doc.ref.update({
          consultations,
          purchases,
          remarks: (data.remarks as string) ?? '',
        })
        migrated += 1
      }

      logger.info(`리드 마이그레이션 완료: ${migrated}건, 스킵 ${skipped}건`)
      response.status(200).send({ migrated, skipped, total: snapshot.size })
    },
  ),
)

// ────────────────────────────────
// migrateLeadsToIntakes — 일회성 마이그레이션(2차). 리드 최상위 createdAt(+
// 레거시 raw device — 지금 Lead 타입엔 없지만 옛 문서엔 아직 남아있다)을
// intakes 배열로 옮긴다. createdAt 필드 자체는 지우지 않는다(다른 마이그레이션과
// 같은 이유 — 무해하고 롤백 가능). migrateLeadsToArrays와 별도 함수로 둔 이유는
// 그 함수가 이미 한 번 실행돼 모든 리드에 consultations 배열이 생겨서, 그
// 재실행-안전 체크(Array.isArray(data.consultations))로는 이 마이그레이션을
// 더 이상 걸러낼 수 없기 때문 — 여기서는 intakes 배열 존재 여부로 따로 체크한다.
// 배포 후 한 번 호출해서 실행하고, 정상 확인되면 이 함수 자체를 지운다.
// ────────────────────────────────
export const migrateLeadsToIntakes = onRequest(
  endpoint(
    { name: 'migrateLeadsToIntakes', method: 'GET' },
    async ({ response }) => {
      const snapshot = await db.collection('lead').get()
      let migrated = 0
      let skipped = 0

      for (const doc of snapshot.docs) {
        const data = doc.data() as Record<string, unknown>

        // 이미 마이그레이션된 문서는 다시 건드리지 않는다(재실행 안전).
        if (Array.isArray(data.intakes)) {
          skipped += 1
          continue
        }

        const createdAt = (data.createdAt as number) ?? 0
        const device = data.device as string | undefined

        const intakes: IntakeRecord[] =
          createdAt > 0
            ? [
                {
                  id: generateRecordId(),
                  at: createdAt,
                  ...(device
                    ? { device: device as IntakeRecord['device'] }
                    : {}),
                },
              ]
            : []

        await doc.ref.update({ intakes })
        migrated += 1
      }

      logger.info(
        `리드 접수 이력 마이그레이션 완료: ${migrated}건, 스킵 ${skipped}건`,
      )
      response.status(200).send({ migrated, skipped, total: snapshot.size })
    },
  ),
)
