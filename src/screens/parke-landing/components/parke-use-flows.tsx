import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bluetooth,
  CheckCircle2,
  LockKeyhole,
  PhoneCall,
  QrCode,
  Users,
} from 'lucide-react'

/**
 * "Both of them are in the car." Two cases, shown together: a priority user
 * was set in advance, or it was not and the app asks.
 *
 * These used to be two tabs, with the second holding a mock notification you
 * had to press to see a one-line result. Side by side the answer to the
 * section's own heading ("to whoever you chose — or, if you did not choose,
 * it asks") is simply visible.
 */
export const CoRideChoice = () => {
  return (
    <section className="pd-coride">
      <div className="pd-copy">
        <p className="pd-kicker">둘 다 차에 탔다면?</p>
        <h2>
          미리 정한 사람에게.
          <br />
          <em>정하지 않았다면, 물어봐요.</em>
        </h2>
        <p className="pd-body">
          등록된 가족이 함께 탈 때는
          <br />
          <strong>우선 사용자를 미리 지정할 수 있습니다.</strong>
          <br />
          지정하지 않았다면 앱 푸시로 선택을 요청합니다.
        </p>
      </div>

      <p className="pd-coride-situation">
        <Users aria-hidden="true" />
        남편과 아내, 함께 탑승한 상황
      </p>

      <div className="pd-cases">
        <article className="pd-case">
          <h3>우선 사용자를 지정했다면</h3>
          <div className="pd-case-body">
            <p className="pd-priority">
              <span>미리 지정한 우선 사용자</span>
              <strong>
                아내 <CheckCircle2 aria-hidden="true" />
              </strong>
            </p>
          </div>
          <p className="pd-case-result">
            <span>둘 다 인식되면</span>
            아내가 주차 연락을 받습니다.
          </p>
        </article>

        <article className="pd-case">
          <h3>지정하지 않았다면</h3>
          <div className="pd-case-body">
            {/* A picture of the notification, not a working one. */}
            <div className="pd-push" aria-label="푸시 알림 예시">
              <p className="pd-push-app">
                <Bell aria-hidden="true" />
                Parké
              </p>
              <p className="pd-push-title">이번에는 누가 사용하나요?</p>
              <p className="pd-push-text">
                두 명의 등록 사용자가 인식됐어요.
                <br />
                주차 연락을 받을 사람을 선택해 주세요.
              </p>
              <p className="pd-push-options">
                <span>남편</span>
                <span>아내</span>
              </p>
            </div>
          </div>
          <p className="pd-case-result">
            <span>앱 푸시로 물어보고</span>
            선택한 사람이 주차 연락을 받습니다.
          </p>
        </article>
      </div>
    </section>
  )
}

/**
 * The other side of the call: someone who needs the car moved. Three screens
 * in the order they happen — camera, web page, call.
 *
 * This was a three-step clickable demo on a single phone frame. Each press
 * swapped the frame for the next screen, so the "no app, scan and call" claim
 * took three interactions to see through; now the whole path is on the page.
 */
export function CallerFlow() {
  return (
    <section className="pd-caller">
      <div className="pd-copy">
        <p className="pd-kicker">차를 옮겨 달라고 연락하는 분은?</p>
        <h2>
          앱 설치 없이.
          <br />
          <em>QR 찍고, 전화하면 끝.</em>
        </h2>
        <p className="pd-body">
          휴대폰 카메라로 차 앞의 QR을 찍으세요.
          <br />
          열린 웹페이지에서 <strong>전화 버튼을 누르면,</strong>
          <br />
          현재 연락 대상에게 전화가 연결됩니다.
        </p>
      </div>

      <ol className="pd-caller-steps">
        <li>
          <div className="pd-screen is-camera" aria-hidden="true">
            <div className="pd-screen-reticle">
              <QrCode strokeWidth={1.2} />
            </div>
          </div>
          <span className="pd-step-number">01</span>
          <h3>차 앞의 QR을 찍습니다</h3>
          <p>연락하는 분은 파르케 앱이 없어도 됩니다.</p>
        </li>

        <li className="pd-caller-arrow" aria-hidden="true">
          <ArrowRight />
        </li>

        <li>
          <div className="pd-screen is-web" aria-hidden="true">
            <p className="pd-screen-bar">
              <LockKeyhole />
              QR로 열리는 웹페이지
            </p>
            <p className="pd-screen-brand">Parké</p>
            <p className="pd-screen-title">
              차량 이동이
              <br />
              필요하신가요?
            </p>
            <p className="pd-screen-button">
              <PhoneCall />
              전화하기
            </p>
          </div>
          <span className="pd-step-number">02</span>
          <h3>웹페이지가 열립니다</h3>
          <p>전화 버튼 하나만 있는 페이지입니다.</p>
        </li>

        <li className="pd-caller-arrow" aria-hidden="true">
          <ArrowRight />
        </li>

        <li>
          <div className="pd-screen is-call" aria-hidden="true">
            <i>
              <PhoneCall />
            </i>
            <p className="pd-screen-title">연결 중</p>
            <p className="pd-screen-note">오늘 차를 가져간 사람에게</p>
          </div>
          <span className="pd-step-number">03</span>
          <h3>전화가 연결됩니다</h3>
          <p>지금 차를 가져간 사람에게 연결됩니다.</p>
        </li>
      </ol>

      <p className="pd-caller-summary">
        <QrCode size={21} />
        <span>
          같은 QR. <strong>연결되는 사람만 바뀝니다.</strong>
        </span>
      </p>
    </section>
  )
}

