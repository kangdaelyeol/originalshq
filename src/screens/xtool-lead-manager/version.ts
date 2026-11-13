// 리드 매니저 버전 — 아래 띠의 버전 알약에 보이고, 누르면 업데이트 기록이 뜬다(footer.tsx).
// 커밋할 때마다 올린다(SemVer):
//   새 기능(Feat) → 가운데 자리(3.7.0 → 3.8.0) · 고침·빠르게·정리(Fix·Perf·Refactor·Style) → 끝자리(3.8.0 → 3.8.1) ·
//   화면 전체를 바꾸는 큰 개편 → 앞자리(4.0.0)
// 지난 기록(3.7.0까지)은 커밋 기록을 날짜별로 묶어 매겼다 — 그날 새 기능이 있으면 가운데 자리, 고침만 있으면 끝자리.
// 앞자리: 1.0.0 리드가 서버에 저장되기 시작(08-19) · 2.0.0 검은 화면 개편(09-20) · 3.0.0 유리 디자인(10-29).
// 업데이트 기록(LM_CHANGELOG)은 맨 위에 더한다. 직원이 읽는 글이라 화면에서 보이는 말로 쓴다.

export const LM_VERSION = '3.12.0'

export type ChangeKind = 'new' | 'improved' | 'fixed'

export interface LmRelease {
  version: string
  /** 한국 날짜(YYYY-MM-DD) */
  date: string
  title?: string
  changes: readonly { kind: ChangeKind; text: string }[]
}

