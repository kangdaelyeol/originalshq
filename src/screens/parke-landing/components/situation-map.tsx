import { ArrowRight, MapPin, PhoneCall } from 'lucide-react'

/** The two people who share the car — the photo is the avatar used in the
 * chains below, and `subject` is the name with its subject particle. */
const people = {
  남편: { photo: '/images/comparison/02-forgot-parke.webp', subject: '남편이' },
  아내: { photo: '/images/comparison/02-forgot-manual.webp', subject: '아내가' },
} as const

type Person = keyof typeof people

/** One day each: who took the car and where it is parked. Whoever did not
 * drive is at home, and it is their number still sitting on an ordinary
 * plate. */
const scenarios: readonly {
  title: string
  parked: string
  driver: Person
  driverPlace: string
  family: Person
}[] = [
  {
    title: '남편이 출근한 날',
    parked: '차는 회사 앞에',
    driver: '남편',
    driverPlace: '회사',
    family: '아내',
  },
  {
    title: '아내가 외출한 날',
    parked: '차는 카페 앞에',
    driver: '아내',
    driverPlace: '카페',
    family: '남편',
  },
]

/**
 * "Same parking call, different person receiving it."
 *
 * This used to be two tabs, one per day, each holding a pair of maps. The
 * second tab was the first with the names swapped, so the click revealed
 * almost nothing — and the point of the section, that the pattern holds
 * whoever is driving, was exactly the part hidden behind it. Both days are
 * now on the page at once as rows, with the ordinary plate and Parké as the
 * two columns: read down a column and the ordinary plate always detours
 * through whoever is at home while Parké always goes straight to the driver.
 *
 * The maps are gone too. The only thing they encoded was the order the call
 * travels in, which a left-to-right chain of people says directly.
 */
export const SituationMap = () => {
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

      <div className="sm-matrix">
        {scenarios.map((s) => (
          <div className="sm-row" key={s.title}>
            <div className="sm-day">
              <h3>{s.title}</h3>
              <p>
                <span>{s.parked}</span>
                <span>{s.family}는 집에</span>
              </p>
            </div>

            {/* 일반 번호판 — 집에 있는 사람이 먼저 받고, 운전자에게 다시 전달 */}
            <article className="sm-cell is-plain">
              <p className="sm-cell-label">
                <strong>일반 번호판</strong>
                이전 번호를 그대로 뒀다면
              </p>
              <ol className="sm-chain">
                <li className="sm-caller">
                  <i>
                    <PhoneCall aria-hidden="true" />
                  </i>
                  <span>주차 연락</span>
                </li>
                <li className="sm-link" aria-hidden="true">
                  <ArrowRight />
                </li>
                <li className="sm-person">
                  <img src={people[s.family].photo} alt="" width={56} height={56} />
                  <span>
                    <strong>{s.family}</strong> · 집
                  </span>
                  <small>먼저 받음</small>
                </li>
                <li className="sm-link is-relay" aria-hidden="true">
                  <ArrowRight />
                </li>
                <li className="sm-person">
                  <img src={people[s.driver].photo} alt="" width={56} height={56} />
                  <span>
                    <strong>{s.driver}</strong> · {s.driverPlace}
                  </span>
                  <small>다시 전달받음</small>
                </li>
              </ol>
              <p className="sm-result">
                {people[s.family].subject} 받고, {s.driver}에게 다시.
              </p>
            </article>

            {/* 파르케 — 운전자에게 바로 */}
            <article className="sm-cell is-parke">
              <p className="sm-cell-label">
                <strong>파르케</strong>
                운전자 인식 후
              </p>
              <ol className="sm-chain">
                <li className="sm-caller">
                  <i>
                    <PhoneCall aria-hidden="true" />
                  </i>
                  <span>주차 연락</span>
                </li>
                <li className="sm-link" aria-hidden="true">
                  <ArrowRight />
                </li>
                <li className="sm-person is-receiver">
                  <img src={people[s.driver].photo} alt="" width={56} height={56} />
                  <span>
                    <strong>{s.driver}</strong> · {s.driverPlace}
                  </span>
                  <small>바로 받음</small>
                </li>
              </ol>
              <p className="sm-result">{s.driver}에게 바로.</p>
            </article>
          </div>
        ))}
      </div>
    </section>
  )
}
