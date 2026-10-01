import { useState } from 'react'
import {
  Bell,
  Bluetooth,
  Check,
  CheckCircle2,
  Link2,
  LockKeyhole,
  PhoneCall,
  QrCode,
  ArrowUpRight,
  Users,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export function CoRideChoice() {
  const [selected, setSelected] = useState<string | null>(null)
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
      <Tabs
        defaultValue="priority"
        className="pd-choice-demo"
        onValueChange={() => setSelected(null)}
      >
        <TabsList
          aria-label="동승 시 연락 대상 선택 방식"
          className="pd-choice-tabs"
        >
          <TabsTrigger value="priority">우선 사용자 지정</TabsTrigger>
          <TabsTrigger value="ask">지정하지 않은 경우</TabsTrigger>
        </TabsList>
        <div className="pd-together">
          <Users size={22} />
          <span>남편과 아내, 함께 탑승한 상황</span>
        </div>
        <TabsContent value="priority" className="pd-choice-panel">
          <div className="pd-priority-rule">
            <span>미리 지정한 우선 사용자</span>
            <strong>
              아내 <CheckCircle2 size={27} />
            </strong>
          </div>
          <div className="pd-choice-result">
            <CheckCircle2 />
            <div>
              <span>둘 다 인식되면</span>
              <strong>아내가 주차 연락을 받습니다.</strong>
            </div>
          </div>
          <p className="pd-ui-caption">
            이 예시에서는 아내를 우선 사용자로 지정했습니다.
          </p>
        </TabsContent>
        <TabsContent value="ask" className="pd-choice-panel">
          <div className="pd-push-example">
            <header>
              <span>
                <Bell size={19} />
                Parké
              </span>
              <span>푸시 알림 예시</span>
            </header>
            <h3>이번에는 누가 사용하나요?</h3>
            <p>
              두 명의 등록 사용자가 인식됐어요.
              <br />
              주차 연락을 받을 사람을 선택해 주세요.
            </p>
            <div className="pd-push-actions">
              {['남편', '아내'].map((person) => (
                <button
                  key={person}
                  aria-pressed={selected === person}
                  onClick={() => setSelected(person)}
                >
                  {person}
                  {selected === person && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
          <output className="pd-choice-result">
            <CheckCircle2 />
            <div>
              <span>
                {selected
                  ? '선택한 연락 대상'
                  : '아래 결과를 직접 확인해 보세요'}
              </span>
              <strong>
                {selected
                  ? `${selected}에게 주차 연락이 이어집니다.`
                  : '위 알림에서 사용자를 눌러보세요.'}
              </strong>
            </div>
          </output>
          <p className="pd-ui-caption">선택 과정을 설명하는 예시 화면입니다.</p>
        </TabsContent>
      </Tabs>
    </section>
  )
}

export function CallerFlow() {
  const [step, setStep] = useState(0)
  const labels = ['차 앞에서 QR 촬영', '웹페이지 열기', '안심번호로 전화']
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
          안심번호를 통해 현재 연락 대상에게 연결됩니다.
        </p>
      </div>
      <div className="pd-caller-demo">
        <div className="pd-caller-tabs" aria-label="QR 연락 과정">
          {labels.map((label, index) => (
            <button
              key={label}
              onClick={() => setStep(index)}
              aria-pressed={step === index}
            >
              <span>0{index + 1}</span>
              {label}
            </button>
          ))}
        </div>
        <div className={`pd-caller-stage caller-step-${step}`}>
          {step === 0 ? (
            <div className="pd-camera-demo">
              <span>연락 과정 예시</span>
              <div className="pd-camera-reticle">
                <QrCode size={116} strokeWidth={1.2} />
                <i />
              </div>
              <h3>차 앞의 QR을 찍습니다.</h3>
              <p>연락하는 분은 파르케 앱이 없어도 됩니다.</p>
              <button className="pd-demo-action" onClick={() => setStep(1)}>
                웹페이지 열어보기
              </button>
            </div>
          ) : (
            <div className="pd-web-demo">
              <div className="pd-browser-bar">
                <LockKeyhole size={16} />
                <span>QR로 열리는 웹페이지 · 예시</span>
              </div>
              <div className="pd-web-content">
                <b className="pd-web-brand">Parké</b>
                <p>주차된 차량에 연락하기</p>
                <h3>
                  차량 이동이
                  <br />
                  필요하신가요?
                </h3>
                <div className="pd-safe-number">
                  <LockKeyhole />
                  <span>
                    개인번호 대신
                    <br />
                    <strong>안심번호로 연결</strong>
                  </span>
                </div>
                <button
                  className="pd-demo-action"
                  onClick={() => setStep(step === 2 ? 1 : 2)}
                >
                  <PhoneCall size={20} />
                  {step === 2 ? '웹페이지로 돌아가기' : '전화 버튼 눌러보기'}
                </button>
                {step === 2 && (
                  <output className="pd-call-result">
                    <CheckCircle2 size={24} />
                    <strong>
                      안심번호를 거쳐
                      <br />
                      현재 연락 대상에게.
                    </strong>
                    <span>실제 전화를 걸지 않는 체험 화면입니다.</span>
                  </output>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="pd-caller-summary">
          <QrCode size={21} />
          <span>
            같은 QR. <strong>연결되는 사람만 바뀝니다.</strong>
          </span>
        </p>
      </div>
    </section>
  )
}

export function FirstSetup() {
  return (
    <section className="pd-register pd-first-setup">
      <div className="pd-copy">
        <p className="pd-kicker">준비는 처음 한 번</p>
        <h2>
          설치하고, 연결하고.
          <br />
          가족을 초대하세요.
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
      <ol className="pd-onboarding">
        <li>
          <div className="pd-setup-heading">
            <span>01</span>
            <div>
              <h3>파르케 앱 설치</h3>
              <p>
                패키지에 동봉된 안내 경로를 따라
                <br />
                App Store에서 ‘Parke’를 설치하세요.
              </p>
            </div>
          </div>
          <div className="pd-install-visual">
            <img
              src="/images/brand/package.webp"
              alt="파르케 제품 패키지 디자인 시안"
              width={1672}
              height={941}
              loading="lazy"
            />
            <a
              className="pd-store-search pd-app-store-link"
              href="https://apps.apple.com/kr/app/parke/id6761168230?uo=4"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="App Store에서 ORIGINALS의 Parke 앱 다운로드"
            >
              <span className="pd-app-store-name">
                <strong>Parke 다운로드</strong>
                <small>App Store · ORIGINALS Co., Ltd</small>
              </span>
              <ArrowUpRight size={25} />
            </a>
          </div>
        </li>
        <li>
          <div className="pd-setup-heading">
            <span>02</span>
            <div>
              <h3>회원가입</h3>
              <p>
                파르케 앱에서 계정을 만드세요.
                <br />
                우리 차와 사용자를 연결할 준비입니다.
              </p>
            </div>
          </div>
          <div className="pd-signup-visual">
            <b>Parké</b>
            <div>
              <CheckCircle2 />
              <span>내 계정 준비 완료</span>
            </div>
            <span className="pd-ui-caption">가입 흐름을 설명하는 예시</span>
          </div>
        </li>
        <li>
          <div className="pd-setup-heading">
            <span>03</span>
            <div>
              <h3>우리 차의 기기 연결</h3>
              <p>
                파르케 기기 가까이에서 연결을 시작하세요.
                <br />
                레이더 화면이 주변의 기기를 찾습니다.
              </p>
            </div>
          </div>
          <figure className="pd-real-app">
            <img
              src="/images/parke-scan.png"
              alt="실제 파르케 앱의 기기 검색 화면. 원형 레이더와 ‘주변의 Parké 장치를 찾고 있습니다’ 안내"
              width={1320}
              height={2868}
              loading="lazy"
            />
            <figcaption>
              <Bluetooth size={19} />
              실제 파르케 앱 · 기기 찾기 화면
            </figcaption>
          </figure>
        </li>
        <li>
          <div className="pd-setup-heading">
            <span>04</span>
            <div>
              <h3>가족 초대 링크 보내기</h3>
              <p>
                함께 운전하는 가족에게 초대 링크를 보내세요.
                <br />
                가족도 등록하면, 같은 기기를 함께 사용합니다.
              </p>
            </div>
          </div>
          <div className="pd-invite-visual">
            <Link2 size={29} />
            <div>
              <b>우리 차의 파르케에 초대합니다.</b>
              <p>함께 운전할 가족에게 초대 링크 발송</p>
            </div>
          </div>
        </li>
      </ol>
      <div className="pd-ready-proof">
        <CheckCircle2 size={30} />
        <h3>
          앱 등록 완료.
          <br />
          시제품 사용 검증 완료.
        </h3>
        <p>
          등록과 연결에서 자동 전환까지,
          <br />
          시제품으로 사용 흐름을 확인했습니다.
        </p>
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
