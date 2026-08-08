import { describe, it, expect } from 'vitest';
import { invertAlg, cancelMoves, moveCount } from '../../src/lib/cube/notation.js';

describe('invertAlg', () => {
	it('순서 뒤집기 + 토글', () => {
		expect(invertAlg("R U R' U'")).toBe("U R U' R'");
	});
	it('self-inverse 는 자기 자신 (버그 아님)', () => {
		expect(invertAlg("B' D2 B")).toBe("B' D2 B");
	});
	it('빈 문자열', () => {
		expect(invertAlg('')).toBe('');
	});
});

describe('cancelMoves', () => {
	it('인접 상쇄', () => {
		expect(cancelMoves("R R' U")).toBe('U');
	});
	it('같은 방향 합산', () => {
		expect(cancelMoves("F' F' U")).toBe('F2 U');
	});
	it('연쇄 상쇄로 완전 소거', () => {
		expect(cancelMoves("R U U' R'")).toBe('');
	});
	it('U + U = U2', () => {
		expect(cancelMoves('U U R')).toBe('U2 R');
	});
});

describe('moveCount', () => {
	it('빈 문자열은 0', () => {
		expect(moveCount('')).toBe(0);
	});
	it('공백 정규화', () => {
		expect(moveCount("  R   U  R'  ")).toBe(3);
	});
});