/**
 * The one time the app is needed: install, sign up, connect the device.
 *
 * This ran as four tall blocks stacked down the page, each with its own
 * picture. The steps are short, so they now sit together as one list beside
 * the only picture that is a real one — the app's own device-search screen.
 * The fourth block (inviting family by link) is gone: that feature does not
 * exist.
 */
export function FirstSetup() {
  return (
    <section className="pd-register pd-first-setup">
      <div className="pd-copy">
        <p className="pd-kicker">준비는 처음 한 번</p>
        <h2>
          설치하고, 가입하고.
          <br />
          기기를 연결하세요.
        </h2>
        <p className="pd-body">
          처음 기기를 등록할 때는 앱이 필요합니다.
          <br />
          설정을 마치면,{' '}
          <strong>
            이후에는 앱을 열지 않아도
            <br />
            등록 사용자에 맞춰 자동 전환됩니다.
          </strong>
        </p>
      </div>

      <div className="pd-setup">
        <figure className="pd-setup-phone">
          <img
            src="/images/parke-scan.png"
            alt="실제 파르케 앱의 기기 검색 화면. 원형 레이더와 ‘주변의 Parké 장치를 찾고 있습니다’ 안내"
            width={1320}
            height={2868}
            loading="lazy"
          />
          <figcaption>
            <Bluetooth aria-hidden="true" />
            실제 파르케 앱 · 기기 찾기 화면
          </figcaption>
        </figure>

        <ol className="pd-setup-steps">
          <li>
            <span className="pd-step-number">01</span>
            <h3>파르케 앱 설치</h3>
            <p>
              패키지에 동봉된 안내 경로를 따라
              <br />
              App Store에서 ‘Parke’를 설치하세요.
            </p>
            <a
              className="pd-store-link"
              href="https://apps.apple.com/kr/app/parke/id6761168230?uo=4"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="App Store에서 ORIGINALS의 Parke 앱 다운로드"
            >
              <span>
                <strong>Parke 다운로드</strong>
                <small>App Store · ORIGINALS Co., Ltd</small>
              </span>
              <ArrowUpRight aria-hidden="true" />
            </a>
          </li>
          <li>
            <span className="pd-step-number">02</span>
            <h3>회원가입</h3>
            <p>
              파르케 앱에서 계정을 만드세요.
              <br />
              우리 차와 사용자를 연결할 준비입니다.
            </p>
          </li>
          <li>
            <span className="pd-step-number">03</span>
            <h3>우리 차의 기기 연결</h3>
            <p>
              파르케 기기 가까이에서 연결을 시작하세요.
              <br />
              레이더 화면이 주변의 기기를 찾습니다.
            </p>
          </li>
        </ol>
      </div>

      <div className="pd-copy pd-after">
        <p className="pd-setup-permissions">
          자동 인식을 위해 블루투스 등 앱의 필수 권한 설정이 필요합니다.
          <br />
          지원 휴대폰과 자세한 설정 방법은 출시 안내에서 확인할 수 있습니다.
        </p>
      </div>
    </section>
  )
}
