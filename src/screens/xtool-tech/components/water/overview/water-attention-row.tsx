import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/ohq-ui/lib/cx'
import { WaterNumber } from '@/ohq-ui/water/surfaces/water-number'
import { WaterSkeletonBlock } from '@/ohq-ui/water/surfaces/water-skeleton'
import type { AttentionTile } from '../../../data/attention'
import { xtPath } from '../../../paths'

const TONE_LABEL: Record<AttentionTile['tone'], string> = { crit: '급함', warn: '챙김', info: '알림' }

/**
 * 챙겨야 할 것(D7) — AttentionRow와 같은 props. 한 줄 요약 타일, 누르면 그 보드로. 챙길 건이 있으면 유리 타일이
 * 떠 있고 숫자는 어두운 표시 알약(D7 고른 것)에 흰 글자, 급함·챙김·알림은 이름 앞 점 색(글자는 잉크). 0건이면
 * 벽에 붙은 판(그림자 없음)으로 흐리게. 숫자가 바뀌면 굴러가고(WaterNumber), 불러오는 동안은 빈 홈.
 * 타일은 왼쪽부터 21ms 간격으로 진해진다(D7 아이콘 차례).
 */
export function WaterAttentionRow({ tiles, loading }: { tiles: AttentionTile[]; loading: boolean }) {
  return (
    <section className="water-attention" aria-label="챙겨야 할 것" aria-busy={loading || undefined}>
      <h2 className="water-attention__title">챙겨야 할 것</h2>
      <div className="water-attention__grid">
        {tiles.map((tile, i) => {
          const on = !loading && tile.count > 0
          return (
            <Link
              key={tile.id}
              to={xtPath(`/boards/${tile.slug}`)}
              className={cx(
                'water-attention__tile',
                'water-reveal',
                on ? `is-${tile.tone}` : 'is-zero',
                loading && 'is-loading',
              )}
              style={{ '--w-i': i } as CSSProperties}
              title={tile.examples.length ? tile.examples.join('\n') : undefined}
            >
              <span className="water-attention__label">
                <span className="water-attention__dot" aria-hidden />
                {tile.label}
                {on && <span className="sr-only"> ({TONE_LABEL[tile.tone]})</span>}
              </span>
              <strong className="water-attention__count">
                {loading ? (
                  <>
                    <WaterSkeletonBlock shape="title" width={30} height={26} />
                    <span className="sr-only">불러오는 중</span>
                  </>
                ) : (
                  <WaterNumber value={tile.count} />
                )}
              </strong>
              <span className="water-attention__caption">{tile.caption}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
