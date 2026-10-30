import type {
  CollectionReference,
  DocumentData,
} from 'firebase-admin/firestore'
import { db } from '../data'
import { adEntitiesCol, listAdEntities } from './entities'
import type {
  AdEntityDoc,
  AdSettingsSnapshot,
  AdSettingVersion,
  AdSettingVersionDoc,
  AdSettingVersionInput,
  AdTest,
  AdTestDoc,
  AdTestInput,
  ConversionGoal,
  ConversionGoalDoc,
  ConversionGoalInput,
  CreativeSet,
  CreativeSetDoc,
  CreativeSetInput,
} from './types'

const versionsCol = (): CollectionReference<DocumentData> =>
  db.collection('adSettingVersions')
const goalsCol = (): CollectionReference<DocumentData> =>
  db.collection('adConversionGoals')
const creativeSetsCol = (): CollectionReference<DocumentData> =>
  db.collection('adCreativeSets')
const testsCol = (): CollectionReference<DocumentData> =>
  db.collection('adTests')

/** 설정 한 장의 문서 ID — 같은 대상·같은 시작일은 한 장. */
export const versionId = (entityKey: string, effectiveFrom: string) =>
  `${entityKey}@${effectiveFrom}`

/** 처음 쓸 때 넣어 두는 전환 목표 — 지금 운영 중인 캠페인 이름(문의·장바구니·
 * 랜딩 조회)과 흔히 쓰는 목표. 고치거나 늘리는 건 saveGoal로. */
const DEFAULT_GOALS: Record<string, Omit<ConversionGoalDoc, 'updatedAt'>> = {
  inquiry: { label: '문의', kpi: 'cpa', order: 10, archived: false },
  purchase: { label: '구매', kpi: 'roas', order: 20, archived: false },
  cart: { label: '장바구니', kpi: 'cpa', order: 30, archived: false },
  signup: { label: '회원가입', kpi: 'cpa', order: 40, archived: false },
  call: { label: '전화', kpi: 'cpa', order: 50, archived: false },
  landing: { label: '랜딩 조회', kpi: 'cpc', order: 60, archived: false },
  traffic: { label: '트래픽', kpi: 'cpc', order: 70, archived: false },
  awareness: { label: '인지도', kpi: 'cpm', order: 80, archived: false },
}

async function listGoals(): Promise<ConversionGoal[]> {
  let snap = await goalsCol().get()
  if (snap.empty) {
    const now = Date.now()
    const batch = db.batch()
    for (const [key, goal] of Object.entries(DEFAULT_GOALS)) {
      batch.set(goalsCol().doc(key), { ...goal, updatedAt: now })
    }
    await batch.commit()
    snap = await goalsCol().get()
  }
  return snap.docs
    .map((d) => ({ key: d.id, ...(d.data() as ConversionGoalDoc) }))
    .sort((a, b) => a.order - b.order)
}

/** 화면이 한 번에 받는 전부 — 목록·목표·소재 셋·설정 기록(수백 건 수준). */
export async function getAdSettingsSnapshot(): Promise<AdSettingsSnapshot> {
  const [entities, goals, creativeSetsSnap, versionsSnap, testsSnap] =
    await Promise.all([
      listAdEntities(),
      listGoals(),
      creativeSetsCol().get(),
      versionsCol().get(),
      testsCol().get(),
    ])
  return {
    entities,
    goals,
    creativeSets: creativeSetsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as CreativeSetDoc),
    })),
    versions: versionsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as AdSettingVersionDoc) }))
      .sort(
        (a, b) =>
          a.entityKey.localeCompare(b.entityKey) ||
          a.effectiveFrom.localeCompare(b.effectiveFrom),
      ),
    tests: testsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as AdTestDoc) }))
      .sort((a, b) => b.updatedAt - a.updatedAt),
  }
}

export class AdSettingsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** 설정 한 장 저장 — 같은 대상·같은 시작일이면 그 장을 고친다. 대상은 목록
 * (adEntities)에 있어야 하고, 목표·소재 셋은 있는 것이어야 한다. */