/** 업데이트 기록 — 최근 것부터 */
export const LM_CHANGELOG: readonly LmRelease[] = [
  {
    version: '3.12.0',
    date: '2026-11-13',
    title: 'CAPI 자동 전송 시작',
    changes: [
      {
        kind: 'new',
        text: '미리보기를 마치고 CAPI 자동 전송을 실제로 보내기 시작했어요 — 오프라인 결제와 기타 온라인·B2G 문의가 Monday 동기화 20분 뒤 Meta에 가고 CAPI 관리 탭에 쌓여요',
      },
    ],
  },
  {
    version: '3.11.1',
    date: '2026-11-12',
    changes: [
      {
        kind: 'fixed',
        text: 'CAPI 자동 전송이 Monday 동기화 20분 뒤에 따로 돌아요 — 동기화가 길어진 날에도 중간에 끊기지 않고, 보낸 건은 바로바로 기록돼요',
      },
    ],
  },
  {
    version: '3.11.0',
    date: '2026-11-11',
    title: 'CAPI 자동 전송',
    changes: [
      {
        kind: 'new',
        text: '오프라인 결제와 기타 온라인·B2G 문의(신규 상담 유입·오기입 제외)를 Monday 동기화 뒤 자동으로 CAPI에 보내요 — 지금은 보낼 목록만 확인하는 미리보기예요',
      },
      { kind: 'new', text: '자동으로 보낸 기록은 리드 이력에 "자동 전송"으로 표시돼요' },
      { kind: 'improved', text: '탭 이름을 CAPI 관리로 바꿨어요' },
    ],
  },
  {
    version: '3.10.0',
    date: '2026-11-10',
    title: '판매 채널 보기',
    changes: [
      {
        kind: 'new',
        text: '판매통계 그래프에 마우스를 올리면 제품마다 오프라인·온라인 중 어디서 팔렸는지 보여요',
      },
    ],
  },
  {
    version: '3.9.0',
    date: '2026-11-10',
    title: '기간 더 고르기',
    changes: [
      { kind: 'new', text: '리드 분석 기간에 저번 주와 직접 설정(달력에서 날짜 고르기)이 생겼어요' },
      { kind: 'improved', text: '여러 번 문의한 고객을 펼치면 그 줄들이 한 묶음으로 색칠돼 눈에 잘 띄어요' },
    ],
  },
  {
    version: '3.8.0',
    date: '2026-11-08',
    title: '업데이트 기록',
    changes: [
      { kind: 'new', text: '아래 띠의 버전 알약을 누르면 업데이트 기록을 봐요' },
      { kind: 'fixed', text: '저작권 표기를 시스템을 만들고 관리하는 Originals Inc.로 고쳤어요' },
    ],
  },
  {
    version: '3.7.0',
    date: '2026-11-08',
    title: '리드 분석 다듬기',
    changes: [
      { kind: 'new', text: '문의 원문·상담 메모 — 두 줄까지 보이고, 마우스를 올리면 두 글을 한 창에서 다 봐요' },
      {
        kind: 'new',
        text: '상태 거르기를 기간 밑 버튼 줄로, 소재별로 볼 때는 소재 줄도 생겨요(소재 하나를 고르면 30건씩 쪽으로)',
      },
      { kind: 'new', text: '전체보기 — 표를 화면 가득 펼쳐 봐요' },
      { kind: 'improved', text: '거르기는 고른 값만 적은 한 줄로 접혀 있고, 누르면 펼쳐요(Enter·Esc로 다시 접기)' },
      {
        kind: 'improved',
        text: '페이지가 화면 높이에 딱 맞아 표만 스크롤해요 — 마지막 동기화 시각은 표 머리 오른쪽에',
      },
      { kind: 'improved', text: '0건 버튼은 누를 수 없고, 소재 머리 줄은 표를 내려도 위에 붙어 있어요' },
      { kind: 'fixed', text: 'Monday 동기화가 겹쳐 돌지 않게 막고, 고객 목록 다시 만들기를 더 안전하게' },
    ],
  },
  {
    version: '3.6.0',
    date: '2026-11-07',
    title: '리드 분석 탭',
    changes: [
      {
        kind: 'new',
        text: '리드 분석 — 상담 보드에 들어온 리드를 한 건씩 스크롤로 읽어요(기간·상태·보드·매체 거르기, 쪽 넘기기)',
      },
      { kind: 'new', text: '오기입 리드는 이름을 누르면 오기입 추적(GA 이벤트)이 같이 떠요' },
      { kind: 'new', text: '렌탈·할부·가격·원거리·학교·기관·견적 같은 말은 색으로 칠하고, 소재별로 묶어 볼 수 있어요' },
      { kind: 'new', text: '매출 그래프 — 수량/금액 바꿔 보기' },
      { kind: 'new', text: '모든 버튼 묶음에서 좌/우 방향키로 옆 버튼을 골라요' },
      { kind: 'improved', text: '고객 상세 — 왼쪽 목록에서 앞뒤 고객을 미리 받아 두어 바로 열려요' },
      { kind: 'improved', text: '리드 분석이 빨리 열려요(동기화 때 미리 저장)' },
      { kind: 'fixed', text: '퍼널 주석이 구매 범위를 따라가고, 리드 분석 전체 보기가 시간 초과되지 않아요' },
    ],
  },
  {
    version: '3.5.0',
    date: '2026-11-05',
    title: '로그인과 여러 기기',
    changes: [
      { kind: 'new', text: '구성원 로그인 — 가입한 구성원만 들어와요' },
      { kind: 'new', text: 'Monday 고객을 상담 보드로 걸러 봐요' },
      { kind: 'new', text: '기기 F1 울트라, 한 상담에 기기 여러 개' },
      { kind: 'improved', text: '리드 표·퍼널·통계 정렬이 빨라졌어요' },
      { kind: 'fixed', text: '리드 기록 저장·관리자 확인을 더 안전하게, GA 이벤트가 커서 저장되지 않던 것' },
      { kind: 'fixed', text: '킹 카드가 월요일 시작 주로 세요' },
    ],
  },
  {
    version: '3.4.0',
    date: '2026-11-04',
    changes: [{ kind: 'new', text: 'Monday 고객 상세에 고객이 적은 문의 원문이 보여요' }],
  },
  {
    version: '3.3.0',
    date: '2026-11-02',
    changes: [
      { kind: 'new', text: '영업·기술 보고서' },
      { kind: 'improved', text: '탭 자리 정리' },
      { kind: 'fixed', text: '빠진 고객을 세는 기준' },
    ],
  },
  {
    version: '3.2.0',
    date: '2026-11-01',
    title: 'Monday 고객 상세',
    changes: [
      { kind: 'new', text: 'Monday 고객 상세 — 상담·방문·구매 기록을 종류별 단추로 골라 봐요' },
      { kind: 'new', text: '매출 보고서' },
      { kind: 'new', text: 'Monday 기술 자료 동기화(이미지 포함)' },
    ],
  },
  {
    version: '3.1.0',
    date: '2026-10-30',
    changes: [
      { kind: 'new', text: '불러오는 중에는 도는 표시가 뜨고, 다 받으면 부드럽게 바뀌어요' },
      { kind: 'improved', text: '유리 디자인을 공용 부품으로 정리' },
      { kind: 'fixed', text: 'Monday 탭 메뉴 모양, 매출 KPI, 고객 상세 왼쪽 목록 여백' },
    ],
  },
  {
    version: '3.0.0',
    date: '2026-10-29',
    title: '유리 디자인',
    changes: [
      { kind: 'new', text: '화면 전체를 유리 디자인으로 바꾸고 테마를 고를 수 있어요' },
      { kind: 'new', text: '탭을 옮길 때 화면이 부드럽게 바뀌어요' },
      { kind: 'improved', text: 'KPI 짝 카드 모양, 화면 그리기가 빨라졌어요' },
    ],
  },
  {
    version: '2.16.0',
    date: '2026-10-28',
    title: 'CS팀 화면',
    changes: [
      { kind: 'new', text: '실시간 유입, CS팀 현황, CS 접수 칸' },
      { kind: 'new', text: '기간 고르기 — 오늘·이번 주 같은 기간을 고르면 날짜가 알아서 맞춰져요' },
      { kind: 'improved', text: '리드 화면 배치, 개인 KPI는 CS 칸으로 옮겼어요' },
      { kind: 'fixed', text: '방치 고객 기준' },
    ],
  },
  {
    version: '2.15.0',
    date: '2026-10-27',
    changes: [
      { kind: 'new', text: '고객 창에서 정렬' },
      { kind: 'fixed', text: 'Esc가 뒤의 창까지 닫던 것, 저장 뒤 결과 표시' },
    ],
  },
  {
    version: '2.14.0',
    date: '2026-10-26',
    changes: [{ kind: 'new', text: 'Meta 전환(CAPI)에 이벤트가 난 페이지 주소를 같이 보내요' }],
  },
  {
    version: '2.13.0',
    date: '2026-10-22',
    title: '이상 고객 추적',
    changes: [
      { kind: 'new', text: '이상 고객 추적 탭과 일괄 수집' },
      { kind: 'new', text: '중복 연락처 거르기, 번호 칸, Monday CRM 강조 탭' },
      { kind: 'new', text: '불러오는 동안 화면 뼈대 표시' },
    ],
  },
  {
    version: '2.12.0',
    date: '2026-10-21',
    changes: [
      { kind: 'new', text: '오기입 추적(GA4) 탭, 고객 구매 경로 자세히 보기' },
      { kind: 'fixed', text: '이상값 기준' },
    ],
  },
  {
    version: '2.11.0',
    date: '2026-10-20',
    changes: [
      { kind: 'new', text: '광고비 대비 매출(이전 ROAS)' },
      { kind: 'new', text: '자료를 정해진 간격마다 새로 받아요' },
    ],
  },
  {
    version: '2.10.0',
    date: '2026-10-18',
    changes: [{ kind: 'new', text: 'GA4 이벤트에 B2G 신청 여부를 같이 남겨요' }],
  },
  {
    version: '2.9.0',
    date: '2026-10-16',
    title: '담당자 KPI',
    changes: [
      { kind: 'new', text: 'B2G 칸, 남은 매출 지표' },
      { kind: 'new', text: '담당자 KPI(정렬 포함)와 남은 매출을 한 칸에' },
      { kind: 'new', text: '키보드로 탭을 옮겨요' },
    ],
  },
  {
    version: '2.8.0',
    date: '2026-10-14',
    changes: [{ kind: 'new', text: 'Meta 전환(CAPI)에 이름을 같이 보내 맞는 고객을 더 잘 찾아요' }],
  },
  {
    version: '2.7.0',
    date: '2026-10-13',
    title: '통계 탭',
    changes: [
      { kind: 'new', text: '통계 탭 — 평균·합계 줄, 매출 통계와 정렬' },
      { kind: 'new', text: '리드 탭에 Monday 패널, Cafe24 고객 자료로 패널 분석' },
    ],
  },
  {
    version: '2.6.0',
    date: '2026-10-12',
    title: 'Monday 연결',
    changes: [
      { kind: 'new', text: 'Monday CRM 탭 — Monday 보드 자료를 읽어 오고 동기화해요' },
      { kind: 'new', text: '미결제 매출 지표, 패널 통계' },
    ],
  },
  {
    version: '2.5.1',
    date: '2026-10-09',
    changes: [{ kind: 'improved', text: '고객 상세 내부 정리' }],
  },
  {
    version: '2.5.0',
    date: '2026-10-02',
    changes: [{ kind: 'new', text: '이메일 칸' }],
  },
  {
    version: '2.4.0',
    date: '2026-10-01',
    changes: [{ kind: 'new', text: 'WonderPress 칸' }],
  },
  {
    version: '2.3.0',
    date: '2026-09-24',
    changes: [
      { kind: 'new', text: '쪽 넘기기, 상담 메모 칸, 고객 상세 왼쪽 목록' },
      { kind: 'improved', text: '고치기 모양, 상담 요약 표는 뺐어요' },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-09-23',
    changes: [
      { kind: 'new', text: '확인 창 자동 완성, 기기별 요약' },
      { kind: 'new', text: '등록 창에서 구매 전송, 구매 전송 다시 보내기' },
      { kind: 'fixed', text: 'Meta 전환의 전송 경로(action_source)' },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-09-21',
    changes: [
      { kind: 'new', text: '전체 요약에 채널 거르기, 기기 "기타"' },
      { kind: 'improved', text: '고치기는 고객 상세 창에서 해요' },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-09-20',
    title: '검은 화면 개편',
    changes: [
      { kind: 'new', text: '검은 바탕 화면으로 바꾸고 표를 새 구조로 다시 만들었어요' },
      { kind: 'improved', text: '자료 구조 개편' },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-09-18',
    changes: [{ kind: 'new', text: '테스트 이벤트 보내기' }],
  },
  {
    version: '1.8.1',
    date: '2026-09-13',
    changes: [{ kind: 'improved', text: '화면 다듬기' }],
  },
  {
    version: '1.8.0',
    date: '2026-09-07',
    changes: [{ kind: 'new', text: '택배 발송 보드 자료 구조' }],
  },
  {
    version: '1.7.0',
    date: '2026-09-06',
    changes: [{ kind: 'new', text: '오프라인 문의·방문체험(평일·주말)·방문 설문 자료 구조' }],
  },
  {
    version: '1.6.0',
    date: '2026-09-05',
    changes: [{ kind: 'new', text: '사용자·온라인 문의 자료 구조' }],
  },
  {
    version: '1.5.1',
    date: '2026-09-03',
    changes: [{ kind: 'improved', text: '내부 정리' }],
  },
  {
    version: '1.5.0',
    date: '2026-09-01',
    changes: [
      { kind: 'improved', text: '문의 시각을 정하는 기준' },
      { kind: 'fixed', text: '구매로 바뀌는 조건' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-31',
    changes: [
      { kind: 'new', text: '구매 칸 표시' },
      { kind: 'fixed', text: '예시 자료를 지웠어요' },
    ],
  },
  {
    version: '1.3.1',
    date: '2026-08-30',
    changes: [{ kind: 'improved', text: '리드 등록·기기·금액 고치기 내부 정리' }],
  },
  {
    version: '1.3.0',
    date: '2026-08-28',
    changes: [{ kind: 'new', text: '리드마다 고유 번호 — Meta 전환이 두 번 세지지 않게' }],
  },
  {
    version: '1.2.2',
    date: '2026-08-27',
    changes: [
      { kind: 'fixed', text: '리드 목록을 다시 불러오지 못하던 경우' },
      { kind: 'improved', text: '내부 정리' },
    ],
  },
  {
    version: '1.2.1',
    date: '2026-08-26',
    changes: [{ kind: 'improved', text: '정렬·기기 거르기 내부 정리' }],
  },
  {
    version: '1.2.0',
    date: '2026-08-25',
    changes: [
      { kind: 'new', text: '기기 O1' },
      { kind: 'fixed', text: '리드 상태 값' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-20',
    changes: [{ kind: 'new', text: '기기 F2·M2' }],
  },
  {
    version: '1.0.0',
    date: '2026-08-19',
    title: '첫 버전',
    changes: [
      { kind: 'new', text: '리드 등록 창 — 등록한 리드가 서버에 저장돼요(불러오기·고치기·지우기)' },
      { kind: 'new', text: '문의·구매 시각 고치기, 상태 칸' },
      { kind: 'new', text: 'Meta 전환(CAPI) 보내기' },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-08-17',
    changes: [{ kind: 'improved', text: '서버(Firebase) 연결 준비' }],
  },
  {
    version: '0.9.0',
    date: '2026-08-15',
    changes: [
      { kind: 'new', text: '전화번호 형식, 불러오는 중 표시, 알림 메시지' },
      { kind: 'fixed', text: '표 모양' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-14',
    changes: [{ kind: 'improved', text: '표를 부품으로 다시 만들었어요' }],
  },
  {
    version: '0.7.0',
    date: '2026-08-11',
    changes: [
      { kind: 'new', text: '등록·삭제 확인 창, 고객 상세' },
      { kind: 'new', text: '검색 거르기, 정렬 단추, 기기 거르기' },
      { kind: 'new', text: '아래 띠(버전 표시)' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-10',
    changes: [
      { kind: 'new', text: '구매한 고객 표, 검색' },
      { kind: 'fixed', text: '메뉴 모양과 상태, 표 구분선' },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-09',
    changes: [{ kind: 'new', text: '리드 표 — 접고 펴는 표, 상담한 고객 표' }],
  },
  {
    version: '0.4.0',
    date: '2026-08-08',
    changes: [{ kind: 'new', text: '검색창, 줄 고르기, 표 머리글' }],
  },
  {
    version: '0.3.0',
    date: '2026-08-07',
    changes: [{ kind: 'new', text: '고객 연락처 자료 구조' }],
  },
  {
    version: '0.2.0',
    date: '2026-07-22',
    changes: [
      { kind: 'new', text: '위에 붙는 머리 줄과 메뉴' },
      { kind: 'fixed', text: '전체 스타일' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-21',
    title: '시작',
    changes: [{ kind: 'new', text: '리드 매니저 페이지를 만들었어요' }],
  },
]
