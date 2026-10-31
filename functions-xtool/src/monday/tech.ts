import { koreaDate, pick, source } from './fields'
import { subitemNumber, subitemText } from './purchases'
import {
  MondayBoardKind,
  MondayFieldService,
  MondayItem,
  MondayTechFact,
  MondayTechKind,
  MondayRepair,
  MondayTechInquiry,
  MondayTechTask,
} from './types'

// 기술지원팀 워크스페이스의 원본 보드(출장업무·AS·아톡문의·기타업무)를 고객 기록으로
// 바꾼다. 개인 보드(담당자별)는 이 보드들의 item을 연결·미러로 보여줄
// 뿐이라 가져오지 않는다.

/** 끝난 건인지 — 네 보드 모두 마지막 그룹 이름에 "완료"가 들어 있다(완료,
 * 완료된 문의). 그룹이 없으면 상태값으로 본다. */
export const isTechDone = (record: {
  stage: string | null
  status: string | null
}): boolean => /완료/.test(record.stage ?? record.status ?? '')

// 하위 아이템에 이름만 "."처럼 찍어 둔 빈 줄이 있다.
const BLANK_LINE = /^[\s.\-ㄱ-ㅎ]*$/

export const toFieldService = (item: MondayItem): MondayFieldService => ({
  ...source(item),
  stage: item.groupTitle,
  status: pick(item, /^상태$/),
  type: pick(item, /^출장종류$/),
  receivedAt: pick(item, /^접수일$/),
  visitAt: pick(item, /^방문일정$/),
  region: pick(item, /^출장지역/),
  address: pick(item, /^주소$/),
  assignee: pick(item, /^담당자$/),
  notes: pick(item, /^비고$/),
  items: (item.subitems ?? [])
    .map((subitem) => ({
      name: subitemText(subitem, /^품명$/) ?? subitem.name.trim(),
      quantity: subitemNumber(subitem, /^수량$/),
      note: subitemText(subitem, /^비고$/),
    }))
    .filter((line) => !BLANK_LINE.test(line.name)),
})

export const toRepair = (item: MondayItem): MondayRepair => {
  const parts = (item.subitems ?? [])
    .map((subitem) => ({
      name: subitem.name.trim(),
      part: subitemText(subitem, /^부품명$/),
      sku: subitemText(subitem, /^부품SKU$/),
      price: subitemNumber(subitem, /^부품금액$/),
      quantity: subitemNumber(subitem, /^수량$/),
      total: subitemNumber(subitem, /^합계$/) ?? 0,
    }))
    // 부품 연결도 금액도 없는 줄은 연습으로 만든 빈 줄이다.
    .filter((line) => line.part !== null || line.total !== 0)
  return {
    ...source(item),
    stage: item.groupTitle,
    status: pick(item, /^수리진행상태$/),
    device: pick(item, /^기기항목$/),
    serialNumber: pick(item, /^SN$/i),
    symptom: pick(item, /^증상$/),
    // "수리 내역서"(발행 버튼)와 헷갈리지 않게 제목 전체로 찾는다.
    result: pick(item, /^수리내역\(결과\)$/),
    address: pick(item, /^주소$/),
    assignee: pick(item, /^담당자$/),
    receivedAt: pick(item, /^접수일$/),
    completedAt: pick(item, /^완료일$/),
    parts,
    amount: parts.reduce((sum, line) => sum + line.total, 0),
  }
}

export const toTechInquiry = (item: MondayItem): MondayTechInquiry => ({
  ...source(item),
  stage: item.groupTitle,
  status: pick(item, /^상담상태$/),
  deviceSeries: pick(item, /^문의주실기기/),
  device: pick(item, /^기기종류$/),
  type: pick(item, /^문의종류$/),
  content: pick(item, /^문의내용$/),
  resolution: pick(item, /^해결방안$/),
  assignee: pick(item, /^담당자$/),
  receivedAt: pick(item, /^접수일자$/),
})

