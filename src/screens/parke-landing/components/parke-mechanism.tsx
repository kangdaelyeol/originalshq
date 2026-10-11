import { ArrowRight, Bluetooth, Check, PhoneCall, QrCode } from 'lucide-react'
import { CallerFlow, CoRideChoice, FirstSetup } from './parke-use-flows'

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
        </div>
        <p className="pd-qr-fixed">
          <QrCode aria-hidden="true" />
          인쇄된 QR은 바뀌지 않습니다
        </p>
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
        {/* One picture, then the three steps side by side. This used to be an
            auto-advancing carousel: one step on screen at a time, two of the
            three slides showing the same photo, and three sets of controls
            (arrows, a counter, tabs) to move between them. Laid out together
            the whole mechanism reads in one pass. */}
        <figure className="pd-steps-visual">
          <img
            src="/images/story-v26/device-phone-studio.webp"
            alt="파르케 본체와 등록된 휴대폰을 나란히 둔 렌더"
            width={1536}
            height={1024}
            loading="lazy"
          />
        </figure>
        <ol className="pd-steps">
          <li>
            <span className="pd-step-number">01</span>
            <h3>기기가 휴대폰을 알아봅니다</h3>
            <p>
              파르케의 블루투스 인식부가
              <br />
              미리 등록한 휴대폰을 찾습니다.
            </p>
            <p className="pd-step-result">
              <Bluetooth aria-hidden="true" />
              등록된 남편을 찾았습니다.
            </p>
          </li>
          <li>
            <span className="pd-step-number">02</span>
            <h3>앱을 열지 않아도, 자동 전환</h3>
            <p>
              인식된 사용자 정보가 반영되면,
              <br />
              같은 QR의 연락 대상이 바뀝니다.
            </p>
            <p className="pd-step-result">
              <s>어제 · 아내</s>
              <ArrowRight aria-hidden="true" />
              오늘 · 남편
              <Check aria-hidden="true" />
            </p>
          </li>
          <li>
            <span className="pd-step-number">03</span>
            <h3>주차 연락은, 오늘 사용자에게</h3>
            <p>
              QR로 열린 웹페이지에서 전화 버튼을 누르면,
              <br />
              현재 사용자에게 전화가 연결됩니다.
            </p>
            <p className="pd-step-result">
              <QrCode aria-hidden="true" />
              QR 그대로 · 오늘 사용자에게 연결
            </p>
          </li>
        </ol>
        <p className="pd-steps-note">
          휴대폰은 등록할 때만 앱에서 설정해 두세요.
          <br />
          이후 자동 전환을 위해 매번 앱을 열 필요가 없습니다.
        </p>
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
        </div>
        {/* What the photo shows, said once beside it rather than on a card
            floating over it. */}
        <p className="pd-parked-status">
          <PhoneCall aria-hidden="true" />
          <span>주차 후에도</span>
          <strong>마지막 연락 대상 유지</strong>
        </p>
      </section>
      <p className="pd-example-note">
        기기 찾기 이미지는 실제 앱 화면입니다. 자동 전환·푸시·QR 연락 화면과
        연결 효과는 사용 과정을 설명하기 위한 예시입니다.
      </p>
    </section>
  )
}
