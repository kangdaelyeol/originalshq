import { usePageViewModel } from './view-model'
import {
  ParkeOffer,
  Header,
  Craft,
  Benefits,
  Finishing,
  Gallery,
  Faq,
  Footer,
  ContactSituation,
  Reservation,
  ParkeMechanism,
  Original360Hero,
} from './components'

export default function ParkeLaunch() {
  const { state, actions } = usePageViewModel()
  const { still, pastHero, reserveOpen } = state
  const { openReserve, setReserveOpen } = actions
  return (
    <div className={`parke-cinema parke-launch ${still ? 'pf-still' : ''}`}>
      <a href="#map-story" className="pc-skip">
        본문으로 건너뛰기
      </a>
      <Header pastHero={pastHero} openReserve={openReserve} />
      <Original360Hero still={still} />
      <ContactSituation still={still} />
      <ParkeMechanism still={still} />
      <Craft />
      <Benefits />
      <Finishing />
      <Gallery />
      <ParkeOffer onReserve={openReserve} />
      <Faq />
      <Footer />
      <Reservation open={reserveOpen} onOpenChange={setReserveOpen} />
    </div>
  )
}