export const toTechTask = (item: MondayItem): MondayTechTask => ({
  ...source(item),
  stage: item.groupTitle,
  status: pick(item, /^상태$/),
  requester: pick(item, /^요청$/),
  assignee: pick(item, /^담당자$/),
  requestedAt: pick(item, /^요청일$/),
  startedAt: pick(item, /^시작일$/),
  dueAt: pick(item, /^마감일$/),
  completedAt: pick(item, /^완료일$/),
  details: pick(item, /^상세내용$/),
})

// 보드의 첫 그룹 — 들어와서 아직 아무도 손대지 않은 건.
const FIRST_STAGE = /^(신규|새로\s*인입|진행\s*전)/

const TECH_KINDS: ReadonlySet<MondayBoardKind> = new Set<MondayTechKind>([
  'fieldService',
  'repair',
  'techInquiry',
  'techTask',
])

/** 기술 통계 재료(순수 함수) — 기술지원팀 네 보드의 기록 전부를 한 줄씩.
 * 번호가 없는 기록도 넣는다. */
export const buildTechFacts = (
  items: MondayItem[],
  kindByBoardId: Map<string, MondayBoardKind>,
): MondayTechFact[] => {
  const facts: MondayTechFact[] = []
  for (const item of items) {
    const kind = kindByBoardId.get(item.boardId)
    if (!kind || !TECH_KINDS.has(kind)) continue
    const updatedAt = koreaDate(item.updatedAt) ?? ''
    const base = {
      kind: kind as MondayTechKind,
      itemId: item.id,
      boardName: item.boardName,
      name: source(item).name || item.name,
      url: item.url,
      linked: item.phone !== null,
    }
    // 끝난 날 — 적힌 날이 없으면 마지막 수정일로 대신한다.
    const finish = (done: boolean, date: string | null) => ({
      doneAt: done ? (koreaDate(date) ?? updatedAt) : '',
      doneAtGuessed: done && !koreaDate(date),
    })
    const assigneesOf = (value: string | null) =>
      (value ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    const common = (record: {
      stage: string | null
      status: string | null
      assignee: string | null
    }) => ({
      assignees: assigneesOf(record.assignee),
      stage: record.stage,
      status: record.status,
      isNew: FIRST_STAGE.test(record.stage ?? ''),
      done: isTechDone(record),
    })

    if (kind === 'fieldService') {
      const record = toFieldService(item)
      const head = common(record)
      facts.push({
        ...base,
        ...head,
        receivedAt: koreaDate(record.receivedAt) ?? '',
        ...finish(head.done, record.visitAt),
        visitAt: koreaDate(record.visitAt) ?? '',
        device: null,
        type: record.type,
        region: record.region,
        amount: 0,
      })
    } else if (kind === 'repair') {
      const record = toRepair(item)
      const head = common(record)
      facts.push({
        ...base,
        ...head,
        receivedAt: koreaDate(record.receivedAt) ?? '',
        ...finish(head.done, record.completedAt),
        visitAt: '',
        device: record.device,
        type: null,
        region: null,
        amount: record.amount,
      })
    } else if (kind === 'techInquiry') {
      const record = toTechInquiry(item)
      const head = common(record)
      facts.push({
        ...base,
        ...head,
        receivedAt:
          koreaDate(record.receivedAt) ?? koreaDate(item.createdAt) ?? '',
        ...finish(head.done, null),
        visitAt: '',
        // 계열과 이름이 같게 적힌 건("DTF" · "DTF")은 한 번만.
        device:
          [
            ...new Set(
              [record.deviceSeries, record.device].filter(
                (value) => value && value !== '기타',
              ),
            ),
          ].join(' · ') || null,
        type: record.type,
        region: null,
        amount: 0,
      })
    } else {
      const record = toTechTask(item)
      const head = common(record)
      facts.push({
        ...base,
        ...head,
        receivedAt:
          koreaDate(record.requestedAt) ?? koreaDate(item.createdAt) ?? '',
        ...finish(head.done, record.completedAt),
        visitAt: '',
        device: null,
        type: null,
        region: null,
        amount: 0,
      })
    }
  }
  return facts
}