export async function saveVersion(
  input: AdSettingVersionInput,
): Promise<AdSettingVersion> {
  const entitySnap = await adEntitiesCol().doc(input.entityKey).get()
  if (!entitySnap.exists) {
    throw new AdSettingsError(`목록에 없는 대상입니다: ${input.entityKey}`, 404)
  }
  const entity = entitySnap.data() as AdEntityDoc
  if (input.conversionGoal) {
    const goal = await goalsCol().doc(input.conversionGoal).get()
    if (!goal.exists) {
      throw new AdSettingsError(
        `없는 전환 목표입니다: ${input.conversionGoal}`,
        400,
      )
    }
  }
  if (input.creativeSetId) {
    const set = await creativeSetsCol().doc(input.creativeSetId).get()
    if (!set.exists) {
      throw new AdSettingsError(
        `없는 소재 셋입니다: ${input.creativeSetId}`,
        400,
      )
    }
  }

  const id = versionId(input.entityKey, input.effectiveFrom)
  const ref = versionsCol().doc(id)
  const now = Date.now()
  const doc = await db.runTransaction(async (tx) => {
    const prev = await tx.get(ref)
    const next: AdSettingVersionDoc = {
      ...input,
      channel: entity.channel,
      level: entity.level,
      platformId: entity.platformId,
      createdAt: prev.exists
        ? (prev.data() as AdSettingVersionDoc).createdAt
        : now,
      updatedAt: now,
    }
    tx.set(ref, next)
    return next
  })
  return { id, ...doc }
}

export async function deleteVersion(id: string): Promise<boolean> {
  const ref = versionsCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}

/** 전환 목표 추가·수정 — key는 영문 소문자(설정 기록에 그대로 남는다). 안 쓰는
 * 목표는 지우지 않고 archived로 숨긴다(이미 붙은 기록이 있어서). */
export async function saveGoal(
  key: string,
  input: ConversionGoalInput,
): Promise<ConversionGoal> {
  const doc: ConversionGoalDoc = { ...input, updatedAt: Date.now() }
  await goalsCol().doc(key).set(doc)
  return { key, ...doc }
}

export async function saveCreativeSet(
  id: string | null,
  input: CreativeSetInput,
): Promise<CreativeSet> {
  const now = Date.now()
  if (id === null) {
    const doc: CreativeSetDoc = { ...input, createdAt: now, updatedAt: now }
    const ref = await creativeSetsCol().add(doc)
    return { id: ref.id, ...doc }
  }
  const ref = creativeSetsCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new AdSettingsError('없는 소재 셋입니다', 404)
  const doc: CreativeSetDoc = {
    ...input,
    createdAt: (snap.data() as CreativeSetDoc).createdAt,
    updatedAt: now,
  }
  await ref.set(doc)
  return { id, ...doc }
}

/** 설정 기록에 붙어 있는 셋은 지우지 않는다(지난 구간의 소재를 잃는다). */
export async function deleteCreativeSet(id: string): Promise<boolean> {
  const used = await versionsCol()
    .where('creativeSetId', '==', id)
    .limit(1)
    .get()
  if (!used.empty) {
    throw new AdSettingsError(
      '설정 기록에서 쓰는 소재 셋은 지울 수 없습니다',
      409,
    )
  }
  const ref = creativeSetsCol().doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}

/** 테스트 저장 — 대상마다 하나(문서 ID = 대상 키)라 같은 대상이면 고친다. 대상은
 * 목록(adEntities)에 있어야 한다. 구간은 시작일 순으로 정리해 둔다. */
export async function saveTest(input: AdTestInput): Promise<AdTest> {
  const entitySnap = await adEntitiesCol().doc(input.entityKey).get()
  if (!entitySnap.exists) {
    throw new AdSettingsError(`목록에 없는 대상입니다: ${input.entityKey}`, 404)
  }
  const entity = entitySnap.data() as AdEntityDoc
  const ref = testsCol().doc(input.entityKey)
  const now = Date.now()
  const doc = await db.runTransaction(async (tx) => {
    const prev = await tx.get(ref)
    const next: AdTestDoc = {
      ...input,
      segments: [...input.segments].sort(
        (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
      ),
      channel: entity.channel,
      level: entity.level,
      platformId: entity.platformId,
      entityName: entity.name,
      createdAt: prev.exists ? (prev.data() as AdTestDoc).createdAt : now,
      updatedAt: now,
    }
    tx.set(ref, next)
    return next
  })
  return { id: input.entityKey, ...doc }
}

export async function deleteTest(entityKey: string): Promise<boolean> {
  const ref = testsCol().doc(entityKey)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}
