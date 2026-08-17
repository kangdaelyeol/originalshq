import { setGlobalOptions } from 'firebase-functions'
import { onRequest } from 'firebase-functions/https'
import * as logger from 'firebase-functions/logger'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import cors from 'cors'
import { CreateLeadInput, Device, Lead } from './types'
import { defineSecret } from 'firebase-functions/params'
import * as crypto from 'crypto'

initializeApp()

const db = getFirestore('xtool-read')
const corsHandler = cors({ origin: true })

setGlobalOptions({ maxInstances: 10 })

const metaPixelId = defineSecret('META_PIXEL_ID')
const metaAccessToken = defineSecret('META_ACCESS_TOKEN')

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

const normalizePhoneForMeta = (digitsOnlyPhone: string) => {
  const withoutLeadingZero = digitsOnlyPhone.replace(/^0/, '')
  return `82${withoutLeadingZero}`
}

const DEVICE_VALUES: Device[] = [
  'F2Ultra',
  'F2UltraUV',
  'P3',
  'DTF',
  'Metalfab',
]

const REQUIRED_FIELDS: (keyof CreateLeadInput)[] = [
  'utm_campaign',
  'utm_medium',
  'utm_source',
  'ip',
  'fbc',
  'fbp',
  'user_agent',
  'fn',
  'ph',
  'device',
]

const validateBody = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null) {
    return 'invalid request body'
  }

  const record = body as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (typeof record[field] !== 'string' || record[field] === '') {
      return `${field} is required`
    }
  }

  if (!DEVICE_VALUES.includes(record.device as Device)) {
    return `device must be one of: ${DEVICE_VALUES.join(', ')}`
  }

  return null
}

export const createLead = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationError = validateBody(request.body)
      if (validationError) {
        response.status(400).send({ error: validationError })
        return
      }

      const input = request.body as CreateLeadInput

      const digitsOnlyPhone = input.ph.replace(/\D/g, '')

      if (!digitsOnlyPhone) {
        response.status(400).send({ error: 'ph must contain digits' })
        return
      }

      const now = Date.now()

      const leadData: Omit<Lead, 'id'> = {
        createdAt: now,
        utm_campaign: input.utm_campaign,
        utm_medium: input.utm_medium,
        utm_source: input.utm_source,
        ip: input.ip,
        fbc: input.fbc,
        fbp: input.fbp,
        user_agent: input.user_agent,
        fn: input.fn,
        ph: digitsOnlyPhone,
        device: input.device,
        price: 0,
        purchasedAt: 0,
        state: 'new',
      }

      const docRef = await db.collection('lead').add(leadData)

      logger.info('리드 생성 완료:', docRef.id)

      const lead: Lead = { id: docRef.id, ...leadData }

      response.status(201).send(lead)
    } catch (error) {
      logger.error('리드 생성 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

const REQUIRED_FIELDS_WITHOUT_CONTACT: (keyof Omit<
  CreateLeadInput,
  'fn' | 'ph'
>)[] = [
  'utm_campaign',
  'utm_medium',
  'utm_source',
  'ip',
  'fbc',
  'fbp',
  'user_agent',
  'device',
]

const validateBodyWithoutContact = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null) {
    return 'invalid request body'
  }

  const record = body as Record<string, unknown>

  for (const field of REQUIRED_FIELDS_WITHOUT_CONTACT) {
    if (typeof record[field] !== 'string' || record[field] === '') {
      return `${field} is required`
    }
  }

  if (!DEVICE_VALUES.includes(record.device as Device)) {
    return `device must be one of: ${DEVICE_VALUES.join(', ')}`
  }

  return null
}

export const createLeadWithoutContact = onRequest((request, response) => {
  corsHandler(request, response, async () => {
    try {
      if (request.method !== 'POST') {
        response.status(405).send({ error: 'Method Not Allowed' })
        return
      }

      const validationError = validateBodyWithoutContact(request.body)
      if (validationError) {
        response.status(400).send({ error: validationError })
        return
      }

      const input = request.body as Omit<CreateLeadInput, 'fn' | 'ph'>

      const now = Date.now()

      const leadData: Omit<Lead, 'id'> = {
        createdAt: now,
        utm_campaign: input.utm_campaign,
        utm_medium: input.utm_medium,
        utm_source: input.utm_source,
        ip: input.ip,
        fbc: input.fbc,
        fbp: input.fbp,
        user_agent: input.user_agent,
        fn: '',
        ph: '',
        device: input.device,
        price: 0,
        purchasedAt: 0,
        state: 'new',
      }

      const docRef = await db.collection('lead').add(leadData)

      logger.info('리드(연락처 미포함) 생성 완료:', docRef.id)

      const lead: Lead = { id: docRef.id, ...leadData }

      response.status(201).send(lead)
    } catch (error) {
      logger.error('리드 생성 실패:', error)
      response.status(500).send({ error: '서버 오류' })
    }
  })
})

