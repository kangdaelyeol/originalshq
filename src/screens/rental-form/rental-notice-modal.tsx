import { FormSheet } from '@/screens/tech-form/policy-modal'

// 제품 대여 안내 — 예전 구글 폼 "제품 대여 동의서"의 안내 글을 그대로 옮겼다(바뀌면 그대로 고친다). 기본 구성품은
// 시리즈마다 옅은 상자에 묶었다. "특이 사항" 칸을 없애(2026-11-13) 부품 요청은 "사용 목적 및 작업 내용" 칸으로 안내한다.

/** 시리즈별 기본 구성품 — 따로 필요한 부품은 "사용 목적 및 작업 내용"에 적는다 */
const RENTAL_PARTS: readonly { series: string; parts: string }[] = [
  { series: 'F 시리즈', parts: '본품, 어댑터, 전원선, USB 케이블, USB 키, 슬레이트 패널, 배기 호스' },
  { series: 'P 시리즈', parts: '본품, 전원선, USB 케이블, USB 키, 배기 호스' },
  { series: 'M 시리즈', parts: '본품, 어댑터, 전원선, USB 케이블, 배기 호스' },
]

/**
 * 대여 안내 창 — 시작 화면에서 "대여 신청하기"를 누르면 띄운다. "확인했습니다"를 누르면 다음 화면(성함·연락처)으로
 * 간다(onConfirm). 닫기(X)·Esc·바깥 누르기는 시작 화면에 그대로 남는다(onClose).
 */
export function RentalNoticeModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <FormSheet
      title="제품 대여 안내"
      onClose={onClose}
      fit
      footer={
        <button type="button" className="tech-form__button tech-form__button--block" onClick={onConfirm}>
          확인했습니다
        </button>
      }
    >
      <p className="rental-form__lead">엑스툴코리아에서 제공하는 대여 서비스에 대한 안내입니다.</p>
      <ol className="tech-form__notice">
        <li>
          대여 제품은 엑스툴코리아의 자산으로 소중히 사용해주시기 바랍니다. 대여 중 파손 등의 손상이 발생할 시 책임은
          전적으로 고객님께 있습니다.
        </li>
        <li>
          대여 제품은 엑스툴코리아에서 보관하고 있는 전시품, 리퍼품입니다. 대여 전에 엔지니어가 상태를 점검하고 발송하게
          됩니다. 대여 중 문제가 발생하면 연락바랍니다.
        </li>
        <li>
          기존 구성품 안내드립니다. 별도로 필요한 부품이 있을 시 "사용 목적 및 작업 내용" 란에 작성 부탁드립니다.
          <dl className="rental-form__parts">
            {RENTAL_PARTS.map((item) => (
              <div key={item.series}>
                <dt>{item.series}</dt>
                <dd>{item.parts}</dd>
              </div>
            ))}
          </dl>
        </li>
        <li>구성품의 파손 또는 분실 시 해당 부품에 대한 비용이 별도로 청구될 수 있습니다.</li>
      </ol>
    </FormSheet>
  )
}
