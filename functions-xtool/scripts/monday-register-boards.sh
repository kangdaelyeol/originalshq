#!/usr/bin/env bash
# 동기화할 Monday 보드를 한 번에 등록한다 — 함수 배포 후 한 번만 실행.
# 등록하면 곧바로 그 보드를 한 번 동기화하므로(mondayBoards + mondayItems에
# 저장), 큰 보드는 한 줄에 30초쯤 걸린다. 이미 등록된 보드를 다시 등록해도
# 안전하다(다시 동기화만 한다).
#
#   bash scripts/monday-register-boards.sh
#
# 보드 등록은 관리자만 할 수 있다 — 실행하면 xtool 관리자 이메일·비밀번호를 묻고
# 그 계정으로 로그인해 받은 토큰을 붙여 보낸다(비밀번호 계정만 — Google로만 쓰는
# 관리자는 XTOOL_ID_TOKEN에 토큰을 넣어 실행한다).
#
# 보드를 더하거나 빼려면 아래 목록을 고친다. 빼는 것은 removeMondayBoard.
set -u

API_BASE="${API_BASE:-https://us-central1-xtool-63b29.cloudfunctions.net}"
# 웹 앱 설정(비밀 값이 아니다 — 화면 코드에도 들어 있다)의 apiKey로 로그인한다.
CONFIG="$(dirname "$0")/../../src/xtool-auth/firebase-config.ts"

if [ -z "${XTOOL_ID_TOKEN:-}" ]; then
  read -r -p '관리자 이메일: ' ADMIN_EMAIL
  read -r -s -p '비밀번호: ' ADMIN_PASSWORD
  echo
  API_KEY="$(sed -n "s/.*apiKey: *['\"]\([^'\"]*\)['\"].*/\1/p" "$CONFIG")"
  export ADMIN_EMAIL ADMIN_PASSWORD API_KEY
  XTOOL_ID_TOKEN="$(node -e '
    fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
        process.env.API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
          password: process.env.ADMIN_PASSWORD,
          returnSecureToken: true,
        }),
      },
    )
      .then((res) => res.json())
      .then((body) => {
        if (!body.idToken) {
          console.error("로그인 실패:", body.error?.message ?? "알 수 없는 오류")
          process.exit(1)
        }
        process.stdout.write(body.idToken)
      })
  ')" || exit 1
  unset ADMIN_PASSWORD
fi

BOARDS=(
  "5031196508  F2"
  "5026295471  F2 울트라"
  "5026295498  F2 울트라 UV"
  "5032080241  F1 울트라"
  "5026295481  P3"
  "5026295425  DTF"
  "5031196408  M2"
  "5031196400  O1"
  "5026295489  메탈팹"
  "5027795374  B2B 솔루션"
  "5031373952  기타 온라인 문의"
  "5032280581  앙케이트 문의"
  "5026295939  기타 오프라인"
  "5026295961  방문체험"
  "5027788853  주말 방문체험"
  "5025594137  방문체험 후 만족도 조사"
  "5027377796  오프라인 결제"
  "5025392106  샘플테스트"
)

for entry in "${BOARDS[@]}"; do
  board_id="${entry%% *}"
  label="${entry#*  }"
  printf '%-28s ' "$label"
  # 응답에서 마지막 동기화 결과(lastSync)만 보여준다.
  curl -sS -X POST "$API_BASE/registerMondayBoard" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $XTOOL_ID_TOKEN" \
    -d "{\"boardId\":\"$board_id\"}" |
    node -e '
      let body = ""
      process.stdin.on("data", (chunk) => (body += chunk)).on("end", () => {
        try {
          const { board, error } = JSON.parse(body)
          if (!board) return console.log("실패:", error ?? body)
          const s = board.lastSync
          console.log(
            s.ok
              ? `저장 ${s.itemCount}건 · 삭제 ${s.deletedCount}건 · 번호 없음 ${s.missingPhoneCount}건 · 휴대폰 컬럼 ${board.resolvedPhoneColumnId}`
              : `실패: ${s.error}`,
          )
        } catch {
          console.log("실패:", body.slice(0, 300))
        }
      })
    '
done
