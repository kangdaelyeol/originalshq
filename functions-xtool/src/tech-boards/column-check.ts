import { Firestore } from 'firebase-admin/firestore'
import { squash } from '../monday/fields'
import { ASSIGNEE_BOARDS, ASSIGNEE_TITLE } from './assignees'
import { TECH_BOARDS } from './boards'
import { getBoardMeta } from './firestore'
import { findPhoneColumn, PHONE_COPY } from './phones'
import { RuleProblem, ruleProblems } from './rules'
import { TechBoardKey } from './types'

// 칸 이름 점검(관리 화면) — 코드가 칸·그룹·라벨을 이름으로 찾는 곳 중 보드에 없는 것을 보드마다 모은다. Monday에서
// 칸 이름을 바꾸거나 지운 뒤 동기화하고 눌러 본다. 보드 정보는 캐시(techBoardMeta)를 본다 — 웹훅 규칙이 보는 것과
// 같다. 세 가지:
//  - 자동화 규칙(rules.ts ruleProblems)·설치 품목 미러·전화번호 복사·담당자(엑스툴) 칸
//  - 보드 화면 기록 칸 — 대시보드·물 화면이 읽는 칸이 최근 항목에서 모두 비어 있으면 이름이 바뀌었거나 지운
//    칸으로 본다(변환 코드의 칸 이름을 여기에 다시 적지 않고 결과로 본다). 이름표는 화면에 보일 것만.
//  - 화면 묶기(타임라인·기본 칸 순서)는 웹이 xtool-core로 본다 — 그래서 칸 목록도 돌려준다.

export interface ColumnCheckBoard {
  key: TechBoardKey
  name: string
  /** 마지막으로 전체 동기화한 시각(ms) — 동기화 전이면 점검이 옛 이름을 본다 */
  syncedAt: number | null
  /** 기록 칸을 본 최근 항목 수 */
  sampled: number
  problems: RuleProblem[]
  /** 칸 목록(웹이 화면 묶기를 본다) */
  columns: Array<{ id: string; title: string; type: string }>
}

// 기록 칸을 볼 항목 수 — 칸 이름이 바뀌면 동기화 뒤 모든 항목에서 비므로 일부만 봐도 된다.
const SAMPLE = 200

// 보드 화면(대시보드·물)이 읽는 기록 칸 — 기록 이름 → Monday 칸 이름(화면에 보일 것). 여기 없는 기록(이름에서 뽑은
// 번호·체크·파일 수 등)은 비어 있어도 칸 이름과 상관이 없어 보지 않는다.
const RECORD_LABELS: Record<TechBoardKey, Record<string, string>> = {
  fieldService: {
    status: '상태',
    type: '출장종류',
    receivedAt: '접수일',
    visitAt: '방문일정',
    region: '출장지역',
    address: '주소',
    assignee: ASSIGNEE_TITLE,
    notes: '비고',
  },
  repair: {
    status: '수리 진행 상태',
    device: '기기 항목',
    serialNumber: 'SN',
    symptom: '증상',
    result: '수리 내역(결과)',
    address: '주소',
    assignee: ASSIGNEE_TITLE,
    receivedAt: '접수일',
    completedAt: '완료일',
  },
  techInquiry: {
    status: '상담 상태',
    deviceSeries: '문의 주신 기기…',
    device: '기기 종류',
    type: '문의 종류',
    content: '문의 내용',
    resolution: '해결 방안',
    assignee: ASSIGNEE_TITLE,
    receivedAt: '접수일자',
  },
  techTask: {
    status: '상태',
    requester: '요청',
    assignee: ASSIGNEE_TITLE,
    requestedAt: '요청일',
    startedAt: '시작일',
    dueAt: '마감일',
    completedAt: '완료일',
    details: '상세 내용',
  },
  asRequests: {
    purchasedAt: '구매일자',
    purchaseChannel: '구매경로',
    device: '수리받을 기기…',
    model: '기종 작성',
    symptom: '증상 설명',
    address: '기기를 수령받으실 주소',
    phone: '연락처…',
  },
  parts: {
    nameEn: '부품명(영어)',
    sku: '본사 SKU',
    category: '분류',
    stock: '재고',
    cost: '부품비용',
    priceUsd: 'After-sale price…',
    location: '재고 위치',
    usage: '사용내역',
    notes: '특이사항',
    videoUrl: 'Parts replacement…',
  },
  rentals: {
    status: '상태',
    serialNumber: '일련번호·SN',
    assignees: '담당자',
    renter: '고객명…',
    renterPhone: '연락처…',
    rentedAt: '대여일자',
    shipAt: '발송예정일',
    returnedAt: '회수일자',
  },
  serials: {
    device: '기기',
    receivedAt: '기기입고일',
    notes: '비고',
  },
}

