import { useEffect, useRef, useState } from 'react'
import {
  Bluetooth,
  Check,
  LockKeyhole,
  PhoneCall,
  QrCode,
  RefreshCw,
} from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from './ui/carousel'

function SignalLink({ studio = false }: { studio?: boolean }) {
  const line = studio
    ? 'M 520 515 C 600 300 730 320 812 470'
    : 'M 722 415 C 660 390 580 510 460 556'
  return (
    <svg
      className={`pv-signal ${studio ? 'is-studio' : ''}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="pv-signal-halo" d={line} />
      <path className="pv-signal-base" d={line} />
      <path className="pv-signal-flow" d={line} />
      {(studio
        ? [
            [520, 515],
            [812, 470],
          ]
        : [
            [722, 415],
            [460, 556],
          ]
      ).map(([x, y], i) => (
        <g key={i}>
          <circle className="pv-signal-ring" cx={x} cy={y} r="25" />
          <circle className="pv-signal-point" cx={x} cy={y} r="9" />
        </g>
      ))}
    </svg>
  )
}

export function DriverChangeScenes() {
  return (
    <div className="pv-driver-comparison">
      <figure className="pv-driver-frame is-yesterday">
        <div className="pv-day-heading">
          <span>어제</span>
          <strong>아내가 운전한 날</strong>
        </div>
        <div className="pv-driver-photo">
          <img
            src="/images/story-v26/yesterday-exit.webp"
            alt="어제 운전한 아내가 차 문을 닫고 걸어가는 뒷모습"
            width={1254}
            height={1254}
            loading="lazy"
          />
          <span className="pv-scene-label">차에서 내린 사람 · 아내</span>
        </div>
        <figcaption>
          <span>운전은 끝났지만,</span>
          <strong>번호는 그대로 남아 있습니다.</strong>
        </figcaption>
      </figure>
      <figure className="pv-driver-frame is-today">
        <div className="pv-day-heading">
          <span>오늘</span>
          <strong>남편이 운전하는 날</strong>
        </div>
        <div className="pv-driver-photo">
          <img
            src="/images/story-v26/today-manual.webp"
            alt="오늘 운전하는 남편이 대시보드의 일반 주차번호판 숫자를 손으로 바꾸는 모습"
            width={1254}
            height={1254}
            loading="lazy"
          />
          <span className="pv-scene-label">
            <RefreshCw size={19} />내 번호로 직접 바꾸기
          </span>
        </div>
        <figcaption>
          <span>이제 내가 연락받으려면,</span>
          <strong>번호판도 직접 바꿔야 합니다.</strong>
        </figcaption>
      </figure>
    </div>
  )
}

export function BeautyCut() {
  return (
    <figure className="pv-beauty">
      <img
        src="/images/story-v26/beauty.webp"
        alt="빛으로 모서리와 무광 마감을 드러낸 Parké 제품 뷰티컷"
        width={1536}
        height={1024}
        loading="lazy"
      />
      <figcaption>
        <span>Parké</span>
        <p>
          함께 쓰는 차를 위한
          <br />
          <strong>자동 주차번호판.</strong>
        </p>
      </figcaption>
    </figure>
  )
}

export function BoardingConnection() {
  return (
    <figure className="pv-boarding">
      <div className="pv-boarding-scene">
        <img
          src="/images/story-v26/boarding-connect.webp"
          alt="운전석에 탑승한 남편의 휴대폰과 대시보드 위 파르케가 자동으로 연결되는 사용 예시"
          width={1254}
          height={1254}
          loading="lazy"
        />
        <SignalLink />
        <span className="pv-boarding-tag">
          <Bluetooth size={20} />
          등록된 남편의 휴대폰 인식
        </span>
      </div>
      <figcaption>
        <div className="pv-background-line">
          <LockKeyhole size={20} />
          <span>앱을 열지 않아도</span>
        </div>
        <div className="pv-recipient-change">
          <span>아내</span>
          <RefreshCw size={23} />
          <strong>
            남편 <Check size={24} />
          </strong>
        </div>
        <p>차에 타면, 주차 연락 대상이 자동으로.</p>
      </figcaption>
    </figure>
  )
}

const slides = [
  {
    label: '휴대폰 인식',
    title: '기기가 휴대폰을 알아봅니다',
    body: (
      <>
        파르케의 블루투스 인식부가
        <br />
        미리 등록한 휴대폰을 찾습니다.
      </>
    ),
    image: '/images/story-v26/device-phone-studio.webp',
    alt: '파르케 본체와 등록된 휴대폰 사이의 블루투스 인식을 보여주는 렌더',
  },
  {
    label: '자동 전환',
    title: '앱을 열지 않아도, 자동 전환',
    body: (
      <>
        인식된 사용자 정보가 반영되면,
        <br />
        같은 QR의 연락 대상이 바뀝니다.
      </>
    ),
    image: '/images/story-v26/device-phone-studio.webp',
    alt: '파르케와 휴대폰 연결 후 연락 대상 정보가 바뀌는 과정을 보여주는 렌더',
  },
  {
    label: '연락 연결',
    title: '주차 연락은, 오늘 사용자에게',
    body: (
      <>
        QR로 열린 웹페이지에서 전화 버튼을 누르면,
        <br />
        안심번호를 통해 현재 사용자에게 연결됩니다.
      </>
    ),
    image: '/images/comparison/02-forgot-parke.webp',
    alt: '오늘 차를 가져간 남편이 주차 연락을 직접 받는 상황',
  },
]

export function MechanismSlides({ still }: { still: boolean }) {
  const [api, setApi] = useState<CarouselApi>(),
    [selected, setSelected] = useState(0),
    [visible, setVisible] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!host.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!api) return
    const sync = () => setSelected(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    return () => {
      api.off('select', sync)
    }
  }, [api])
  useEffect(() => {
    if (!api || still || !visible) return
    const timer = setInterval(() => api.scrollNext(), 6500)
    return () => clearInterval(timer)
  }, [api, still, visible, selected])
  return (
    <div ref={host} className="pv-mechanism-slides">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: 'start', duration: 25 }}
        aria-label="파르케가 연결되는 세 단계"
      >
        <div className="pv-slide-top">
          <span>기기에서 휴대폰까지, 한눈에.</span>
        </div>
        <CarouselContent className="pv-mechanism-track">
          {slides.map((slide, index) => (
            <CarouselItem
              className={`pv-mechanism-slide pv-slide-${index}`}
              key={slide.label}
              aria-label={`${index + 1}단계 ${slide.label}`}
            >
              <div className="pv-slide-image">
                <img
                  src={slide.image}
                  alt={slide.alt}
                  width={index === 2 ? 1024 : 1536}
                  height={1024}
                  loading="lazy"
                />
                {index < 2 ? (
                  <SignalLink studio />
                ) : (
                  <div className="pv-call-chip">
                    <PhoneCall size={25} />
                    <span>주차 이동 요청</span>
                    <strong>남편에게 연결</strong>
                  </div>
                )}
                {index < 2 && (
                  <span
                    className={`pv-phone-confirm pv-phone-confirm-${index}`}
                    aria-hidden="true"
                  >
                    {index === 0 ? <Bluetooth /> : <Check />}
                  </span>
                )}
                {index === 0 && (
                  <span className="pv-ble-caption">
                    <Bluetooth size={19} />
                    등록된 휴대폰 인식
                  </span>
                )}
              </div>
              <div className="pv-slide-copy">
                <span className="pv-slide-number">0{index + 1}</span>
                <h3>{slide.title}</h3>
                <p>{slide.body}</p>
                {index === 0 ? (
                  <div className="pv-slide-result">
                    <Bluetooth size={21} />
                    <strong>등록된 남편을 찾았습니다.</strong>
                  </div>
                ) : index === 1 ? (
                  <div className="pv-slide-result pv-slide-transfer">
                    <span>어제 · 아내</span>
                    <RefreshCw size={21} />
                    <strong>
                      오늘 · 남편 <Check size={20} />
                    </strong>
                  </div>
                ) : (
                  <div className="pv-slide-result">
                    <QrCode size={23} />
                    <strong>QR 그대로 · 안심번호로 연결</strong>
                  </div>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="pv-slide-navigation">
          <CarouselPrevious aria-label="이전 작동 단계" />
          <div aria-live="polite">
            <b>0{selected + 1}</b>
            <span> / 03</span>
          </div>
          <CarouselNext aria-label="다음 작동 단계" />
        </div>
        <div className="pv-slide-dots" aria-label="작동 설명 단계 선택">
          {slides.map((slide, index) => (
            <button
              key={slide.label}
              aria-pressed={selected === index}
              onClick={() => api?.scrollTo(index)}
            >
              <span>0{index + 1}</span>
              {slide.label}
            </button>
          ))}
        </div>
      </Carousel>
      <p className="pv-flow-note">
        휴대폰은 등록할 때만 앱에서 설정해 두세요.
        <br />
        이후 자동 전환을 위해 매번 앱을 열 필요가 없습니다.
      </p>
    </div>
  )
}
