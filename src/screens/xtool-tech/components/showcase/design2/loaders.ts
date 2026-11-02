import {
  LoaderBallDust,
  LoaderBallEyes,
  LoaderBallHop,
  LoaderBallMirror,
  LoaderBallMorph,
  LoaderBallRoll,
  LoaderBallSphere,
  LoaderBallSteps,
} from './ball-loaders'
import {
  LoaderRingChase,
  LoaderRingComet,
  LoaderRingDraw,
  LoaderRingDrawTrail,
  LoaderRingGap,
  LoaderRingOrbit,
  LoaderRingSplit,
  LoaderRingWindup,
} from './circle-loaders'
import {
  LoaderDotsFade,
  LoaderDotsLeap,
  LoaderDotsOrbit,
  LoaderDotsPulse,
  LoaderDotsSplit,
  LoaderDotsSwap,
  LoaderDotsTriangle,
  LoaderDotsWave,
} from './dots-loaders'
import {
  LoaderFadeBloom,
  LoaderFadeDisc,
  LoaderFadeEmit,
  LoaderFadeHalo,
  LoaderFadeRing,
  LoaderFadeRipple,
  LoaderFadeSwap,
  LoaderFadeSwell,
} from './fade-loaders'
import {
  LoaderIconBook,
  LoaderIconCoin,
  LoaderIconDownload,
  LoaderIconHouse,
  LoaderIconMail,
  LoaderIconPhotos,
  LoaderIconSearch,
  LoaderIconTruck,
} from './icon-loaders'
import {
  LoaderClockFloat,
  LoaderClockPendulum,
  LoaderClockPie,
  LoaderClockPulse,
  LoaderClockSpin,
  LoaderCuckooPendulum,
  LoaderCuckooWeights,
  LoaderHourglass,
} from './time-loaders'
import {
  LoaderAntennaPop,
  LoaderAntennaPulse,
  LoaderAntennaWaves,
  LoaderWifiBlink,
  LoaderWifiCascade,
  LoaderWifiEmerge,
  LoaderWifiMorph,
  LoaderWifiPop,
} from './wifi-loaders'
import type { LoaderGroup } from './types'

/** 견본 판 — 참고 영상과 같은 순서(줄마다 8개). */
export const LOADER_GROUPS: LoaderGroup[] = [
  {
    label: 'Circle',
    items: [
      { name: 'LoaderRingDraw', Component: LoaderRingDraw },
      { name: 'LoaderRingChase', Component: LoaderRingChase },
      { name: 'LoaderRingWindup', Component: LoaderRingWindup },
      { name: 'LoaderRingGap', Component: LoaderRingGap },
      { name: 'LoaderRingSplit', Component: LoaderRingSplit },
      { name: 'LoaderRingDrawTrail', Component: LoaderRingDrawTrail },
      { name: 'LoaderRingComet', Component: LoaderRingComet },
      { name: 'LoaderRingOrbit', Component: LoaderRingOrbit },
    ],
  },
  {
    label: 'Dots',
    items: [
      { name: 'LoaderDotsWave', Component: LoaderDotsWave },
      { name: 'LoaderDotsFade', Component: LoaderDotsFade },
      { name: 'LoaderDotsLeap', Component: LoaderDotsLeap },
      { name: 'LoaderDotsPulse', Component: LoaderDotsPulse },
      { name: 'LoaderDotsOrbit', Component: LoaderDotsOrbit },
      { name: 'LoaderDotsSplit', Component: LoaderDotsSplit },
      { name: 'LoaderDotsTriangle', Component: LoaderDotsTriangle },
      { name: 'LoaderDotsSwap', Component: LoaderDotsSwap },
    ],
  },
  {
    label: 'Fade Circles',
    items: [
      { name: 'LoaderFadeBloom', Component: LoaderFadeBloom },
      { name: 'LoaderFadeSwell', Component: LoaderFadeSwell },
      { name: 'LoaderFadeRing', Component: LoaderFadeRing },
      { name: 'LoaderFadeDisc', Component: LoaderFadeDisc },
      { name: 'LoaderFadeHalo', Component: LoaderFadeHalo },
      { name: 'LoaderFadeEmit', Component: LoaderFadeEmit },
      { name: 'LoaderFadeRipple', Component: LoaderFadeRipple },
      { name: 'LoaderFadeSwap', Component: LoaderFadeSwap },
    ],
  },
  {
    label: 'Ball',
    items: [
      { name: 'LoaderBallMirror', Component: LoaderBallMirror },
      { name: 'LoaderBallSteps', Component: LoaderBallSteps },
      { name: 'LoaderBallHop', Component: LoaderBallHop },
      { name: 'LoaderBallDust', Component: LoaderBallDust },
      { name: 'LoaderBallMorph', Component: LoaderBallMorph },
      { name: 'LoaderBallSphere', Component: LoaderBallSphere },
      { name: 'LoaderBallRoll', Component: LoaderBallRoll },
      { name: 'LoaderBallEyes', Component: LoaderBallEyes },
    ],
  },
  {
    label: 'Time',
    items: [
      { name: 'LoaderClockSpin', Component: LoaderClockSpin },
      { name: 'LoaderClockPulse', Component: LoaderClockPulse },
      { name: 'LoaderClockFloat', Component: LoaderClockFloat },
      { name: 'LoaderClockPendulum', Component: LoaderClockPendulum },
      { name: 'LoaderCuckooPendulum', Component: LoaderCuckooPendulum },
      { name: 'LoaderCuckooWeights', Component: LoaderCuckooWeights },
      { name: 'LoaderClockPie', Component: LoaderClockPie },
      { name: 'LoaderHourglass', Component: LoaderHourglass },
    ],
  },
  {
    label: 'Wifi',
    items: [
      { name: 'LoaderWifiEmerge', Component: LoaderWifiEmerge },
      { name: 'LoaderWifiCascade', Component: LoaderWifiCascade },
      { name: 'LoaderWifiBlink', Component: LoaderWifiBlink },
      { name: 'LoaderWifiMorph', Component: LoaderWifiMorph },
      { name: 'LoaderWifiPop', Component: LoaderWifiPop },
      { name: 'LoaderAntennaWaves', Component: LoaderAntennaWaves },
      { name: 'LoaderAntennaPulse', Component: LoaderAntennaPulse },
      { name: 'LoaderAntennaPop', Component: LoaderAntennaPop },
    ],
  },
  {
    label: 'Icons',
    items: [
      { name: 'LoaderIconSearch', Component: LoaderIconSearch },
      { name: 'LoaderIconMail', Component: LoaderIconMail },
      { name: 'LoaderIconPhotos', Component: LoaderIconPhotos },
      { name: 'LoaderIconHouse', Component: LoaderIconHouse },
      { name: 'LoaderIconDownload', Component: LoaderIconDownload },
      { name: 'LoaderIconCoin', Component: LoaderIconCoin },
      { name: 'LoaderIconTruck', Component: LoaderIconTruck },
      { name: 'LoaderIconBook', Component: LoaderIconBook },
    ],
  },
]