const isEmpty = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)

/** 최근 항목에서 모두 빈 기록 칸 */
async function emptyRecordFields(
  db: Firestore,
  key: TechBoardKey,
): Promise<{ sampled: number; problems: RuleProblem[] }> {
  const snap = await db
    .collection('techItems')
    .where('boardKey', '==', key)
    .limit(SAMPLE)
    .select('record')
    .get()
  const records = snap.docs.map(
    (d) => (d.get('record') ?? {}) as Record<string, unknown>,
  )
  if (records.length === 0) return { sampled: 0, problems: [] }
  const problems = Object.entries(RECORD_LABELS[key])
    .filter(([field]) => records.every((r) => isEmpty(r[field])))
    .map(([, label]) => ({
      where: '보드 화면',
      expected: label,
      effect:
        `최근 ${records.length}건 모두 비어 있어요 — 이름이 바뀌었거나 지운 ` +
        '칸이면 대시보드·물 화면의 그 자리가 비어요',
      candidates: [],
    }))
  return { sampled: records.length, problems }
}

/** 보드마다 이름으로 찾는 곳 중 없는 것 */
export async function checkColumnNames(
  db: Firestore,
): Promise<ColumnCheckBoard[]> {
  return Promise.all(
    TECH_BOARDS.map(async (source) => {
      const meta = await getBoardMeta(db, source.key)
      const columns = meta?.columns ?? []
      const board = {
        columns,
        groups: meta?.groups ?? [],
        subitems: meta?.subitems,
      }
      const problems = meta ? ruleProblems(source.key, board) : []
      if (meta && source.key === 'fieldService') {
        const mirror = columns.some(
          (c) => c.type === 'mirror' && squash(c.title) === squash('설치 품목'),
        )
        if (!mirror) {
          problems.push({
            where: '설치 품목 점검',
            expected: '설치 품목 (미러 칸)',
            effect: '설치 품목 점검이 품명만 보고 미러 글자는 못 맞춰 봐요',
            candidates: columns
              .filter((c) => c.type === 'mirror')
              .map((c) => c.title),
          })
        }
      }
      const phone = PHONE_COPY[source.key]
      if (meta && phone && !findPhoneColumn(columns, phone.title)) {
        problems.push({
          where: '전화번호 복사',
          expected: `${phone.title} (전화 칸)`,
          effect: '이름에 적힌 번호를 전화번호 칸에 못 옮겨요',
          candidates: columns
            .filter((c) => c.type === 'phone')
            .map((c) => c.title),
        })
      }
      const assignee = columns.some(
        (c) => c.type === 'text' && squash(c.title) === squash(ASSIGNEE_TITLE),
      )
      if (meta && ASSIGNEE_BOARDS.includes(source.key) && !assignee) {
        problems.push({
          where: '담당자',
          expected: `${ASSIGNEE_TITLE} (글자 칸)`,
          effect:
            '우리 화면의 담당자를 보이고 고칠 칸이 없어요 — 관리 화면 ' +
            '"담당자 옮기기"로 만들 수 있어요',
          candidates: [],
        })
      }
      const records = await emptyRecordFields(db, source.key)
      return {
        key: source.key,
        name: meta?.name ?? source.key,
        syncedAt: meta?.syncedAt ?? null,
        sampled: records.sampled,
        problems: [...problems, ...records.problems],
        columns: columns.map(({ id, title, type }) => ({ id, title, type })),
      }
    }),
  )
}
