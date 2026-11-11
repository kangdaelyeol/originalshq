import { byDateDesc, shortDate } from '@xtool-core/dates';
import { countBy } from '../part-data';
import type { BoardRecord, DashboardBoardDef } from './types';
import { dateOrNull, nameOf, pieces } from './util';

// AS 신청서 — 고객이 직접 낸 AS 신청(양식). 새로 들어온 신청을 보고 처리한다(웹 as-requests-board.tsx).

type R = BoardRecord<'asRequests'>;

const noAssignees = (): string[] => [];
const searchOf = (r: R) => [r.name, r.phone, r.device, r.model, r.symptom, r.address].join(' ');
const deviceOf = (r: R) => [r.device, r.model].filter(v => v && v !== '기타').join(' · ') || r.device;

export const asRequestsDef: DashboardBoardDef<'asRequests'> = {
  key: 'asRequests',
  listTitle: '신청 목록',
  searchPlaceholder: '신청자·기기·증상·주소 검색',
  progress: false,
  records: doc => doc.records,
  assigneesOf: noAssignees,
  searchOf,
  sortDone: (a, b) => byDateDesc(a.receivedAt, b.receivedAt),
  columns: [
    { key: 'name', header: '고객명', sortValue: r => r.name },
    { key: 'device', header: '기기', sortValue: r => deviceOf(r) },
    { key: 'symptom', header: '증상', sortValue: r => r.symptom },
    { key: 'channel', header: '구매 경로', sortValue: r => r.purchaseChannel },
    { key: 'purchased', header: '구매일', sortValue: r => r.purchasedAt },
    { key: 'received', header: '접수일', sortValue: r => r.receivedAt },
    { key: 'agreed', header: '확인', sortValue: r => (r.agreed ? 1 : 0) },
  ],
  row: (r, today) => ({
    id: r.itemId,
    title: nameOf(r.name),
    // 연락처 — 있으면 이름 아래 전화 단추(누르면 전화), 없으면 그 자리에 '연락처 없음'
    subtitle: r.phone ? null : '연락처 없음',
    phone: r.phone ? { number: r.phone } : null,
    // 표의 "확인" 칸 — 확인함이면 초록 알약
    pill: r.agreed ? { label: '확인함', tone: 'good' } : null,
    meta: pieces(deviceOf(r), r.symptom, r.purchaseChannel),
    date: { text: shortDate(r.receivedAt, today), tone: 'muted' },
  }),
  side: (doc, records) => [
    {
      key: 'device',
      title: '기기별 신청',
      subtitle: `전체 ${records.length}건`,
      body: { kind: 'bars', items: countBy(records.map(r => r.device)) },
    },
    {
      key: 'channel',
      title: '구매 경로',
      subtitle: `전체 ${records.length}건`,
      body: { kind: 'bars', items: countBy(records.map(r => r.purchaseChannel)) },
    },
  ],
  detail: (r, today) => ({
    fields: [
      { key: 'device', label: '기기', value: r.device },
      { key: 'model', label: '기종', value: r.model },
      { key: 'purchased', label: '구매일', value: dateOrNull(r.purchasedAt, today) },
      { key: 'channel', label: '구매 경로', value: r.purchaseChannel },
      { key: 'received', label: '접수일', value: dateOrNull(r.receivedAt, today) },
      { key: 'phone', label: '연락처', value: null, phone: r.phone },
      { key: 'address', label: '주소', value: r.address },
      { key: 'agreed', label: '확인사항', value: r.agreed ? '확인함' : '체크 안 함' },
    ],
    texts: [{ label: '증상 설명', text: r.symptom }],
    lists: [],
  }),
};
