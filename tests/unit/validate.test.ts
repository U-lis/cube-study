import { describe, it, expect } from 'vitest';
import { lookup, sanitize, targetStickers, reasonText } from '../../src/lib/domain/validate.js';
import dataJson from '../../src/lib/data/corner-UBL.json';
import type { Dataset } from '../../src/lib/domain/types.js';

const ds = dataJson as unknown as Dataset;
const SPEFFZ = [...'ABCDEFGHIJKLMNOPQRSTUVWX'];

describe('sanitize', () => {
	it('소문자 대문자화', () => expect(sanitize('lb')).toBe('LB'));
	it('Speffz 밖 문자 제거', () => expect(sanitize('L1B')).toBe('LB'));
	it('한글 제거', () => expect(sanitize('ㄹㅠ')).toBe(''));
	it('Y/Z 제거', () => expect(sanitize('YZ')).toBe(''));
	it('3글자 이상은 2글자로', () => expect(sanitize('LBX')).toBe('LB'));
});

describe('lookup 기본', () => {
	it('빈 입력', () => expect(lookup(ds, '').status).toBe('empty'));
	it('LB 유효', () => {
		const r = lookup(ds, 'LB');
		expect(r.status).toBe('valid');
		if (r.status === 'valid') expect(r.entry.case).toBe('LB');
	});
	it('대소문자 무시', () => expect(lookup(ds, 'lb').status).toBe('valid'));
	it('혼합 대소문자', () => expect(lookup(ds, 'Lb').status).toBe('valid'));
});

describe('1글자 후보', () => {
	it('모든 타깃 문자가 후보 18개', () => {
		for (const s of targetStickers(ds)) {
			const r = lookup(ds, s);
			expect(r.status).toBe('partial');
			if (r.status === 'partial') expect(r.candidates).toHaveLength(18);
		}
	});
});

describe('무효 사유', () => {
	it('버퍼 스티커 (A/E/R)', () => {
		for (const b of ['A', 'E', 'R']) {
			const r = lookup(ds, b + 'B');
			expect(r.status).toBe('invalid');
			if (r.status === 'invalid') expect(r.reason.kind).toBe('buffer');
		}
	});
	it('AA 는 same-letter 가 아니라 buffer', () => {
		const r = lookup(ds, 'AA');
		if (r.status === 'invalid') expect(r.reason.kind).toBe('buffer');
	});
	it('같은 글자 BB', () => {
		const r = lookup(ds, 'BB');
		if (r.status === 'invalid') expect(r.reason.kind).toBe('same-letter');
	});
	it('동일 큐비 BN (UBR)', () => {
		const r = lookup(ds, 'BN');
		expect(r.status).toBe('invalid');
		if (r.status === 'invalid' && r.reason.kind === 'same-cubie')
			expect(r.reason.cubie).toBe('UBR');
	});
	it('동일 큐비 CM (UFR)', () => {
		const r = lookup(ds, 'CM');
		if (r.status === 'invalid' && r.reason.kind === 'same-cubie')
			expect(r.reason.cubie).toBe('UFR');
	});
});

describe('전수 576 조합', () => {
	it('유효 378 / 무효 198 (buffer 135, same-letter 21, same-cubie 42)', () => {
		let valid = 0;
		const kinds: Record<string, number> = { buffer: 0, 'same-letter': 0, 'same-cubie': 0 };
		for (const x of SPEFFZ)
			for (const y of SPEFFZ) {
				const r = lookup(ds, x + y);
				if (r.status === 'valid') valid++;
				else if (r.status === 'invalid') kinds[r.reason.kind]++;
			}
		expect(valid).toBe(378);
		expect(kinds.buffer).toBe(135);
		expect(kinds['same-letter']).toBe(21);
		expect(kinds['same-cubie']).toBe(42);
	});

	it('378 케이스 전부 조회 가능', () => {
		for (const code of Object.keys(ds.cases)) {
			const r = lookup(ds, code);
			expect(r.status).toBe('valid');
		}
	});
});

describe('reasonText (NFR-7: 코드는 영문)', () => {
	it('버퍼 문구', () => {
		expect(reasonText({ kind: 'buffer', sticker: 'A', cubie: 'UBL' })).toBe(
			'A는 버퍼(UBL) 스티커라 케이스에 등장하지 않습니다'
		);
	});
	it('동일 큐비 문구', () => {
		expect(reasonText({ kind: 'same-cubie', a: 'B', b: 'N', cubie: 'UBR' })).toBe(
			'B와 N은 같은 큐비(UBR)라 3-cycle이 아닙니다'
		);
	});
	it('조사: 받침 있는 글자', () => {
		expect(reasonText({ kind: 'buffer', sticker: 'R', cubie: 'UBL' })).toBe(
			'R은 버퍼(UBL) 스티커라 케이스에 등장하지 않습니다'
		);
		expect(reasonText({ kind: 'same-cubie', a: 'L', b: 'G', cubie: 'DFL' })).toBe(
			'L과 G는 같은 큐비(DFL)라 3-cycle이 아닙니다'
		);
	});
	it('378 케이스 전체에서 조사가 자연스러운가 (F L M N R S X 만 받침)', () => {
		for (const s of [...'ABCDEFGHIJKLMNOPQRSTUVWX']) {
			const t = reasonText({ kind: 'buffer', sticker: s, cubie: 'UBL' });
			const expected = 'FLMNRSX'.includes(s) ? `${s}은 ` : `${s}는 `;
			expect(t.startsWith(expected)).toBe(true);
		}
	});
});
