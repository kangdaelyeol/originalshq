// functions-xtool의 모든 함수 — 배포되는 함수 이름은 여기서 내보내는 이름
// 그대로다. 각 함수는 영역별 파일(endpoints/)에 있고, 공통 준비물(DB·시크릿)은
// app.ts, HTTP 공통 껍데기(CORS·메서드·입력 검사·오류 응답)는 http.ts에 있다.
export * from './endpoints/leads'
export * from './endpoints/lead-records'
export * from './endpoints/monday'
export * from './endpoints/usage-logs'
export * from './endpoints/inquiry'
