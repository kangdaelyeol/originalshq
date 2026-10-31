import { checked, koreaDate, pick } from '../monday/fields'
import { MondayItem } from '../monday/types'
import {
  TechAsRequest,
  TechBoardKey,
  TechBoardRecords,
  TechDocTask,
  TechPart,
  TechRecordBase,
  TechRental,
  TechSerial,
} from './types'

// 기술지원팀 워크스페이스에서 고객 통합(mondayBoards·mondayItems)과 따로 읽는
// 보드들. 출장·AS·아톡문의·기타업무는 이미 고객 통합 쪽에서 읽어
// stats/techFacts로 쓰고, 담당자별 개인 보드는 원본의 미러라 읽지 않는다.
// 보드 id는 Monday에서 보드를 새로 만들지 않는 한 바뀌지 않는다.
export const TECH_BOARDS: readonly { key: TechBoardKey; boardId: string }[] = [
  { key: 'records', boardId: '5025392066' }, // 자료정리 2026
  { key: 'asRequests', boardId: '5028018471' }, // AS 신청서
  { key: 'parts', boardId: '5027178208' }, // 부품 마스터 보드
  { key: 'rentals', boardId: '5025726650' }, // 대여품 관리
  { key: 'serials', boardId: '5025519829' }, // 엑스툴 SN 관리
]

const base = (item: MondayItem): TechRecordBase => ({
  itemId: item.id,
  name: item.name.trim(),
  stage: item.groupTitle,
  url: item.url,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
})

/** 쉼표로 이어진 사람·연결 이름을 배열로. */
const list = (value: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

/** 숫자 칸 — 비었거나 숫자가 아니면 null. */
const num = (value: string | null): number | null => {
  if (value === null) return null
  const parsed = Number(value.replace(/[,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/** 파일 칸 — 여러 파일이면 주소가 쉼표로 이어져 온다. */
const fileCount = (value: string | null): number =>
  list(value).filter((url) => /^https?:\/\//.test(url)).length

/** "N/A" 같은 자리표시를 뺀 주소. */
const link = (value: string | null): string | null =>
  value && /^https?:\/\//.test(value) ? value : null

export const toDocTask = (item: MondayItem): TechDocTask => ({
  ...base(item),
  status: pick(item, /^상태$/),
  assignees: list(pick(item, /^담당자$/)),
  requestedAt: koreaDate(pick(item, /^요청일$/)),
  completedAt: koreaDate(pick(item, /^완료일$/)),
  notionUrl: link(pick(item, /^링크/)),
  details: pick(item, /^상세내용$/),
})

export const toAsRequest = (item: MondayItem): TechAsRequest => ({
  ...base(item),
  receivedAt:
    koreaDate(pick(item, /^접수일자$/)) ?? koreaDate(item.createdAt),
  purchasedAt: koreaDate(pick(item, /^구매일자$/)),
  purchaseChannel: pick(item, /^구매경로$/),
  device: pick(item, /^수리받을기기/),
  model: pick(item, /^기종작성$/),
  symptom: pick(item, /^증상설명$/),
  address: pick(item, /^기기를수령받으실주소$/),
  phone: pick(item, /^연락처/),
  agreed: checked(item, /^확인사항$/),
  attachmentCount: fileCount(pick(item, /^파일$/)),
})

export const toPart = (item: MondayItem): TechPart => ({
  ...base(item),
  nameEn: pick(item, /^부품명\(영어\)$/),
  sku: pick(item, /^본사SKU$/i),
  category: pick(item, /^분류$/),
  stock: num(pick(item, /^재고$/)),
  cost: num(pick(item, /^부품비용$/)),
  priceUsd: num(pick(item, /^After-saleprice/i)),
  location: pick(item, /^재고위치$/),
  usage: pick(item, /^사용내역$/),
  notes: pick(item, /^특이사항$/),
  videoUrl: link(pick(item, /^Partsreplacement/i)),
  hasPhoto: fileCount(pick(item, /^사진$/)) > 0,
})

export const toRental = (item: MondayItem): TechRental => ({
  ...base(item),
  status: pick(item, /^상태$/),
  serialNumber: pick(item, /일련번호|^SN$/i),
  assignees: list(pick(item, /^담당자$/)),
  renter: pick(item, /^고객명/),
  renterPhone: pick(item, /^연락처/),
  rentedAt: koreaDate(pick(item, /^대여일자$/)),
  shipAt: koreaDate(pick(item, /^발송예정일$/)),
  returnedAt: koreaDate(pick(item, /^회수일자$/)),
  hasPhoto: fileCount(pick(item, /사진$/)) > 0,
})

export const toSerial = (item: MondayItem): TechSerial => ({
  ...base(item),
  serialNumber: item.name.trim(),
  device: pick(item, /^기기$/),
  receivedAt: koreaDate(pick(item, /^기기입고일$/)),
  notes: pick(item, /^비고$/),
  links: {
    fieldService: list(pick(item, /^출장기록$/)),
    repair: list(pick(item, /^AS기록$/i)),
    rental: list(pick(item, /^대여품$/)),
  },
  hasPhoto: fileCount(pick(item, /사진$/)) > 0,
})

/** 보드 이름표별 변환 — item 전부를 그 보드의 기록 모양으로. */
export const convertTechBoard = <K extends TechBoardKey>(
  key: K,
  items: MondayItem[],
): TechBoardRecords[K] => {
  const convert = {
    records: toDocTask,
    asRequests: toAsRequest,
    parts: toPart,
    rentals: toRental,
    serials: toSerial,
  }[key] as (item: MondayItem) => TechBoardRecords[K][number]
  return items.map(convert) as TechBoardRecords[K]
}
