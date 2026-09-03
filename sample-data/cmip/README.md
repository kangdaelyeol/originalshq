# cmip 샘플 데이터

CSV 임포트 → 리포트 생성까지 손으로 돌려보기 위한 매체별 샘플 CSV.

| 파일                               | 매체                                   | 기간               | 행  |
| ---------------------------------- | -------------------------------------- | ------------------ | --- |
| `meta_2026-08-04_2026-09-02.csv`   | 메타 (광고세트 단위, `결과 유형`=구매) | 2026-08-04 ~ 09-02 | 30  |
| `naver_2026-08-04_2026-09-02.csv`  | 네이버 검색광고 (일별)                 | 〃                 | 30  |
| `google_2026-08-04_2026-09-02.csv` | 구글 (`캠페인 상태` 포함)              | 〃                 | 30  |
| `daangn_2026-08-04_2026-09-02.csv` | 당근 (`기간`+`캠페인 ID`)              | 〃                 | 30  |

- 헤더는 각 매체 실제 리포트 컬럼명이라 임포터가 **자동 감지**한다(수동 선택 불필요).
- 30일치 일별 데이터라 리포트가 "학습 초기(운영 7일 이하)"로 빠지지 않고, 직전 기간 비교·주차 추이·요일별 성과가 전부 채워진다.
- 완만한 우상향 추세 + 요일 효과를 넣어서 "전기 대비 +N%" 서술이 나오게 했다.
- 매출 컬럼이 있어 ROAS/통합 매출 경로까지 탄다. `commerceChannels`는 비어 있으므로 블렌디드는 비활성(매체 리포트 매출을 그대로 사용).

숫자를 바꾸고 싶으면 `generate.mjs`를 고쳐 다시 실행:

```bash
node sample-data/cmip/generate.mjs
```

---

## 돌려보는 순서

전제: functions-cmip이 배포되어 있거나 에뮬레이터가 떠 있어야 한다.
클라이언트 기본 베이스 URL은 `asia-northeast3-xtool-63b29.cloudfunctions.net`
(`src/screens/xtool-lead-manager/constants.ts`의 `CMIP_API_BASE`).

### 1. 브랜드 문서 (선택 — 이름/KPI를 지정하고 싶을 때만)

`importCsv`가 임포트 시 `brands/{brandId}` stub 문서를 자동 생성하므로(`ensureBrandDoc`),
2번만 해도 리포트가 된다. 이름·`mainKpi`·`commerceChannels`를 실제 값으로 넣고 싶으면
먼저 `upsertBrand`로 만들거나(임포트 후 갱신도 가능):

```bash
curl -X POST https://asia-northeast3-xtool-63b29.cloudfunctions.net/upsertBrand \
  -H 'Content-Type: application/json' \
  -d '{"brandId":"demo","name":"데모 브랜드","industry":"커머스","mainKpi":"ROAS"}'
```

(또는 Firestore 콘솔에서 `brands/demo` 문서를 직접 수정:
`name`, `industry`, `mainKpi`(CPA|ROAS|DB), `commerceChannels`(빈 배열), `memo`.)

### 2. CSV 임포트 (cmip 화면 상단 CsvImporter)

1. **브랜드 ID**에 `demo` 입력
2. 위 CSV 4개를 드롭존에 끌어놓기 — 매체가 자동 감지되는지 확인
3. **미리보기** → 행 수/기간/경고 확인 (경고 0이어야 정상)
4. **가져오기** → "120행 저장 완료"

### 3. 리포트 생성 (cmip 화면 하단 ReportGenerator)

1. **브랜드 ID** `demo`
2. **보고서 종류** 주간
3. **시작일/종료일**은 비워두면 최근 7일(2026-08-27 ~ 09-02, 어제까지)로 자동
   - 월간을 보려면 종류를 월간으로 두고 역시 비워두면 최근 30일
4. (선택) 매체 운영 현황 / 다음 기간 계획 메모 입력
5. **보고서 생성** → KPI 카드 + 번호 매긴 섹션들이 표시됨

> 참고: 대시보드(BrandDashboard)의 MORTAR SCORE·알림은 브랜드 문서 없이도 조회되지만,
> 알림을 채우려면 "이상 징후 재검사"를 한 번 눌러라.