export const contactLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        if (request.method !== 'POST') {
          response.status(405).send({ error: 'Method Not Allowed' })
          return
        }

        const { id } = request.body as { id?: string }

        if (!id || typeof id !== 'string') {
          response.status(400).send({ error: 'id is required' })
          return
        }

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (lead.state !== 'new') {
          response.status(409).send({ error: `lead is already ${lead.state}` })
          return
        }

        if (!lead.fn || !lead.ph) {
          response.status(400).send({ error: 'lead has no fn/ph to contact' })
          return
        }

        const eventTime = Math.floor(Date.now() / 1000)

        const capiPayload = {
          data: [
            {
              event_name: 'Contact',
              event_time: eventTime,
              action_source: 'phone_call',
              user_data: {
                ph: [sha256(normalizePhoneForMeta(lead.ph))],
                fn: [sha256(lead.fn)],
                client_ip_address: lead.ip || undefined,
                client_user_agent: lead.user_agent || undefined,
                fbc: lead.fbc || undefined,
                fbp: lead.fbp || undefined,
              },
            },
          ],
        }

        const capiResponse = await fetch(
          `https://graph.facebook.com/v19.0/${metaPixelId.value()}/events?access_token=${metaAccessToken.value()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capiPayload),
          },
        )

        const capiResult = await capiResponse.json()

        if (!capiResponse.ok) {
          logger.error('Meta CAPI 전송 실패:', capiResult)
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult })
          return
        }

        logger.info('Meta CAPI 전송 성공:', capiResult)

        await docRef.update({ state: 'contacted' })

        const updatedLead: Lead = {
          id: snapshot.id,
          ...lead,
          state: 'contacted',
        }

        response.status(200).send(updatedLead)
      } catch (error) {
        logger.error('contactLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)

export const purchaseLead = onRequest(
  { secrets: [metaPixelId, metaAccessToken] },
  (request, response) => {
    corsHandler(request, response, async () => {
      try {
        if (request.method !== 'POST') {
          response.status(405).send({ error: 'Method Not Allowed' })
          return
        }

        const { id, price } = request.body as { id?: string; price?: number }

        if (!id || typeof id !== 'string') {
          response.status(400).send({ error: 'id is required' })
          return
        }

        if (typeof price !== 'number' || price <= 0) {
          response
            .status(400)
            .send({ error: 'price must be a positive number' })
          return
        }

        const docRef = db.collection('lead').doc(id)
        const snapshot = await docRef.get()

        if (!snapshot.exists) {
          response.status(404).send({ error: 'lead not found' })
          return
        }

        const lead = snapshot.data() as Omit<Lead, 'id'>

        if (lead.state !== 'contacted') {
          response
            .status(409)
            .send({
              error: `lead must be contacted first (current: ${lead.state})`,
            })
          return
        }

        const eventTime = Math.floor(Date.now() / 1000)

        const capiPayload = {
          data: [
            {
              event_name: 'Purchase',
              event_time: eventTime,
              action_source: 'phone_call',
              custom_data: {
                currency: 'KRW',
                value: price,
              },
              user_data: {
                ph: [sha256(normalizePhoneForMeta(lead.ph))],
                fn: [sha256(lead.fn)],
                client_ip_address: lead.ip || undefined,
                client_user_agent: lead.user_agent || undefined,
                fbc: lead.fbc || undefined,
                fbp: lead.fbp || undefined,
              },
            },
          ],
        }

        const capiResponse = await fetch(
          `https://graph.facebook.com/v19.0/${metaPixelId.value()}/events?access_token=${metaAccessToken.value()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capiPayload),
          },
        )

        const capiResult = await capiResponse.json()

        if (!capiResponse.ok) {
          logger.error('Meta CAPI(Purchase) 전송 실패:', capiResult)
          response
            .status(502)
            .send({ error: 'Meta CAPI 전송 실패', detail: capiResult })
          return
        }

        logger.info('Meta CAPI(Purchase) 전송 성공:', capiResult)

        const purchasedAt = Date.now()

        await docRef.update({
          state: 'purchased',
          price,
          purchasedAt,
        })

        const updatedLead: Lead = {
          id: snapshot.id,
          ...lead,
          state: 'purchased',
          price,
          purchasedAt,
        }

        response.status(200).send(updatedLead)
      } catch (error) {
        logger.error('purchaseLead 처리 실패:', error)
        response.status(500).send({ error: '서버 오류' })
      }
    })
  },
)
