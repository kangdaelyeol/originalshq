import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Battery,
  Lock,
  Pause,
  Play,
  Plus,
  ShieldCheck,
  Thermometer,
} from 'lucide-react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './components/ui/accordion'
import ContactSituation from './components/contact-situation'
import Reservation from './components/reservation'
import Original360Hero from './components/original-360-hero'
import ParkeMechanism from './components/parke-mechanism'
import ParkeOffer from './components/parke-offer'
import ParkeEngraving from './components/parke-engraving'

function Craft() {
  const [part, setPart] = useState(0)
  const parts = [
    [
      '블루투스 인식 모듈',
      '등록된 휴대폰이 가까이 오면, 다음 연락 대상을 알아봅니다.',
    ],
    ['제어보드', '인식 정보를 앱의 연락 전환 흐름으로 이어줍니다.'],
    ['전원부', '1등급 건전지 배터리 하나로 최대 1년 이상 사용합니다.'],
  ]
  return (
    <>
      <section className="pf-endurance" id="details">
        <div className="pf-section-intro">
          <p className="pf-eyebrow">DESIGNED FOR THE DASHBOARD</p>
          <h2>
            차 안의 열도.
            <br />
            오래 쓰는 일도.
          </h2>
          <p>
            매일 차에 두는 제품이기에,
            <br />
            사용 환경부터 꼼꼼하게.
          </p>
        </div>
        <div className="pf-endurance-grid">
          <article>
            <Thermometer />
            <span>HEAT RESISTANCE</span>
            <strong className="pf-spec-number">
              100°C<span>+</span>
            </strong>
            <h3>
              차량 내장재용
              <br />
              ABS+ 소재.
            </h3>
            <p>
              100°C 이상에서도 사용 가능한
              <br />
              자동차 내장재용 ABS+를 사용합니다.
            </p>
          </article>
          <article>
            <Battery />
            <span>LONG LASTING</span>
            <strong className="pf-spec-number">
              1<span>년 이상</span>
            </strong>
            <h3>
              배터리 하나로.
              <br />
              최대 1년 이상.
            </h3>
            <p>
              1등급 건전지 배터리 사용.
              <br />
              배터리 1개로 오래 이어지는 편리함.
            </p>
            <small className="pf-spec-note">
              사용 환경에 따라 사용 기간은 달라질 수 있습니다.
            </small>
          </article>
        </div>
      </section>
      <section className="pf-finish pf-photo-panel">
        <img
          src="/images/brand/product-studio.webp"
          alt="제품 모서리와 무광 표면의 마감 렌더"
          width={1672}
          height={941}
          loading="lazy"
        />
        <div className="pf-photo-copy">
          <p className="pf-eyebrow">EVERY EDGE, CONSIDERED</p>
          <h2>
            매일 마주할 물건.
            <br />
            끝선까지, 정교하게.
          </h2>
        </div>
      </section>
      <section className="pf-sensors">
        <div className="pf-section-intro">
          <p className="pf-eyebrow">INTELLIGENCE INSIDE</p>
          <h2>
            작지만,
            <br />할 일은 분명하게.
          </h2>
        </div>
        <div className="pf-sensor-visual">
          <img
            src="/images/brand/internal.webp"
            width={1920}
            height={1080}
            alt="사용자 인식 모듈, 제어보드, 전원부가 들어가는 내부 배치 시안"
            loading="lazy"
          />
          <button
            className={`pf-hotspot hs-0 ${part === 0 ? 'active' : ''}`}
            aria-label="블루투스 인식 모듈 보기"
            onClick={() => setPart(0)}
          >
            <Plus />
          </button>
          <button
            className={`pf-hotspot hs-1 ${part === 1 ? 'active' : ''}`}
            aria-label="제어보드 보기"
            onClick={() => setPart(1)}
          >
            <Plus />
          </button>
          <button
            className={`pf-hotspot hs-2 ${part === 2 ? 'active' : ''}`}
            aria-label="전원부 보기"
            onClick={() => setPart(2)}
          >
            <Plus />
          </button>
        </div>
        <div className="pf-sensor-answer" aria-live="polite">
          <span>0{part + 1}</span>
          <div>
            <h3>{parts[part][0]}</h3>
            <p>{parts[part][1]}</p>
          </div>
        </div>
        <small className="pf-footnote">내부 구성 이미지</small>
      </section>
    </>
  )
}
function Benefits() {
  return (
    <section className="pf-benefits">
      <article>
        <ShieldCheck />
        <p className="pf-eyebrow">PRIVATE BY DESIGN</p>
        <h2>
          내 번호는 숨기고.
          <br />
          연락은 이어지게.
        </h2>
        <span className="pf-benefit-value">안심번호</span>
        <p>
          실제 휴대폰 번호를 번호판에 노출하지 않는
          <br />
          안심번호 기반 주차 연락.
        </p>
      </article>
      <article>
        <Lock />
        <p className="pf-eyebrow">NO SERVER FEE</p>
        <h2>
          매달 더해지는
          <br />
          서버 비용 없이.
        </h2>
        <span className="pf-benefit-value">
          0<span>원</span>
        </span>
        <p>
          서버 이용료 무료.
          <br />
          제품의 기본 연락 서비스를 가볍게.
        </p>
      </article>
    </section>
  )
}
function Finishing() {
  return (
    <>
      <section id="package" className="pf-package pf-photo-panel">
        <img
          src="/images/brand/package.webp"
          alt="파르케 본체를 담은 프리미엄 패키지 디자인 시안"
          width={1672}
          height={941}
          loading="lazy"
        />
        <div className="pf-photo-copy">
          <p className="pf-eyebrow">THE FIRST IMPRESSION</p>
          <h2>
            열어보는 순간부터.
            <br />
            파르케답게.
          </h2>
          <p>
            제품을 위한 패키지.
            <br />
            소중한 사람의 차를 위한 선물.
          </p>
        </div>
      </section>
      <ParkeEngraving />
    </>
  )
}
function Gallery() {
  const shots = [
    [
      '/images/premium-v27/gallery-signature.webp',
      '01 / SIGNATURE',
      '빛을 따라 드러나는 조형.',
    ],
    [
      '/images/premium-v27/gallery-detail.webp',
      '02 / DETAIL',
      '가까이 볼수록, 정교하게.',
    ],
    [
      '/images/premium-v27/gallery-dashboard.webp',
      '03 / IN YOUR CAR',
      '당신의 차에, 자연스럽게.',
    ],
  ]
  return (
    <section className="pf-gallery">
      <div className="pf-section-intro">
        <p className="pf-eyebrow">THE NEXT PARKING PLATE</p>
        <h2>
          차세대 주차번호판.
          <br />
          이름은, 파르케.
        </h2>
      </div>
      <div className="pf-gallery-grid">
        {shots.map(([src, tag, title]) => (
          <figure key={tag}>
            <img
              src={src}
              alt={title}
              width={1672}
              height={941}
              loading="lazy"
            />
            <figcaption>
              <small>{tag}</small>
              <span>{title}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
const faqs = [
  [
    '매번 운전할 때 앱을 켜야 하나요?',
    '아니요. 처음에 앱에서 기기와 사용자를 등록하고 필요한 권한을 설정하면, 이후에는 앱을 열지 않아도 등록 사용자를 인식해 주차 연락 대상이 자동으로 바뀝니다.',
  ],
  [
    '등록된 가족이 함께 타면 누구에게 연락이 가나요?',
    '함께 탔을 때의 우선 사용자를 미리 지정할 수 있습니다. 우선 사용자가 지정되어 있지 않으면 앱 푸시 알림으로 연락받을 사람의 선택을 요청합니다.',
  ],
  [
    'QR로 연락하는 사람도 앱을 설치해야 하나요?',
    '아니요. 휴대폰 카메라로 QR을 찍으면 웹페이지가 열립니다. 그 페이지의 전화 버튼을 누르면 안심번호를 통해 현재 연락 대상으로 연결됩니다.',
  ],
  [
    '차에서 내려도 연락받을 수 있나요?',
    '마지막으로 인식된 사용자가 연락 대상으로 유지됩니다. 다음 등록 사용자가 인식되면 연락 대상이 바뀝니다. 차와 멀어졌다고 연락 대상이 지워지지 않습니다.',
  ],
  [
    '앱과 기기는 실제로 사용할 수 있는 단계인가요?',
    '앱 등록과 시제품 사용 검증이 완료된 상태입니다. 정식 제품의 배송 일정과 최종 사양은 별도로 안내합니다.',
  ],
  [
    '앱·안심번호·서버 이용이 포함되나요?',
    '전용 앱 다운로드와 기본 이용은 무료입니다. 안심번호 기반 연락과 기본 서버 이용료 무료 혜택도 함께 제공됩니다. 이용 범위와 세부 약관은 정식 판매 전에 안내합니다.',
  ],
  [
    '예약하면 바로 결제되나요?',
    '아니요. 현재는 결제 없이 예약 의사를 접수합니다. 배송 일정과 최종 구성, 각인 비용을 안내받은 뒤 구매를 결정할 수 있습니다.',
  ],
  [
    '내열 온도와 배터리 수명은 어느 정도인가요?',
    '100°C 이상에서도 사용 가능한 자동차 내장재용 ABS+ 소재를 사용합니다. 1등급 건전지 배터리 1개로 최대 1년 이상 사용하며, 사용 기간은 사용 환경에 따라 달라질 수 있습니다.',
  ],
]
export default function ParkeLaunch() {
  const [reader, setReader] = useState<boolean | null>(null),
    [reduced, setReduced] = useState(false),
    [reserve, setReserve] = useState(false),
    [pastHero, setPastHero] = useState(false)
  useEffect(() => {
    const q = matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    // The hero runs its own full-bleed intro; page chrome waits until the
    // scroll sequence has been scrolled past. The hero is several viewports
    // tall, so it stops intersecting exactly when it ends.
    const hero = document.getElementById('top')
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])
  const still = reader ?? reduced
  return (
    <div className={`parke-cinema parke-launch ${still ? 'pf-still' : ''}`}>
      <a href="#map-story" className="pc-skip">
        본문으로 건너뛰기
      </a>
      <header className={`pf-header ${pastHero ? 'is-visible' : ''}`}>
        <a href="#top" className="pf-brand">
          Parké<span>by originals</span>
        </a>
        <nav aria-label="페이지 탐색">
          <a href="#how">작동 방식</a>
          <a href="#details">제품 디테일</a>
          <button
            className="pf-motion"
            aria-label={still ? '제품 움직임 켜기' : '움직임 없이 보기'}
            onClick={() => setReader(!still)}
          >
            {still ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button className="pf-reserve-nav" onClick={() => setReserve(true)}>
            지금 바로 예약하기
            <ArrowUpRight size={15} />
          </button>
        </nav>
      </header>
      <Original360Hero still={still} />
      <ContactSituation still={still} />
      <ParkeMechanism still={still} />
      <Craft />
      <Benefits />
      <Finishing />
      <Gallery />
      <ParkeOffer onReserve={() => setReserve(true)} />
      <section className="pf-faq">
        <h2>궁금한 것, 짧게.</h2>
        <Accordion>
          {faqs.map(([q, a], i) => (
            <AccordionItem key={q} value={String(i)}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent>{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <footer className="pf-footer">
        <a href="#top">Parké</a>
        <p>함께 쓰는 차를 위한, 다음 세대 주차 연락판.</p>
        <details>
          <summary>제품 개발·이미지 안내</summary>
          <p>
            앱 등록과 시제품 사용 검증이 완료되었습니다. 기기 찾기 이미지는 실제
            앱 화면이며, 나머지 앱·푸시·QR 연락 화면은 사용 흐름을 설명하는
            예시입니다. 제품 렌더와 AI 사용 장면·패키지는 디자인 시안입니다.
            제품에는 자동차 내장재용 ABS+ 소재와 1등급 건전지 배터리를
            사용합니다. 지원 휴대폰과 최종 구성은 출시 안내에서 확인할 수
            있습니다. 안심번호와 서버 무료 이용 정책의 세부 조건, 배송·교환·보증
            조건은 정식 판매 전에 안내합니다.
          </p>
        </details>
        <span>originals © 2026</span>
      </footer>
      <Reservation open={reserve} onOpenChange={setReserve} />
    </div>
  )
}
