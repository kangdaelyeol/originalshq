import { ArrowRight, Bluetooth, Check, PhoneCall } from 'lucide-react'
import { SituationMap } from './situation-map'
import { DriverChangeScenes, BeautyCut } from './parke-visual-story'
import { useRevealOnceViewModel } from '../view-model'

export const ContactSituation = ({ still = false }: { still?: boolean }) => {
  // The two "who gets the call now" panels each enter once, when they are
  // scrolled to.
  const { targetRef: husbandRef, state: husband } =
    useRevealOnceViewModel<HTMLDivElement>(0.5)
  const { targetRef: wifeRef, state: wife } =
    useRevealOnceViewModel<HTMLDivElement>(0.5)

  return (
    <div id="map-story" className={`pd-story ${still ? 'is-still' : ''}`}>
      <section className="pd-chapter pd-problem">
        <div className="pd-copy">
          <span className="pd-question">Q.</span>
          <p className="pd-kicker">부부가 한 대의 차를 함께 쓸 때</p>
          <h2>
            운전자는 바뀌었는데,
            <br />
            번호판도 바꾸셨나요?
          </h2>
          <p className="pd-body">
            어제는 아내가, 오늘은 남편이 운전합니다.
            <br />
            <strong>차에 남아 있는 번호는 아직 아내 번호.</strong>
          </p>
        </div>
        <DriverChangeScenes />
        {/* The chapter's conclusion. It follows the two photos but is not a
            caption for them, so it is set apart and set larger. */}
        <div className="pd-copy pd-after">
          <p className="pd-takeaway">
            번호가 적힌 일반 주차번호판은
            <br />
            <strong>운전할 때마다 직접 바꿔야</strong>
            <br />
            지금 차를 가져간 사람이 연락을 받습니다.
          </p>
        </div>
      </section>
      <section className="pd-chapter pd-wrong">
        <div className="pd-copy">
          <p className="pd-kicker">깜빡한 날, 이런 일이 생깁니다</p>
          <h2>
            차는 회사에 있는데.
            <br />
            전화는 집으로 갑니다.
          </h2>
          <p className="pd-body">
            남편이 출근해 차를 세워 둔 뒤,
            <br />
            누군가 “차 좀 빼주세요”라고 연락합니다.
          </p>
        </div>
        {/* Photo on the left, the three turns of the mix-up on the right: the
            request comes in, the wife explains, and she has to pass it on. */}
        <div className="pd-relay">
          <div className="pd-scene">
            <img
              src="/images/comparison/02-forgot-manual.webp"
              alt="집에 있는 아내가 남편이 가져간 차의 주차 연락을 받는 상황"
              width={1024}
              height={1024}
              loading="lazy"
            />
          </div>
          <div className="pd-dialogue">
            <p className="is-caller">
              <span>
                <PhoneCall aria-hidden="true" />
                주차 이동 요청
              </span>
              “차 좀 빼주시겠어요?”
            </p>
            <p className="is-wife">
              <span>아내</span>“차는 남편이 가져갔는데…
              <br />
              제가 다시 연락해 볼게요.”
            </p>
            <p className="is-relay">
              <span>남편에게 다시 전화</span>“회사 앞에 세운 차,
              <br />
              옮겨 달래.”
            </p>
          </div>
        </div>
        <div className="pd-copy pd-after">
          <h3>전화 한 번이면 될 일이, 가족을 거쳐 돌아갑니다.</h3>
          <p className="pd-body">
            가족이 바로 전화를 받지 못하면 차를 옮겨야 한다는 전달도 늦어집니다.
          </p>
        </div>
      </section>
      <section className="pd-answer pv-beauty-answer">
        <div className="pd-copy">
          <p className="pd-kicker">그래서, Parké</p>
          <h2>
            운전자가 바뀌면.
            <br />
            <em>연락받는 사람도 바뀌게.</em>
          </h2>
          <p className="pd-body">
            등록된 휴대폰을 인식해
            <br />
            그날 차를 가져간 사람을 연락 대상으로.
            <br />
            <strong>앱을 열지 않아도 자동으로 바뀝니다.</strong>
          </p>
        </div>
        <BeautyCut />
      </section>
      <section className="pd-chapter pd-right">
        <div className="pd-copy">
          <p className="pd-kicker">같은 상황에 파르케가 있다면</p>
          <h2>
            남편이 운전한 날은,
            <br />
            남편에게 바로.
          </h2>
          <p className="pd-body">
            등록된 남편의 휴대폰을 인식하면
            <br />
            주차 연락 대상이 남편으로 바뀝니다.
          </p>
        </div>
        {/* Same split as the wrong-call chapter above: the photo on one side,
            and beside it who the call now reaches — recognised, switched,
            and why nobody had to do anything. */}
        <div className="pd-relay">
          <div className="pd-scene">
            <img
              src="/images/story-v26/boarding-connect.webp"
              alt="운전석에 탑승한 남편의 휴대폰과 대시보드 위 파르케가 자동으로 연결되는 사용 예시"
              width={1254}
              height={1254}
              loading="lazy"
            />
          </div>
          <div
            ref={husbandRef}
            className={`pd-handover ${husband.revealed ? 'is-revealed' : ''}`}
          >
            <p className="pd-handover-cue">
              <Bluetooth aria-hidden="true" />
              등록된 남편의 휴대폰 인식
            </p>
            <p className="pd-handover-names">
              <span>아내</span>
              <ArrowRight aria-hidden="true" />
              <strong>
                남편 <Check aria-hidden="true" />
              </strong>
            </p>
            <p className="pd-handover-note">
              앱을 열지 않아도,
              <br />
              차에 타면 주차 연락 대상이 자동으로.
            </p>
          </div>
        </div>
        <div className="pd-copy pd-after">
          <p className="pd-takeaway">
            집에 있는 가족이 대신 받아
            <br />
            다시 전달할 필요 없이.
            <br />
            <strong>차를 움직일 수 있는 사람에게.</strong>
          </p>
        </div>
      </section>
      <section className="pd-chapter pd-next">
        <div className="pd-copy">
          <p className="pd-kicker">다음 날에는 아내가 운전한다면?</p>
          <h2>
            차는 함께 쓰고.
            <br />
            연락은 각자 받으세요.
          </h2>
          <p className="pd-body">
            다음 등록 사용자인 아내가 인식되면,
            <br />
            같은 번호판의 연락 대상이 다시 바뀝니다.
          </p>
        </div>
        {/* Mirrored — photo on the right — so three split blocks in a row do
            not read as the same block repeated. */}
        <div className="pd-relay is-reversed">
          <div className="pd-scene">
            <img
              src="/images/comparison/04-next-parke.webp"
              alt="다음 날 같은 차를 이용하는 아내"
              width={1024}
              height={1024}
              loading="lazy"
            />
          </div>
          <div
            ref={wifeRef}
            className={`pd-handover ${wife.revealed ? 'is-revealed' : ''}`}
          >
            <p className="pd-handover-cue">
              <Bluetooth aria-hidden="true" />
              등록된 아내 인식
            </p>
            <p className="pd-handover-names">
              <span>남편</span>
              <ArrowRight aria-hidden="true" />
              <strong>
                아내 <Check aria-hidden="true" />
              </strong>
            </p>
            <p className="pd-handover-note">
              연락 대상만 변경,
              <br />
              QR은 그대로.
            </p>
          </div>
        </div>
      </section>
      <p className="pd-example-note">
        사용 흐름을 설명하는 예시입니다. 사진은 AI로 재현했습니다.
      </p>
      <SituationMap />
    </div>
  )
}
