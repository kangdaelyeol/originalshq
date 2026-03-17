import { useState } from 'react'
import { Arrow } from './components/arrow'
import './styles.scss'
import ParkeLogo from '@/assets/parke-icon.png'
import PrivacyModal from '@/screens/privacy/components/privacy-modal'
import { type DocType, type AppName } from './types'
// import { PrivacyScreen } from './components/PrivacyScreen'

export default function Privacy() {
  const [activeDoc, setActiveDoc] = useState(false)
  const [appName, setAppName] = useState<AppName>(null)
  const [docType, setDocType] = useState<DocType>(null)
  const handleShowPress = (name: AppName, type: DocType) => {
    setActiveDoc(true)
    setAppName(name)
    setDocType(type)
  }

  const handleClose = () => {
    setActiveDoc(false)
  }

  return (
    <div className="privacy-container">
      {/* <PrivacyScreen /> */}
      <div className="privacy-wrapper">
        <div className="privacy-title">이용약관</div>
        <div className="privacy-items">
          <div className="privacy-item">
            <div className="item-top">
              <div className="item-box">
                <img src={ParkeLogo} />
              </div>
              <div className="desc-box">
                <div className="desc-title">Parke</div>
                <div className="desc-subtitle">Smart Parking Solution</div>
              </div>
            </div>
            <div className="privacy-box">
              <div
                className="privacy-term"
                onClick={() => handleShowPress('parke', 'privacy')}
              >
                개인정보 처리방침 <Arrow size={16} />
              </div>
              <div className="divider" />
              <div
                className="privacy-term"
                onClick={() => handleShowPress('parke', 'terms')}
              >
                서비스 이용약관 <Arrow size={16} />
              </div>
              <div className="divider" />
              <div
                className="privacy-term"
                onClick={() => handleShowPress('parke', 'consent')}
              >
                개인정보 수집이용 동의서 <Arrow size={16} />
              </div>
              <div className="divider" />
              <div
                className="privacy-term"
                onClick={() => handleShowPress('parke', 'consent-third')}
              >
                개인정보 제3자 제공 동의서 <Arrow size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {activeDoc && appName && docType && (
        <PrivacyModal
          appName={appName}
          handleClose={handleClose}
          docType={docType}
        />
      )}
    </div>
  )
}
