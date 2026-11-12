const path = require('path');

// 앱 안 네이티브 모듈 — node_modules에 없는 것도 자동 연결(pod install)과 codegen이 찾게 여기 적는다.
module.exports = {
  dependencies: {
    // 신규 문의 알림(APNs 직접) — modules/xtool-push
    'xtool-push': { root: path.join(__dirname, 'modules/xtool-push') },
  },
};
