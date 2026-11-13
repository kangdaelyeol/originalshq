import { Clipboard, LogBox } from 'react-native';
import { pushToast } from '@xtool-core/tech-save-queue';

// 글 복사 — 출장업무 전화번호·설치 품목 시트의 주소를 누르면(2026-11-13) 복사하고 토스트로 알린다. 모든 레이아웃이
// 같이 쓴다. RN 기본 Clipboard는 "따로 떼어 낼 예정"이라고 처음 한 번 경고하지만 0.88에도 iOS 모듈(RCTClipboard)이
// 들어 있어 앱을 다시 빌드하지 않고 쓴다. 기본에서 빠지면 여기만 @react-native-clipboard/clipboard로 바꾼다.

LogBox.ignoreLogs(['Clipboard has been extracted']);

/** 복사하고 "{title}" 토스트(복사한 글을 아래에) — 빈 글이면 아무것도 하지 않는다 */
export function copyText(text: string | null | undefined, title: string): void {
  const value = (text ?? '').trim();
  if (!value) return;
  Clipboard.setString(value);
  pushToast({ tone: 'success', title, message: value });
}
