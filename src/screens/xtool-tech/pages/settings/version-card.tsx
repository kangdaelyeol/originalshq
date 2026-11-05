import { useState } from 'react'
import type { Tone } from '@/ohq-ui/types'
import { Button, GlassCard, StatusPill } from '../../components/layout-parts'
import { TECH_CHANGELOG, TECH_VERSION, type ChangeKind } from '../../version'

/** 처음에 펼쳐 둘 기록 수 — 나머지는 "이전 기록 더 보기" */
const SHOWN = 3

const KIND: Record<ChangeKind, { label: string; tone: Tone }> = {
  new: { label: '새 기능', tone: 'info' },
  improved: { label: '개선', tone: 'good' },
  fixed: { label: '고침', tone: 'warn' },
}

/** 버전 정보 — 지금 버전과 업데이트 기록(version.ts, 최근 것부터). */
export function VersionCard() {
  const [all, setAll] = useState(false)
  const releases = all ? TECH_CHANGELOG : TECH_CHANGELOG.slice(0, SHOWN)
  const hidden = TECH_CHANGELOG.length - SHOWN
  return (
    <GlassCard title="버전 정보" subtitle="지금 쓰고 있는 tech 화면의 버전과 업데이트 기록이에요.">
      <p className="version-current">
        <strong>v{TECH_VERSION}</strong>
        <span>지금 버전</span>
      </p>
      <h3 className="bg-section-label">업데이트 기록</h3>
      <ol className="version-history">
        {releases.map((release) => (
          <li key={release.version} className="version-release">
            <p className="version-release__head">
              <strong>v{release.version}</strong>
              <time dateTime={release.date}>{release.date}</time>
              {release.title && <span className="version-release__title">{release.title}</span>}
            </p>
            <ul className="version-release__changes">
              {release.changes.map((change) => (
                <li key={change.text}>
                  <StatusPill tone={KIND[change.kind].tone}>{KIND[change.kind].label}</StatusPill>
                  <span>{change.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setAll((open) => !open)}>
          {all ? '최근 기록만 보기' : `이전 기록 ${hidden}개 더 보기`}
        </Button>
      )}
    </GlassCard>
  )
}
