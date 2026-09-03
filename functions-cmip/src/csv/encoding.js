/**
 * 인코딩 감지 — Python `_read_text` 이관.
 *
 * 절대 규칙(과거 버그): UTF-16 BOM CSV를 CP949가 "그럴듯하게" 디코딩해 오탐한다.
 * 따라서 BOM을 먼저 본다. cp949/euc-kr 는 Node 내장 TextDecoder('euc-kr')로 처리
 * (full-icu 기본 탑재 — WHATWG 'euc-kr' 디코더가 CP949/UHC 상위집합을 커버).
 *
 * @param {Buffer|Uint8Array} raw
 * @returns {string}
 */
export function readText(raw) {
	const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
	let txt;

	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		txt = new TextDecoder('utf-16le').decode(bytes.subarray(2));
	} else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		txt = new TextDecoder('utf-16be').decode(bytes.subarray(2));
	} else if (
		bytes.length >= 3 &&
		bytes[0] === 0xef &&
		bytes[1] === 0xbb &&
		bytes[2] === 0xbf
	) {
		txt = new TextDecoder('utf-8').decode(bytes.subarray(3));
	} else {
		// Python 순서: utf-8-sig → utf-8 → utf-16 → cp949 → euc-kr → latin-1
		const order = ['utf-8', 'utf-16le', 'euc-kr'];
		let decoded = null;
		for (const enc of order) {
			try {
				decoded = new TextDecoder(enc, { fatal: true }).decode(bytes);
				break;
			} catch {
				/* 다음 인코딩 시도 */
			}
		}
		txt = decoded ?? new TextDecoder('windows-1252').decode(bytes); // latin-1 대체(비-fatal)
	}

	return txt
		.replace(/﻿/g, '')
		.replace(/\x00/g, '')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n');
}
