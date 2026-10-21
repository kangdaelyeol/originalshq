import type { Ga4Event, MondayGaConsultation } from '../entity'

/** 상담 한 건의 GA4 요약 — 같은 GA ClientId의 이벤트로 낸다. */
export interface GaTrackingRow {
  consultation: MondayGaConsultation
  events: Ga4Event[]
  sessionCount: number
  firstAt: number | null
  lastAt: number | null
  /** 그 사람의 첫 유입(source / medium). */
  firstTouch: string | null
  /** 마지막 이벤트의 기기 — "mobile · iOS · Safari". */
  device: string | null
  /** 마지막 이벤트의 위치 — "Seoul, South Korea". */
  location: string | null
}

const join = (parts: (string | null)[], separator: string) => {
  const kept = parts.filter((part): part is string => Boolean(part))
  return kept.length ? kept.join(separator) : null
}

/** GA4가 값이 없을 때 넣는 자리표시값 — 화면에서는 비운다. */
const clean = (value: string | null) =>
  value && !/^\(not set\)$|^\(none\)$/i.test(value) ? value : null

/** 이벤트를 GA ClientId별로 묶는다(시간순). */
export const eventsByClient = (
  events: readonly Ga4Event[],
): Map<string, Ga4Event[]> => {
  const byClient = new Map<string, Ga4Event[]>()
  for (const event of events) {
    const list = byClient.get(event.clientId) ?? []
    list.push(event)
    byClient.set(event.clientId, list)
  }
  for (const list of byClient.values()) list.sort((a, b) => a.at - b.at)
  return byClient
}

export const buildGaTrackingRows = (
  consultations: readonly MondayGaConsultation[],
  byClient: Map<string, Ga4Event[]>,
): GaTrackingRow[] =>
  consultations
    .map((consultation) => {
      const events = byClient.get(consultation.gaClientId) ?? []
      const first = events[0]
      const last = events[events.length - 1]
      return {
        consultation,
        events,
        sessionCount: new Set(
          events.map((event) => event.sessionId).filter((id) => id !== null),
        ).size,
        firstAt: first?.at ?? null,
        lastAt: last?.at ?? null,
        firstTouch: first
          ? join([clean(first.firstSource), clean(first.firstMedium)], ' / ')
          : null,
        device: last
          ? join(
              [clean(last.deviceCategory), clean(last.os), clean(last.browser)],
              ' · ',
            )
          : null,
        location: last
          ? join([clean(last.city), clean(last.country)], ', ')
          : null,
      }
    })
    .sort((a, b) =>
      (b.consultation.receivedAt ?? '').localeCompare(
        a.consultation.receivedAt ?? '',
      ),
    )

/** 페이지 주소를 짧게 — 도메인 뒤 경로만(쿼리 제외). 해석이 안 되면 원문. */
export const shortPath = (url: string | null): string | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return url
  }
}

/** 이벤트의 유입 값 — "google / cpc · 캠페인명". */
export const eventSource = (event: Ga4Event): string | null =>
  join(
    [
      join([clean(event.source), clean(event.medium)], ' / '),
      clean(event.campaign),
    ],
    ' · ',
  )

export { clean as cleanGaValue }
