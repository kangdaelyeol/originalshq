import { useState, type CSSProperties } from 'react'
import { CarFront, Home, Building2, PhoneCall, MapPin } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'

const scenarios = [
  {
    name: '남편이 출근한 날',
    driver: '남편',
    family: '아내',
    place: '회사',
    driverPhoto: 'parke',
    familyPhoto: 'manual',
    intro:
      '남편은 회사에, 아내는 집에. 회사 앞에 주차한 차를 옮겨 달라는 연락입니다.',
  },
  {
    name: '아내가 외출한 날',
    driver: '아내',
    family: '남편',
    place: '카페',
    driverPhoto: 'manual',
    familyPhoto: 'parke',
    intro:
      '오늘은 아내가 차를 타고 카페에 갔습니다. 남편은 집에 있고, 주차 연락이 옵니다.',
  },
] as const
function ComparisonMap({
  scenario,
  parke,
}: {
  scenario: number
  parke: boolean
}) {
  const s = scenarios[scenario],
    id = `streets-${scenario}-${parke ? 'parke' : 'normal'}`
  const markers = [
    {
      x: 24,
      y: 38,
      person: s.family,
      photo: s.familyPhoto,
      place: '집',
      active: !parke,
    },
    {
      x: 76,
      y: 38,
      person: s.driver,
      photo: s.driverPhoto,
      place: s.place,
      active: parke,
    },
  ]
  return (
    <article className={`sm-card ${parke ? 'sm-parke' : 'sm-normal'}`}>
      <header>
        <span>{parke ? '파르케' : '일반 번호판'}</span>
        <small>{parke ? '운전자 인식 후' : '이전 번호를 그대로 뒀다면'}</small>
      </header>
      <div
        className="sm-map"
        role="img"
        aria-label={
          parke
            ? `${s.place}에 있는 운전자 ${s.driver}에게 바로 연락합니다.`
            : `집에 있는 ${s.family}에게 먼저 전화가 가고, ${s.family}가 ${s.driver}에게 다시 알려 줍니다.`
        }
      >
        <svg
          viewBox="0 0 600 390"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={id}
              width="95"
              height="82"
              patternUnits="userSpaceOnUse"
            >
              <rect width="95" height="82" fill="#edf1f3" />
              <rect x="9" y="9" width="30" height="24" rx="3" fill="#dfe5e9" />
              <rect x="49" y="9" width="35" height="24" rx="3" fill="#e2e7eb" />
              <rect x="9" y="44" width="75" height="27" rx="3" fill="#e2e7eb" />
            </pattern>
          </defs>
          <rect width="600" height="390" fill={`url(#${id})`} />
          <path
            d="M0 335Q130 260 280 345T650 330"
            stroke="#c0dfe9"
            strokeWidth="43"
            fill="none"
          />
          <path
            d="M144 0V390M300 0V390M456 0V390M0 80H600M0 215H600M0 285H600"
            stroke="white"
            strokeWidth="17"
          />
          <rect x="327" y="105" width="77" height="68" rx="7" fill="#d0e4d2" />
          <rect x="27" y="241" width="75" height="53" rx="7" fill="#d0e4d2" />
          <path
            d={parke ? 'M348 281H456V148' : 'M348 281H144V148'}
            className="sm-route-under"
          />
          <path
            d={parke ? 'M348 281H456V148' : 'M348 281H144V148'}
            className="sm-route"
            pathLength="1"
          />
          {!parke && <path d="M144 148V80H456V148" className="sm-relay" />}
        </svg>
        {markers.map((m) => (
          <div
            key={m.person}
            className={`sm-person ${m.active ? 'is-receiver' : ''}`}
            style={{ left: `${m.x}%`, top: `${m.y}%` } as CSSProperties}
          >
            <img
              src={`/images/comparison/02-forgot-${m.photo}.webp`}
              alt=""
              width={50}
              height={50}
            />
            {m.active && (
              <b>
                <PhoneCall size={13} />
              </b>
            )}
            <span>
              {m.place === '집' ? <Home size={12} /> : <Building2 size={12} />}
              <strong>{m.person}</strong> · {m.place}
            </span>
            <small>
              {parke
                ? m.active
                  ? '오늘 운전자 · 바로 수신'
                  : '연락을 전달할 필요 없음'
                : m.active
                  ? '① 먼저 수신'
                  : '② 가족에게 전달받음'}
            </small>
          </div>
        ))}
        <div className="sm-car">
          <i>
            <CarFront size={24} />
          </i>
          <span>우리 차 · {s.place} 주차</span>
        </div>
        <div className="sm-map-key">
          <i />
          주차 연락
          {!parke && (
            <>
              <em />
              가족이 다시 전달
            </>
          )}
        </div>
      </div>
      <footer>
        <PhoneCall size={19} />
        <div>
          <strong>
            {parke
              ? `${s.driver}에게 바로.`
              : `${s.family}${s.family === '남편' ? '이' : '가'} 받고, ${s.driver}에게 다시.`}
          </strong>
          <p>
            {parke
              ? '등록된 오늘 운전자를 인식해 수신 대상을 바꿉니다.'
              : `번호판에 남아 있던 ${s.family} 번호로 먼저 연결됩니다.`}
          </p>
        </div>
      </footer>
    </article>
  )
}
export default function SituationMap() {
  const [scenario, setScenario] = useState('0')
  return (
    <section
      id="map-examples"
      className="sm-section"
      aria-labelledby="map-example-heading"
    >
      <header className="sm-heading">
        <p className="ps-eyebrow">
          <MapPin size={15} />
          상황을 바꿔 보면
        </p>
        <h2 id="map-example-heading">
          같은 주차 연락.
          <br />
          달라지는 연락받는 사람.
        </h2>
      </header>
      <Tabs value={scenario} onValueChange={(v) => setScenario(String(v))}>
        <TabsList aria-label="추가 주차 상황 선택">
          {scenarios.map((s, i) => (
            <TabsTrigger key={s.name} value={String(i)}>
              {s.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {scenarios.map((s, i) => (
          <TabsContent key={s.name} value={String(i)}>
            <p className="sm-context">{s.intro}</p>
            <div className="sm-comparisons">
              <ComparisonMap scenario={i} parke={false} />
              <ComparisonMap scenario={i} parke />
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <p className="sm-caption">
        이해를 돕기 위한 가상 지도입니다. 선은 연락 순서를 나타내며, 차량 위치
        추적 기능을 의미하지 않습니다.
      </p>
    </section>
  )
}
