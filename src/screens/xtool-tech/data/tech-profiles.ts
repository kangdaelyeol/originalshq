import { Bytes, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { xtoolFirebase } from '@/xtool-auth/firebase'
import { normalizeEmail } from '@/xtool-auth/members'
import { useMondayUsers } from './tech-boards-store'

// 프로필 사진(설정 > 프로필 사진) — 본인이 올리고, 팀 모두가 담당자 동그라미 등에서 본다.
// 사진은 화면에서 정사각형으로 잘라 작게 줄여 xtoolProfiles/{이메일}에 bytes로 넣는다(규칙이
// 본인 문서만·100KB 아래만 허락). 팀이 수십 명이라 목록째 실시간으로 받는다.

const PROFILES = 'xtoolProfiles'
/** 저장할 사진 한 변(px) — 표의 동그라미(28px)를 레티나로 넉넉히 */
const SIDE = 192
/** 규칙 한도(100KB)보다 조금 작게 */
const MAX_BYTES = 90 * 1024
export const PROFILE_ACCEPT = 'image/jpeg,image/png,image/webp'

interface Profile {
  email: string
  name: string
  url: string
}

let profiles: ReadonlyMap<string, Profile> | null = null
let unsubscribe: (() => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function ensureProfiles() {
  if (unsubscribe) return
  unsubscribe = onSnapshot(
    collection(xtoolFirebase().db, PROFILES),
    (snap) => {
      profiles = new Map(
        snap.docs
          .map((d) => d.data())
          .filter((data) => data.photo instanceof Bytes)
          .map((data) => {
            const email = String(data.email ?? '')
            const url = `data:${String(data.photoType ?? 'image/webp')};base64,${(data.photo as Bytes).toBase64()}`
            return [email, { email, name: String(data.name ?? ''), url }] as const
          }),
      )
      emit()
    },
    () => {
      // 권한이 없거나(로그인 전) 끊기면 사진 없이 그리고, 다음에 다시 구독한다.
      unsubscribe?.()
      unsubscribe = null
    },
  )
}

const useProfiles = () => {
  useEffect(() => ensureProfiles(), [])
  return useSyncExternalStore(subscribe, () => profiles)
}

/** 내 사진(이메일로) */
export function useProfilePhoto(email: string | null | undefined): string | undefined {
  const all = useProfiles()
  return email ? all?.get(normalizeEmail(email))?.url : undefined
}

/**
 * 이름 → 사진. 표의 담당자 칸은 Monday 사용자 이름이라 Monday 사용자 이메일로 잇고, 없으면
 * 구성원 이름(사진을 올릴 때 남긴 이름)으로 찾는다.
 */
export function usePhotoOf(): (name: string) => string | undefined {
  const all = useProfiles()
  const users = useMondayUsers()
  return useMemo(() => {
    const byName = new Map<string, string>()
    for (const profile of all?.values() ?? []) if (profile.name) byName.set(profile.name, profile.url)
    for (const user of users ?? []) {
      const url = all?.get(normalizeEmail(user.email))?.url
      if (url) byName.set(user.name, url)
    }
    return (name: string) => byName.get(name)
  }, [all, users])
}

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** 가운데를 정사각형으로 잘라 SIDE로 줄인다 — webp(안 되면 jpeg), 한도 안에 들 때까지 화질을 낮춘다. */
async function squarePhoto(file: File): Promise<Blob> {
  if (!PROFILE_ACCEPT.split(',').includes(file.type)) throw new Error('JPG·PNG·WEBP 사진만 올릴 수 있어요')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('사진을 열지 못했어요')
  })
  try {
    const crop = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = SIDE
    canvas.height = SIDE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이 브라우저에서는 사진을 줄일 수 없어요')
    context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, SIDE, SIDE)
    for (const quality of [0.86, 0.74, 0.6]) {
      const blob = (await canvasBlob(canvas, 'image/webp', quality)) ?? (await canvasBlob(canvas, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_BYTES) return blob
    }
    throw new Error('사진을 줄이지 못했어요')
  } finally {
    bitmap.close()
  }
}

/** 내 프로필 사진 올리기(바꾸기) */
export async function uploadProfilePhoto(file: File, me: { email: string; name: string }): Promise<void> {
  const blob = await squarePhoto(file)
  const email = normalizeEmail(me.email)
  await setDoc(doc(xtoolFirebase().db, PROFILES, email), {
    email,
    // 규칙이 구성원 이름과 똑같은지 본다 — 다듬지 않고 그대로
    name: me.name,
    photo: Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer())),
    photoType: blob.type,
    updatedAt: serverTimestamp(),
  })
}

/** 내 프로필 사진 지우기 */
export async function deleteProfilePhoto(email: string): Promise<void> {
  await deleteDoc(doc(xtoolFirebase().db, PROFILES, normalizeEmail(email)))
}
