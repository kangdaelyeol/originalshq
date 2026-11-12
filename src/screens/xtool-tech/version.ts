// tech 화면 버전 — 설정 > 버전 정보에 보인다. 커밋할 때마다 올린다(SemVer):
//   새 기능(Feat) → 가운데 자리(1.0.0 → 1.1.0) · 고침·다듬기·정리(Fix·Style·Refactor) → 끝자리(1.1.0 → 1.1.1) ·
//   화면 전체를 바꾸는 큰 개편 → 앞자리(2.0.0)
// 업데이트 기록(TECH_CHANGELOG)은 요청이 있을 때 지난 기록 뒤로 바뀐 것을 묶어 맨 위에 더한다 — 한 기록이 그
// 사이 여러 버전을 묶는다(버전은 그 기록을 쓸 때의 TECH_VERSION). 직원이 읽는 글이라 화면에서 보이는 말로 쓴다.

export const TECH_VERSION = '1.35.0'

export type ChangeKind = 'new' | 'improved' | 'fixed'

export interface TechRelease {
  version: string
  /** 한국 날짜(YYYY-MM-DD) */
  date: string
  title?: string
  changes: readonly { kind: ChangeKind; text: string }[]
}

/** 업데이트 기록 — 최근 것부터 */
export const TECH_CHANGELOG: readonly TechRelease[] = [
  {
    version: '1.2.0',
    date: '2026-11-05',
    title: '직책 표시와 화면 다듬기',
    changes: [
      { kind: 'new', text: '직책 — 관리자가 정한 직책(사원~대표)과 그룹장·팀원이 팀원 & 권한에 보여요' },
      { kind: 'improved', text: '팀 현황 — 기술팀으로 등록된 사람만 보여요(맡은 일이 없어도 0건으로 나와요)' },
      {
        kind: 'improved',
        text: '칸 이름 — 고객 이름 칸은 "고객명", 전화번호 칸은 "연락처"로 맞추고 "(- 하이픈 필수)" 같은 입력 안내는 뺐어요',
      },
      { kind: 'improved', text: 'Monday 표 — 보드 위 요약 줄을 처음에는 접어 둬요(펼치면 그 보드는 펼친 채로 기억해요)' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-05',
    title: '첫 버전',
    changes: [
      {
        kind: 'new',
        text: '보드 9개 — 출장업무·AS·자료정리·아톡문의·기타업무·AS 신청서·부품 마스터·대여품 관리·SN 관리를 Monday와 이어서 보고 바로 고쳐요',
      },
      { kind: 'new', text: '개요 — 기술팀 현황·나의 진행 중 업무·일정·챙겨야 할 것을 한 화면에서 봐요' },
      { kind: 'new', text: '내 업무 — 나와 팀원이 맡은 업무를 보드 구분 없이 모아 봐요' },
      { kind: 'new', text: '레이아웃 — 대시보드(유리·물 디자인)와 Monday 표 중에서 골라요' },
      { kind: 'new', text: '팀원 & 권한 — 담당 영역(방문체험·AS), 지금 맡은 업무, 수정 기록을 봐요' },
      { kind: 'new', text: '업데이트(댓글)·파일·하위 아이템·주소 검색·알림' },
      { kind: 'new', text: '프로필 사진과 배경·강조색·유리 효과 설정' },
    ],
  },
]
