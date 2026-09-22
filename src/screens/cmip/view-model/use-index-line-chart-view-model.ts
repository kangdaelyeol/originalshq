import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type {
  IndexSeries,
  IndexSeriesType,
} from '../components/index-line-chart-types'

// viewBox 크기를 실제 렌더 픽셀 크기에 맞춰 1 유닛 = 1px로 둔다. 이렇게 해야 차트
// 컨테이너가 커져도(모달 "크게 보기", flex로 남는 세로 공간 채우기 등) 폰트·마커·여백
// 같은 지표 요소 크기는 그대로 유지되고, 점 사이 간격(bandW)·플롯 높이(PLOT_H)만
// 늘어난다 — 전체가 그대로 확대(zoom)되는 걸 막는다.
// 치수 측정 전(최초 렌더) 잠깐 쓰는 기본값일 뿐, 측정되는 즉시 실제 크기로 바뀐다.
const DEFAULT_VB_W = 960
const DEFAULT_VB_H = 300

/** roughStep 이상인 가장 가까운 "깔끔한" 스텝(1/2/5 × 10^n). */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1
  const exp = Math.floor(Math.log10(roughStep))
  const base = roughStep / 10 ** exp
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return niceBase * 10 ** exp
}

/**
 * 한 지표의 값 범위를 감싸는 "깔끔한" y축 구간. 0을 강제하지 않는다 — 지표별 독립 축의
 * 목적이 각 선을 자기 변화폭만큼 플롯 높이에 펼쳐 보는 것이라, 0부터 그리면 그 변화가
 * 눌려 보인다. 다만 값이 모두 0 이상인데 패딩 때문에 하한이 음수로 내려가면 0으로 자른다.
 */
function niceRange(
  minV: number,
  maxV: number,
  count = 5,
): { min: number; max: number; ticks: number[] } {
  let lo = minV
  let hi = maxV
  if (lo === hi) {
    const spread = Math.abs(lo) * 0.1 || 1
    lo -= spread
    hi += spread
  }
  const pad = (hi - lo) * 0.12
  lo -= pad
  hi += pad
  const step = niceStep((hi - lo) / count)
  let niceMin = Math.floor(lo / step) * step
  const niceMax = Math.ceil(hi / step) * step
  if (minV >= 0 && niceMin < 0) niceMin = 0
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step / 1000; v += step) {
    ticks.push(Math.round(v * 1000) / 1000)
  }
  return { min: niceMin, max: niceMax, ticks }
}

export interface PreparedSeries extends IndexSeries {
  type: IndexSeriesType
  range: { min: number; max: number; ticks: number[] }
  avg: number | null
}

/** index-line-chart 전용 상태 — 호버/범례포커스 상태와, 캔버스 실측 크기(vbWidth/
 * vbHeight, ResizeObserver로 추적)와, 지표별 독립 y축 범위·평균값(prepared)을 다룬다.
 * PLOT_W/bandW/xCenter/yIn 같은 나머지 기하 계산은 매 렌더 JSX에 바로 쓰여서
 * 컴포넌트에 그대로 둔다(state가 아니라 순수 렌더 로직). */
export const useIndexLineChartViewModel = (series: readonly IndexSeries[]) => {
  const [hover, setHover] = useState<{
    index: number
    seriesKey: string | null
  } | null>(null)
  // 범례에 마우스를 올리면 크로스헤어/툴팁 없이 그 지표만 "포커스"한다.
  const [legendHoverKey, setLegendHoverKey] = useState<string | null>(null)
  // 캔버스(svg + 툴팁) 래퍼 — 범례는 이 밖에 둬서, 측정 대상이 순수하게 svg 영역만
  // 가리키게 한다(범례 높이가 섞여 들어가지 않도록).
  const wrapRef = useRef<HTMLDivElement>(null)
  const [vbWidth, setVbWidth] = useState(DEFAULT_VB_W)
  const [vbHeight, setVbHeight] = useState(DEFAULT_VB_H)

  // 캔버스의 실제 렌더 크기를 측정해 viewBox 크기로 그대로 쓴다(1 유닛 = 1px).
  // "크게 보기"나 flex로 남는 세로 공간을 채울 때처럼 컨테이너가 커지면 이 값이
  // 늘어나 점 간격·플롯 높이만 넓어지고, 폰트·마커 등 절대 크기로 둔 요소는
  // 영향받지 않는다.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = (rect: DOMRectReadOnly) => {
      if (rect.width > 0) setVbWidth(rect.width)
      if (rect.height > 0) setVbHeight(rect.height)
    }
    // 최초 측정은 이 useLayoutEffect 자체가 이미 커밋 단계(페인트 전)라 일반
    // setState로도 다음 페인트 전에 반영된다.
    measure(el.getBoundingClientRect())
    // 이후의 리사이즈는 ResizeObserver 콜백에서 온다 — 브라우저가 레이아웃 이후·
    // 페인트 이전에 불러주긴 하지만, 그 안의 setState는 React 18에서 "React가
    // 통제하는 이벤트" 밖의 업데이트라 스케줄러를 타고 비동기로 커밋된다. 보장 없이
    // 다음 페인트를 놓치면 viewBox가 한 프레임(때로는 그 이상) 뒤처진 채로 그려져
    // preserveAspectRatio="none"이 그 차이를 가로로 늘려버린다("크게 보기"처럼
    // 큰 폭 변화가 한 번에 일어날 때 특히 티가 난다). flushSync로 같은 콜백 안에서
    // 동기 커밋시켜 리사이즈와 같은 프레임에 반영되도록 강제한다.
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      flushSync(() => measure(entry.contentRect))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 각 지표를 자기 min~max 범위로 독립 스케일한다 — 그래야 여러 지표를 겹쳐도
  // 첫 컬럼이 한 점에 몰리지 않고 각 선이 제 변화폭만큼 펼쳐진다.
  const prepared: PreparedSeries[] = useMemo(
    () =>
      series.map((s) => {
        const type: IndexSeriesType = s.type ?? 'line'
        const nums = s.raw.filter((v): v is number => Number.isFinite(v))
        let range
        if (nums.length === 0) {
          range = niceRange(0, 1)
        } else {
          const lo = Math.min(...nums)
          const hi = Math.max(...nums)
          // 막대는 0 기준선을 강제한다 — 바닥이 잘린 막대는 길이 비교를 왜곡한다.
          range =
            type === 'bar' ? niceRange(Math.min(0, lo), hi) : niceRange(lo, hi)
        }
        // formatCompact 중 일부(impressions 등 num())는 소수 자릿수를 강제하지
        // 않아 toLocaleString 기본값(최대 3자리)이 그대로 노출된다 — 평균은 원본
        // 값들의 합/개수라 나머지 지표는 딱 떨어지지 않는 경우가 많으니, 표시
        // 전에 미리 소수 둘째 자리로 반올림해둔다(이미 소수 둘째 자리까지 고정
        // 포맷하는 지표는 영향 없음).
        const avgRaw =
          nums.length === 0
            ? null
            : nums.reduce((sum, v) => sum + v, 0) / nums.length
        const avg = avgRaw == null ? null : Math.round(avgRaw * 100) / 100
        return { ...s, type, range, avg }
      }),
    [series],
  )

  return {
    // 진행 상태
    hover,
    legendHoverKey,
    wrapRef,
    vbWidth,
    vbHeight,
    prepared,
    // 액션
    setHover,
    setLegendHoverKey,
  }
}
