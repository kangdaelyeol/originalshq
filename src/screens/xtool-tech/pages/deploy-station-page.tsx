import { CircleCheck, Rocket } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/button'
import { GlassCard } from '../components/ui/glass-card'
import { StatusPill } from '../components/ui/status-pill'
import { TextField } from '../components/ui/text-field'
import { DEFAULT_BRANCH, INFRA_HEALTH, INFRA_STATUS, NEXT_DEPLOY_NUMBER } from '../data/deploy'

interface QueuedDeploy {
  id: string
  branch: string
}

export function DeployStationPage() {
  const [branch, setBranch] = useState(DEFAULT_BRANCH)
  const [queued, setQueued] = useState<QueuedDeploy[]>([])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const target = branch.trim()
    if (!target) return
    setQueued((prev) => [{ id: `DEP-${NEXT_DEPLOY_NUMBER + prev.length}`, branch: target }, ...prev])
  }

  const latest = queued[0]

  return (
    <div className="grid grid--main-side">
      <GlassCard
        title="빠른 배포 실행"
        subtitle="브랜치를 스테이징 환경에 바로 올려요. 지금은 목업이라 실제 배포는 일어나지 않아요."
      >
        <form className="form" onSubmit={onSubmit}>
          <TextField
            label="대상 브랜치"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="예: main"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="form__actions">
            <Button type="submit" icon={Rocket}>
              테스트 배포 실행
            </Button>
            <p className="form__note" role="status">
              {latest && (
                <>
                  <CircleCheck size={14} aria-hidden />
                  {latest.id} · {latest.branch} → staging 대기열에 넣었어요
                </>
              )}
            </p>
          </div>
        </form>
      </GlassCard>

      <GlassCard title="인프라 상태" titleSize="lg">
        <ul className="health">
          {INFRA_HEALTH.map((service) => {
            const status = INFRA_STATUS[service.status]
            return (
              <li key={service.key} className="health__item">
                <div>
                  <p className="health__name">{service.name}</p>
                  <p className="health__meta">지연 {service.latencyMs}ms</p>
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </li>
            )
          })}
        </ul>
      </GlassCard>
    </div>
  )
}
