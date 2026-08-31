# TODO List

## Contents

[Meta CAPI 이벤트 dedup 및 장애 대응](#meta-capi-이벤트-dedup-및-장애-대응)

[리드 관리 API 전반 보완](#리드-관리-api-전반-보완)

---

## Meta CAPI 이벤트 dedup 및 장애 대응

### 1. [P0] event_id 추가 (Meta 측 이중 집계 방지)

- sendMetaEvent payload에 event_id 필드 추가
- 생성 규칙: sha256(`${leadId}-${eventName}`) 형태로 결정론적 생성
- 대상: contactLead, purchaseLead
- 목적: 클라이언트 재시도로 같은 이벤트가 두 번 전송돼도 Meta가 자동 dedup 하도록

### 2. [P1] Firestore update 실패 시 재시도 로직 추가

- Meta 전송 성공 후 docRef.update() 실패하는 경우를 커버
- updateWithRetry 같은 짧은 backoff 재시도 wrapper 도입 (예: 3회, 200ms 간격)
- 대상: contactLead, purchaseLead (state/externalId 업데이트 구간)

### 3. [P1] 재시도까지 실패하면 CRITICAL 로그 남기기

- "Meta 전송 성공 + DB 반영 실패" 케이스를 구분해서 로그
- Cloud Logging에서 필터링 가능하도록 심각도(severity)나 태그 통일
- 목적: 수동 복구 대상 리드를 빠르게 찾기 위함

### 4. [P2, 보류] DB 먼저 커밋 → Meta 전송 순서로 구조 변경 검토

- 현재는 Meta 먼저 → DB 나중 순서라 "Meta 성공, DB 실패" 애매한 상태 발생 가능
- 순서를 뒤집으면 반대로 "DB 성공, Meta 실패"만 남는데 이건 재전송 큐 등으로 다루기 쉬움
- 트래픽 늘어나거나 1~3번으로 문제가 실제 반복되면 그때 착수

## 리드 관리 API 전반 보완

### 1. [P0] 인증/인가 부재

- 1-1. Firebase Auth ID 토큰 검증 미들웨어 작성 (Authorization 헤더 파싱 → verifyIdToken)
- 1-2. 미들웨어를 모든 onRequest 핸들러 공통으로 적용할 방식 결정 (wrapper 함수 vs 각 핸들러 상단 삽입)
- 1-3. deleteLead, purchaseLead부터 우선 적용 (가장 위험한 두 엔드포인트)
- 1-4. 나머지 엔드포인트(createLead, contactLead, updateLead\*)에 순차 적용
- 1-5. 프론트(leadClient)에서 요청 시 Authorization 헤더 실어 보내도록 수정
- 1-6. 인증 실패 시 401 응답 케이스 테스트

### 2. [P0] state 체크-업데이트 레이스 컨디션

- 2-1. contactLead: get → state 검증 → update를 runTransaction으로 묶기
- 2-2. purchaseLead: 동일하게 runTransaction 적용
- 2-3. 트랜잭션 내부에서 sendMetaEvent(외부 API 호출)를 어떻게 뺄지 설계 (트랜잭션 안에서 외부 fetch 호출은 지양해야 함 → "먼저 트랜잭션으로 state만 선점 → 트랜잭션 밖에서 Meta 전송 → 실패 시 롤백" 구조로 설계)
- 2-4. 동시 요청 2개로 실제 재현 테스트 (로컬 emulator에서 Promise.all로 동시 호출)
- 2-5. 롤백 시나리오(Meta 전송 실패 후 state 원복) 처리 로직 작성

### 3. [P1] updateLeadTimestamp의 field 화이트리스트 확인

- 3-1. validation.ts에서 validateUpdateTimestamp 구현 확인
- 3-2. field가 리터럴 유니온('createdAt' | 'purchasedAt')으로 타입/런타임 둘 다 제한되는지 확인
- 3-3. 화이트리스트 없다면 추가
- 3-4. externalId, state 등 민감 필드로 호출 시 400 거부되는지 테스트 케이스 작성

### 4. [P1] listLeads 페이지네이션

- 4-1. 커서 기반 페이지네이션 API 설계 (limit, startAfter 파라미터 정의)
- 4-2. listLeads 쿼리에 .limit() 적용, 기본값 결정 (예: 50)
- 4-3. 응답에 nextCursor(또는 마지막 문서 createdAt) 포함
- 4-4. 프론트 목록 화면에 "더 보기"/무한스크롤 또는 페이지 버튼 연동
- 4-5. 기존 전체 조회에 의존하는 다른 코드(있다면) 확인 후 마이그레이션

### 5. [P2] device/price 수정과 Meta 전송값 불일치

- 5-1. 실제로 이 문제가 비즈니스에 영향 있는지 먼저 확인 (구매 후 device/price 수정이 실제로 발생하는 케이스인지 운영팀 확인)
- 5-2. 영향 있다면: updateLeadDevice/updateLeadPrice에 state === 'purchased' 체크 추가할지 결정
- 5-3. 수정 이력을 남길지 결정 (별도 history 서브컬렉션 or 필드)
- 5-4. 결정된 방향대로 구현 및 응답 메시지에 경고 문구 추가

### 6. [P2] deleteLead 하드 삭제

- 6-1. 소프트 삭제로 전환할지 정책 결정 (감사/정산 요구사항 있는지 확인)
- 6-2. 소프트 삭제 결정 시: Lead 타입에 deletedAt 필드 추가
- 6-3. deleteLead 로직을 docRef.delete() → docRef.update({ state: 'deleted', deletedAt }) 로 변경
- 6-4. listLeads가 삭제된 리드를 기본적으로 제외하도록 쿼리 수정
- 6-5. purchased 상태 리드 삭제 시도 시 추가 확인/차단 로직 필요 여부 결정

### 7. [P2, 보류] 동일 전화번호 중복 리드 생성 방지

- 7-1. 의도된 동작인지 비즈니스 측 확인 (보류 해제 조건)
- 7-2. 확인 후 진행 시: getLeadByPh 쿼리 함수 구현 (앞서 논의한 where('ph','==',ph) 방식)
- 7-3. createLead에 사전 체크 삽입 여부 결정
- 7-4. 레이스 컨디션 방지 필요 시 ph를 문서 id로 쓰는 구조로 전환 검토 (스키마 변경 범위 큼 - 별도 논의 필요)
