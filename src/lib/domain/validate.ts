/**
 * 케이스 코드 입력 검증.
 *
 * 전체 24x24 = 576 조합 중 유효 378 / 무효 198.
 * 무효 내역: 버퍼 스티커 포함 135 + 같은 글자 21 + 서로 다른 동일 큐비 42.
 *
 * 문자열을 만들지 않는다. UI 가 reason 을 받아 문장으로 조립한다.
 */

import type { CaseCode, CaseEntry, Cubie, Dataset, Sticker } from './types.js';

export type InvalidReason =
	| { kind: 'buffer'; sticker: Sticker; cubie: Cubie }
	| { kind: 'same-letter'; sticker: Sticker }
	| { kind: 'same-cubie'; a: Sticker; b: Sticker; cubie: Cubie };

export type LookupResult =
	| { status: 'empty' }
	| { status: 'partial'; letter: Sticker; candidates: CaseCode[] }
	| { status: 'valid'; entry: CaseEntry }
	| { status: 'invalid'; reason: InvalidReason };

/** Speffz 범위. 이 밖의 문자는 입력 단계에서 걸러진다. */
export const SPEFFZ = 'ABCDEFGHIJKLMNOPQRSTUVWX';

export function isSpeffz(ch: string): boolean {
	return SPEFFZ.includes(ch);
}

/** 입력 문자열에서 Speffz 문자만 남기고 대문자 2글자로 자른다. */
export function sanitize(input: string): string {
	return [...input.toUpperCase()].filter(isSpeffz).join('').slice(0, 2);
}

/** 버퍼를 제외한 21개 스티커 */
export function targetStickers(ds: Dataset): Sticker[] {
	const buf = new Set(ds.meta.bufferStickers);
	return [...SPEFFZ].filter((s) => !buf.has(s));
}

export function lookup(ds: Dataset, input: string): LookupResult {
	const code = sanitize(input);
	if (code.length === 0) return { status: 'empty' };

	const buf = new Set(ds.meta.bufferStickers);
	const [a, b] = [code[0], code[1]];

	// 버퍼 판정이 가장 근본적이므로 먼저 본다 (AA 는 same-letter 가 아니라 buffer).
	if (buf.has(a)) return { status: 'invalid', reason: { kind: 'buffer', sticker: a, cubie: ds.stickers[a].cubie } };

	if (code.length === 1) {
		const candidates = Object.keys(ds.cases)
			.filter((k) => k[0] === a)
			.sort();
		return { status: 'partial', letter: a, candidates };
	}

	if (buf.has(b)) return { status: 'invalid', reason: { kind: 'buffer', sticker: b, cubie: ds.stickers[b].cubie } };
	if (a === b) return { status: 'invalid', reason: { kind: 'same-letter', sticker: a } };

	const ca = ds.stickers[a].cubie;
	const cb = ds.stickers[b].cubie;
	if (ca === cb) return { status: 'invalid', reason: { kind: 'same-cubie', a, b, cubie: ca } };

	const entry = ds.cases[code];
	// 위 세 조건을 통과하면 반드시 존재한다. 방어적으로만 확인한다.
	if (!entry) return { status: 'invalid', reason: { kind: 'same-cubie', a, b, cubie: ca } };
	return { status: 'valid', entry };
}

/**
 * 영문자를 한국어로 읽었을 때 받침이 있는 글자.
 * F(에프) L(엘) M(엠) N(엔) R(알) S(에스) X(엑스)
 */
const HAS_FINAL = new Set(['F', 'L', 'M', 'N', 'R', 'S', 'X']);

/** 스티커 문자 뒤에 붙일 조사를 고른다. */
export function josa(sticker: Sticker, pair: '은는' | '와과' | '이가'): string {
	const final = HAS_FINAL.has(sticker);
	switch (pair) {
		case '은는':
			return final ? '은' : '는';
		case '와과':
			return final ? '과' : '와';
		case '이가':
			return final ? '이' : '가';
	}
}

/** 무효 사유를 한국어 문장으로. 큐브 표기와 코드는 영문 그대로 둔다 (NFR-7). */
export function reasonText(reason: InvalidReason): string {
	switch (reason.kind) {
		case 'buffer':
			return `${reason.sticker}${josa(reason.sticker, '은는')} 버퍼(${reason.cubie}) 스티커라 케이스에 등장하지 않습니다`;
		case 'same-letter':
			return `같은 스티커 두 개는 3-cycle이 아닙니다`;
		case 'same-cubie':
			return `${reason.a}${josa(reason.a, '와과')} ${reason.b}${josa(reason.b, '은는')} 같은 큐비(${reason.cubie})라 3-cycle이 아닙니다`;
	}
}

/** 타깃 위치 표기: `L = DFL의 F면` */
export function targetText(t: { sticker: Sticker; cubie: Cubie; face: string }): string {
	return `${t.sticker} = ${t.cubie}의 ${t.face}면`;
}
