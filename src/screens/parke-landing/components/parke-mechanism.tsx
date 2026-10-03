import { PhoneCall, QrCode, ScanLine } from 'lucide-react'
import { CallerFlow, CoRideChoice, FirstSetup } from './parke-use-flows'
import { MechanismSlides } from './parke-visual-story'

export const ParkeMechanism = ({ still }: { still: boolean }) => {
  return (
    <section id="how" className={`pd-mechanism ${still ? 'is-still' : ''}`}>
      <section className="pd-one-qr">
        <div className="pd-copy">
          <p className="pd-kicker">번호판은 하나 · 연락 대상은 자동으로</p>
          <h2>
            QR은 그대로인데.
            <br />
            <em>어떻게 사람이 바뀔까요?</em>
          </h2>
          <p className="pd-body">
            비결은 <strong>등록 사용자 자동 인식.</strong>
            <br />
            기기가 휴대폰을 알아보고,
            <br />
            앱을 통해 연락 대상 정보를 바꾸는 방식입니다.
          </p>
        </div>
        <div className="pd-qr-showcase">
          <img
            src="/images/brand/product-studio.webp"
            alt="QR이 고정되어 있는 Parké 제품"
            width={1672}
            height={941}
            loading="lazy"
          />
          <div className="pd-qr-scan">
            <ScanLine />
            <i />
          </div>
          <div className="pd-qr-fixed">
            <QrCode size={24} />
            <span>인쇄된 QR은 바뀌지 않습니다</span>
          </div>
        </div>
        <div className="pv-qr-detail">
          <div className="pv-qr-magnify">
            <img
              src="/images/brand/product-studio.webp"
              alt="본체에 인쇄된 동일한 QR을 확대한 모습"
              width={1672}
              height={941}
              loading="lazy"
            />
            <div className="pv-qr-brackets">
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="pv-qr-beam" />
          </div>
          <div>
            <span className="pv-qr-caption">고정된 QR 확대</span>
            <h3>
              QR은 그대로.
              <br />
              연락 대상만 바뀝니다.
            </h3>
            <p>
              매번 새로 인쇄하거나
              <br />
              바꿔 붙일 필요 없이.
            </p>
          </div>
        </div>
      </section>
      <section className="pd-recognition">
        <div className="pd-copy">
          <p className="pd-kicker">진짜 편리함은, 여기부터</p>
          <h2>
            앱을 열지 않아도.
            <br />
            <em>연락 대상은 알아서.</em>
          </h2>
          <p className="pd-body">
            처음에 휴대폰을 등록하고 권한을 설정해 두면,
            <br />
            차에 탄 등록 사용자를 기기가 인식합니다.
            <br />
            <strong>앱을 직접 열지 않아도 연락 대상이 바뀝니다.</strong>
          </p>
        </div>
        <MechanismSlides still={still} />
      </section>
      <CoRideChoice />
      <CallerFlow />
      <FirstSetup />
      <section className="pd-parked">
        <div className="pd-copy">
          <p className="pd-kicker">주차하고, 차에서 내려도</p>
          <h2>
            마지막 운전자가
            <br />
            계속 연락받습니다.
          </h2>
          <p className="pd-body">
            차와 멀어졌다는 이유만으로
            <br />
            연락 대상이 지워지는 방식이 아닙니다.
            <br />
            <strong>다음 등록 사용자가 인식될 때까지 유지됩니다.</strong>
          </p>
        </div>
        <div className="pd-scene">
          <img
            src="/images/comparison/03-parked-parke.webp"
            alt="주차 후 차에서 떨어진 운전자에게 연락이 이어지는 사용 예시"
            width={1024}
            height={1024}
            loading="lazy"
          />
          <div className="pd-call-bubble is-right">
            <PhoneCall />
            <div>
              <span>주차 후에도</span>
              <strong>마지막 연락 대상 유지</strong>
            </div>
          </div>
        </div>
      </section>
      <p className="pd-example-note">
        기기 찾기 이미지는 실제 앱 화면입니다. 자동 전환·푸시·QR 연락 화면과
        연결 효과는 사용 과정을 설명하기 위한 예시입니다.
      </p>
    </section>
  )
}
