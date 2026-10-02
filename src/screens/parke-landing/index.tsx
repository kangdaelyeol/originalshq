import ContactSituation from './components/contact-situation'
import Reservation from './components/reservation'
import Original360Hero from './components/original-360-hero'
import ParkeMechanism from './components/parke-mechanism'
import ParkeOffer from './components/parke-offer'
import { usePageViewModel } from './view-model'
import { Header } from './components/header'
import { Craft } from './components/craft'
import { Benefits } from './components/benefits'
import { Finishing } from './components/finising'
import { Gallery } from './components/gallery'
import { Faq } from './components/faq'
import { Footer } from './components/footer'

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
