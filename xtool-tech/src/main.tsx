import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { applyAccent } from './settings/accent'
import { applyGlass } from './settings/glass'
import { effectiveAccent, loadSettings } from './settings/settings'
import './styles/index.scss'

// 첫 화면 전에 저장된 강조색·유리 값을 칠해 둔다(기본값이 잠깐 보였다 바뀌지 않게).
const initialSettings = loadSettings()
applyAccent(effectiveAccent(initialSettings))
applyGlass(initialSettings.glass)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
