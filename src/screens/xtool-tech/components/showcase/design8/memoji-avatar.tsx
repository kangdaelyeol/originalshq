/**
 * 프로필 사진 대신 그린 얼굴 — 영상의 미모지(짧은 검은 머리·덥수룩한 수염·남색 셔츠)를
 * 같은 색으로 옮긴 SVG(F1 접힌 아바타 6배 확대에서 색을 뽑았다). 사진 파일을 더 들이지 않으려고 그렸다.
 */
export function MemojiAvatar() {
  return (
    <svg className="d8-avatar__face" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#efe1d8" />
      {/* 어깨·목 */}
      <path d="M5 40c1.2-7.2 7-10.3 15-10.3S33.8 32.8 35 40z" fill="#2c2b3a" />
      <path d="M16.8 25.5h6.4v5.6c-1 .9-2.1 1.3-3.2 1.3s-2.2-.4-3.2-1.3z" fill="#c98f76" />
      {/* 귀·얼굴 */}
      <ellipse cx="12.9" cy="18.9" rx="1.3" ry="1.9" fill="#d9a088" />
      <ellipse cx="27.1" cy="18.9" rx="1.3" ry="1.9" fill="#d9a088" />
      <ellipse cx="20" cy="18.6" rx="7" ry="8.4" fill="#e4b199" />
      {/* 머리카락 */}
      <path
        d="M12.7 17.2c-.6-5.6 2.6-9 7.3-9 4.8 0 8 3.4 7.3 9-.8-3-3-4.5-7.3-4.4-4.3-.1-6.5 1.4-7.3 4.4z"
        fill="#2a2320"
      />
      {/* 수염 */}
      <path
        d="M13 18.9c.2 6.3 2.6 10.6 7 10.8 4.4-.2 6.8-4.5 7-10.8-.9 2.9-2.7 4.3-7 4.4-4.3-.1-6.1-1.5-7-4.4z"
        fill="#2b221d"
      />
      <path d="M17.9 24.9c1.4.6 2.8.6 4.2 0" stroke="#7a5446" strokeWidth=".7" strokeLinecap="round" fill="none" />
      {/* 눈·눈썹·코 */}
      <circle cx="17.2" cy="18" r=".75" fill="#2a2320" />
      <circle cx="22.8" cy="18" r=".75" fill="#2a2320" />
      <path d="M15.8 16.2c.8-.5 1.9-.6 2.8-.3M21.4 15.9c.9-.3 2-.2 2.8.3" stroke="#2a2320" strokeWidth=".8" strokeLinecap="round" fill="none" />
      <path d="M20 19.2v2.1l-.9.4" stroke="#c48a73" strokeWidth=".7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}
