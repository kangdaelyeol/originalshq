import { Linking } from 'react-native';

// 전화 걸기 — 목록의 전화 단추·상세 전화 링크가 같이 쓴다. 칸에 번호가 둘 적힌 건("010-… / 02-…", 출장업무 이름 뒤 번호
// 여럿)도 있어서 숫자를 통째로 이어 붙이지 않고 첫 번호만 건다.

// 숫자 9~12자리에 -·.·공백·괄호가 섞인 덩어리(monday-values PHONE_IN_TEXT와 같은 모양)
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{7,}\d/g;

/** 걸 번호(숫자와 +만) — 글에서 첫 전화번호, 없으면 글의 숫자 전부. 숫자가 없으면 null */
export function dialNumber(text: string | null | undefined): string | null {
  const value = text ?? '';
  for (const found of value.match(PHONE_IN_TEXT) ?? []) {
    const count = found.replace(/\D/g, '').length;
    if (count >= 9 && count <= 12) return found.replace(/[^\d+]/g, '');
  }
  const all = value.replace(/[^\d+]/g, '');
  return /\d/.test(all) ? all : null;
}

/** 전화 앱으로 — 걸 번호가 없으면 아무것도 하지 않는다 */
export function callPhone(text: string | null | undefined): void {
  const number = dialNumber(text);
  if (number) Linking.openURL(`tel:${number}`).catch(() => undefined);
}
