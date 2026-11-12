import { Check } from 'lucide-react'
import { FormSheet } from '@/screens/tech-form/policy-modal'

// 물품 대여 계약서 — 기술지원팀이 준 계약서 글을 그대로 옮겼다(바뀌면 그대로 고친다). 빈칸(성함·연락처·배송 주소·대여
// 물품·대여 기간·대여료·보증금·총 결제 금액)은 폼에 적은 값과 운영 기준(대여료 기기마다 1일 10,000원, 10영업일 이상이면
// 보증금 기기마다 200,000원)으로 채운다. 제2조 아래 대여료·보증금 기준은 운영 기준을 보충한 것이다.

/** 계약서 빈칸에 채울 신청자 정보 — 아직 안 적었으면 빈 글자 */
export interface ContractApplicant {
  name: string
  phone: string
  address: string
  /** 고른 대여 제품을 이어 쓴 글 */
  products: string
  /** 대여 기간 — "2026년 11월 12일 ~ 2026년 11월 14일 (3일간)", 아직 덜 골랐으면 빈 글자 */
  period: string
  /** 대여료 계산 — "1일 10,000원 × 3일 = 30,000원", 기간을 덜 골랐으면 빈 글자 */
  fee: string
  /** 보증금 — "없음 (영업일 3일 · 10영업일 미만)" 또는 "200,000원 (…)", 기간을 덜 골랐으면 빈 글자 */
  deposit: string
  /** 총 결제 금액 — "230,000원 (대여료 30,000원 + 보증금 200,000원)", 기간을 덜 골랐으면 빈 글자 */
  total: string
}

/** 값이 없으면 흐린 "입력 전" */
function Blank({ value }: { value: string }) {
  return value ? <>{value}</> : <span className="rental-form__blank">입력 전</span>
}

/**
 * 계약서 창 — 상세 화면의 "계약서 보기"나 동의 줄로 연다. 계약 동의는 이 창 아래의 동의란에서만 체크한다(onAgreeChange —
 * 상세 화면에서는 체크할 수 없다). "확인"·닫기(X)·Esc·바깥 누르기는 체크 상태를 그대로 두고 닫는다(onClose).
 */
export function RentalContractModal({
  applicant,
  agreed,
  onAgreeChange,
  onClose,
}: {
  applicant: ContractApplicant
  agreed: boolean
  onAgreeChange: (agreed: boolean) => void
  onClose: () => void
}) {
  return (
    <FormSheet
      title="물품 대여 계약서"
      onClose={onClose}
      footer={
        <div className="rental-form__contract-foot">
          <label className={agreed ? 'rental-form__agree is-on' : 'rental-form__agree'}>
            <input type="checkbox" checked={agreed} onChange={(e) => onAgreeChange(e.target.checked)} />
            <span className="rental-form__agree-box" aria-hidden>
              {agreed && <Check size={16} strokeWidth={3} />}
            </span>
            위 계약 내용을 모두 확인하였으며, 이에 동의합니다.
          </label>
          <button type="button" className="tech-form__button tech-form__button--block" onClick={onClose}>
            확인
          </button>
        </div>
      }
    >
      <div className="tech-form__policy">
        <p>본 계약은 아래 당사자 간에 체결됩니다.</p>
        <dl className="rental-form__contract-box">
          <div>
            <dt>갑(임대자)</dt>
            <dd>㈜시안인터내셔널</dd>
          </div>
          <div>
            <dt>을(임차자)</dt>
            <dd>고객님 (신청자 정보 참고)</dd>
          </div>
        </dl>

        <h4>신청자 정보</h4>
        <dl className="rental-form__contract-box">
          <div>
            <dt>성함</dt>
            <dd>
              <Blank value={applicant.name} />
            </dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>
              <Blank value={applicant.phone} />
            </dd>
          </div>
          <div>
            <dt>배송받으실 주소</dt>
            <dd>
              <Blank value={applicant.address} />
            </dd>
          </div>
        </dl>

        <h3>제1조 (목적)</h3>
        <p>
          본 계약은 갑이 을에게 물품을 대여하고, 을이 이를 대여받아 대금을 지급함에 있어 필요한 사항을 규정함을 목적으로
          합니다.
        </p>

        <h3>제2조 (대여 물품 및 금액)</h3>
        <dl className="rental-form__contract-box">
          <div>
            <dt>대여 물품</dt>
            <dd>
              <Blank value={applicant.products} />
            </dd>
          </div>
          <div>
            <dt>대여 기간</dt>
            <dd>
              <Blank value={applicant.period} />
            </dd>
          </div>
          <div>
            <dt>보증금</dt>
            <dd>
              <Blank value={applicant.deposit} />
            </dd>
          </div>
          <div>
            <dt>대여료</dt>
            <dd>
              <Blank value={applicant.fee} />
            </dd>
          </div>
          <div>
            <dt>총 결제 금액</dt>
            <dd>
              <Blank value={applicant.total} />
            </dd>
          </div>
        </dl>
        <h4>대여료·보증금 기준</h4>
        <ul>
          <li>대여료는 기기마다 1일당 10,000원입니다.</li>
          <li>대여 기간이 10영업일 미만이면 보증금은 없습니다.</li>
          <li>대여 기간이 10영업일 이상이면 보증금 200,000원이 별도로 있습니다(기기마다).</li>
          <li>보증금은 제품 수거 및 상태 확인 후 반환합니다.</li>
        </ul>

        <h3>제3조 (대금 지급 조건)</h3>
        <ul>
          <li>을은 계약 체결 후 보증금과 대여료를 지급합니다.</li>
          <li>보증금은 갑이 대여품을 회수하여 검수를 완료한 후 환급합니다.</li>
        </ul>

        <h3>제4조 (제품 인도 및 반환)</h3>
        <ul>
          <li>갑은 을에게 제품을 정상적인 상태로 발송합니다. 인도일 및 방법은 상호 협의에 따릅니다.</li>
          <li>을은 제품을 인수한 후 계약 목적에 맞게 사용해야 합니다.</li>
          <li>을은 대여 기간 종료 시 제품을 정상적인 상태로 반환해야 합니다.</li>
        </ul>

        <h3>제5조 (파손 시 조치)</h3>
        <ul>
          <li>
            을의 고의 또는 과실로 대여 물품 및 부속품이 파손·훼손되거나 분실된 경우, 을은 그 손해를 배상할 책임이
            있습니다.
          </li>
          <li>이 경우 을은 수리 또는 원상복구에 필요한 합리적인 비용을 부담합니다.</li>
          <li>수리 또는 원상복구가 불가능한 경우, 을은 해당 손해액을 배상해야 합니다.</li>
        </ul>

        <h3>제6조 (기타)</h3>
        <ul>
          <li>본 계약에 명시되지 않은 사항은 상호 협의 또는 관련 법령에 따릅니다.</li>
          <li>본 계약은 을이 아래 동의란에 체크하고 제출한 날부터 효력이 발생합니다.</li>
        </ul>
      </div>
    </FormSheet>
  )
}
