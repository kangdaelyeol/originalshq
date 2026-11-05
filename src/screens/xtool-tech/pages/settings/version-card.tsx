import { ChevronDown } from 'lucide-react'
import type { Tone } from '@/ohq-ui/types'
import { GlassCard, StatusPill } from '../../components/layout-parts'
import { TECH_CHANGELOG, TECH_VERSION, type ChangeKind } from '../../version'

const KIND: Record<ChangeKind, { label: string; tone: Tone }> = {
  new: { label: '새 기능', tone: 'info' },
  improved: { label: '개선', tone: 'good' },
  fixed: { label: '고침', tone: 'warn' },
}

/**
 * 버전 정보 — 지금 버전과 업데이트 기록(version.ts, 최근 것부터). 기록은 버전마다 한 줄(버전·날짜·제목·바뀐 수)로
 * 묶어 두고, 줄을 누르면 그 버전에서 바뀐 것이 펼쳐진다.
 */
export function VersionCard() {
  return (
    <GlassCard title="버전 정보" subtitle="지금 쓰고 있는 tech 화면의 버전과 업데이트 기록이에요.">
      <p className="version-current">
        <strong>v{TECH_VERSION}</strong>
        <span>지금 버전</span>
      </p>
      <h3 className="bg-section-label">업데이트 기록</h3>
      <ul className="version-history">
        {TECH_CHANGELOG.map((release) => (
          <li key={release.version}>
            <details className="version-release">
              <summary className="version-release__head">
                <strong>v{release.version}</strong>
                <time dateTime={release.date}>{release.date}</time>
                {release.title && <span className="version-release__title">{release.title}</span>}
                <span className="version-release__count">{release.changes.length}개 바뀜</span>
                <ChevronDown size={16} className="version-release__chevron" aria-hidden />
              </summary>
              <ul className="version-release__changes">
                {release.changes.map((change) => (
                  <li key={change.text}>
                    <StatusPill tone={KIND[change.kind].tone}>{KIND[change.kind].label}</StatusPill>
                    <span>{change.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
