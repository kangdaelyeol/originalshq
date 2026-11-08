import { shortDate } from '@xtool-core/dates';

// 보드 정의가 같이 쓰는 작은 것.

/** 빈 값을 뺀 글 조각 */
export const pieces = (...values: (string | null | undefined | false | 0)[]): string[] =>
  values.filter((v): v is string => typeof v === 'string' && v.trim() !== '');

/** 날짜가 있으면 '접수 11/2' 같은 조각 */
export const dated = (label: string, date: string | null | undefined, today: string): string | null =>
  date ? `${label} ${shortDate(date, today)}` : null;

/** 날짜가 있을 때만 짧은 날짜(없으면 null — 상세의 '—') */
export const dateOrNull = (date: string | null | undefined, today: string): string | null =>
  date ? shortDate(date, today) : null;

/** 이름이 비었으면 '(이름 없음)' */
export const nameOf = (name: string | null | undefined): string => name || '(이름 없음)';
