import { FormSheet } from './policy-modal'

// A/S 신청 확인사항 — 시작 화면에서 "AS 접수"를 고르면 다음 화면으로 가기 전에 띄운다. 문구는 기술지원팀이 준 안내
// 그대로다(바뀌면 그대로 고친다). 전화번호만 눌러 바로 걸 수 있게 링크로 바꿨다.

export const AS_NOTICE_TITLE = 'A/S 신청 확인사항'

/**
 * 확인사항 창 — "확인했습니다"를 누르면 다음 화면(성함·연락처)으로 간다(onConfirm). 닫기(X)·Esc·바깥 누르기는
 * 시작 화면에 그대로 남는다(onClose).
 */
export function AsNoticeModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <FormSheet
      title={AS_NOTICE_TITLE}
      onClose={onClose}
      fit
      footer={
        <button type="button" className="tech-form__button tech-form__button--block" onClick={onConfirm}>
          확인했습니다
        </button>
      }
    >
      <ol className="tech-form__notice">
        <li>
          대형 제품 (P시리즈, DTF, 메탈팹)을 제외한 제품은 <strong>택배</strong>로 보내주셔야 하며 제품 포장 시{' '}
          <strong>기기 본품 + 어댑터(전원선)</strong>까지 보내주셔야 합니다.
        </li>
        <li>
          A/S는 제품 상태, 부품 수급 및 점검 내용에 따라 <strong>2주 이상</strong> 소요될 수 있습니다.
        </li>
        <li>
          제품 구매일로부터 <strong>최대 1년 이내의 경우 무상A/S</strong>가 지원됩니다.
        </li>
        <li>
          택배 보내주실 주소 및 연락처
          <ul className="tech-form__notice-address">
            <li>경기도 파주시 회동길 325-20 1층 기술지원팀</li>
            <li>
              <a href="tel:070-8018-3394">070-8018-3394</a>
            </li>
          </ul>
        </li>
      </ol>
    </FormSheet>
  )
}
