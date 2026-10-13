import type { Lead, MondayCustomer } from '../entity'
import { EditingField } from '../types'

/** Monday에서 리드로 복사할 수 있는 항목 하나 — 리드의 어느 필드에, Monday의
 * 어떤 값들을 넣을 수 있는지. */
export interface MondayCopyField {
  field: EditingField
  label: string
  /** 리드에 지금 들어 있는 값(비어 있으면 ''). */
  leadValue: string
  /** Monday에 적힌 값들 — 보드마다 다르게 적혀 있으면 여러 개다. */
  candidates: string[]
}

// 문의 폼이 빈 값을 글자 "null"로 넘긴 것이 Monday에 그대로 남아 있는 경우가
// 있다(fbc·fbp) — 값이 없는 것으로 본다. 서버도 같은 값을 걸러 내지만, 그
// 전에 만들어진 고객 문서에는 남아 있을 수 있어 여기서도 거른다.
const EMPTY_TEXT = /^(null|undefined)$/i

const unique = (values: (string | null | undefined)[]): string[] => [
  ...new Set(
    values
      .map((value) => value?.trim() ?? '')
      .filter((value) => value !== '' && !EMPTY_TEXT.test(value)),
  ),
]

/** 리드와 같은 번호의 Monday 고객에서, 리드로 옮겨 올 수 있는 항목을 뽑는다.
 * 리드에 대응하는 필드가 있는 것만 다룬다: 이름·이메일은 고객 정보에서,
 * UTM·fbc·fbp는 상담 기록에서(오래된 상담부터 — 최초 유입에 가까운 값이
 * 먼저 오게). Monday에 값이 하나도 없는 항목은 뺀다. */
export const buildMondayCopyFields = (
  lead: Lead,
  customer: MondayCustomer,
): MondayCopyField[] => {
  const oldestFirst = [...customer.consultations].reverse()

  const fields: MondayCopyField[] = [
    {
      field: EditingField.FIRST_NAME,
      label: 'Name',
      leadValue: lead.fn ?? '',
      candidates: unique(customer.names),
    },
    {
      field: EditingField.EMAIL,
      label: 'Email',
      leadValue: lead.em ?? '',
      candidates: unique(customer.emails),
    },
    {
      field: EditingField.UTM_SOURCE,
      label: 'UTM Source',
      leadValue: lead.utm_source ?? '',
      candidates: unique(oldestFirst.map((record) => record.utmSource)),
    },
    {
      field: EditingField.UTM_MEDIUM,
      label: 'UTM Medium',
      leadValue: lead.utm_medium ?? '',
      candidates: unique(oldestFirst.map((record) => record.utmMedium)),
    },
    {
      field: EditingField.UTM_CAMPAIGN,
      label: 'UTM Campaign',
      leadValue: lead.utm_campaign ?? '',
      candidates: unique(oldestFirst.map((record) => record.utmCampaign)),
    },
    {
      field: EditingField.FBC,
      label: 'fbc',
      leadValue: lead.fbc ?? '',
      candidates: unique(oldestFirst.map((record) => record.fbc)),
    },
    {
      field: EditingField.FBP,
      label: 'fbp',
      leadValue: lead.fbp ?? '',
      candidates: unique(oldestFirst.map((record) => record.fbp)),
    },
  ]

  return fields.filter((field) => field.candidates.length > 0)
}

/** 리드 쪽이 비어 있어 Monday 값으로 채울 수 있는 항목들 — "빈 칸 채우기"가
 * 쓴다. 값이 여러 개면 첫 번째(이름은 가장 많이 쓰인 것, 나머지는 가장 이른
 * 상담의 것)를 넣는다. 이미 값이 있는 필드는 건드리지 않는다. */
export const emptyLeadFields = (
  fields: MondayCopyField[],
): { field: EditingField; value: string }[] =>
  fields
    .filter((field) => field.leadValue.trim() === '')
    .map((field) => ({ field: field.field, value: field.candidates[0] }))
