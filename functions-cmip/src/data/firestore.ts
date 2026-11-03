/**
 * Firestore 접근 — cmip 함수가 같이 쓰는 db 하나. xtool과 같은 프로젝트의
 * 'xtool-read' 데이터베이스다. 컬렉션은 각 모듈(channel/*, cafe24, ad-settings,
 * creatives …)이 자기 것을 정한다.
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { installCostCounters } from '../trace/cost-trace'

if (getApps().length === 0) initializeApp()

export const db = getFirestore('xtool-read')
// API 비용 추적 — Firestore 읽기·쓰기와 외부 호출을 요청별로 센다
// (trace/cost-trace.ts). 이 파일이 db를 처음 만드는 곳이라 여기서 한 번.
installCostCounters(db)
