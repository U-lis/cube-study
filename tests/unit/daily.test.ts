/**
 * 매일 퀴즈 출제 · 저장 형식 (SPEC FR-DQ).
 */
import { describe, it, expect } from 'vitest';
import {
	buildDailySet,
	DAILY_DEFAULT,
	DAILY_SIZES,
	isAnswered,
	newSession,
	parseSession,
	parseSize
} from '../../src/lib/domain/daily.js';

/** 결정적 난수. 테스트가 확률에 기대지 않게 한다. */
function lcg(seed = 1): () => number {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) % 2 ** 31;
		return s / 2 ** 31;
	};
}

const ALL = ['AB', 'BA', 'CD', 'DC', 'EF', 'FE', 'GH', 'HG', 'IJ', 'JI', 'KL', 'LK'];
const inv = (c: string) => c[1] + c[0];

describe('buildDailySet', () => {
	it('외운 것이 n 개 이상이면 외운 것만 낸다', () => {
		const mem = new Set(['AB', 'CD', 'EF', 'GH', 'IJ', 'KL']);
		const set = buildDailySet(ALL, mem, 5, inv, lcg());
		expect(set).toHaveLength(5);
		expect(set.every((c) => mem.has(c))).toBe(true);
	});

	it('외운 것이 모자라면 전부 내고 나머지를 외우지 않은 것에서 채운다', () => {
		const mem = new Set(['AB', 'CD']);
		const set = buildDailySet(ALL, mem, 6, inv, lcg());
		expect(set).toHaveLength(6);
		expect(set).toContain('AB');
		expect(set).toContain('CD');
		expect(new Set(set).size).toBe(6);
	});

	it('외운 것이 없으면 전부 무작위다', () => {
		const set = buildDailySet(ALL, new Set(), 5, inv, lcg());
		expect(set).toHaveLength(5);
		expect(new Set(set).size).toBe(5);
	});

	it('역쌍을 되도록 같이 내지 않는다', () => {
		// 12개 = 역쌍 6쌍. 6문제면 쌍마다 하나씩으로 채울 수 있다
		for (let seed = 1; seed <= 20; seed++) {
			const set = buildDailySet(ALL, new Set(), 6, inv, lcg(seed));
			expect(set.some((c) => set.includes(inv(c))), `seed ${seed}`).toBe(false);
		}
	});

	it('외운 것 먼저가 역쌍 회피를 이긴다', () => {
		const mem = new Set(['AB', 'BA']);
		const set = buildDailySet(ALL, mem, 5, inv, lcg());
		expect(set).toContain('AB');
		expect(set).toContain('BA');
	});

	it('데이터에 없는 암기 코드는 버린다', () => {
		const set = buildDailySet(ALL, new Set(['ZZ']), 5, inv, lcg());
		expect(set).not.toContain('ZZ');
		expect(set).toHaveLength(5);
	});

	it('전체가 n 보다 적으면 전체를 낸다', () => {
		expect(buildDailySet(['AB', 'BA'], new Set(), 5, inv, lcg()).sort()).toEqual(['AB', 'BA']);
	});
});

describe('문제 수', () => {
	it('5 ~ 20, 기본 10', () => {
		expect(DAILY_SIZES[0]).toBe(5);
		expect(DAILY_SIZES.at(-1)).toBe(20);
		expect(DAILY_SIZES).toHaveLength(16);
		expect(DAILY_DEFAULT).toBe(10);
	});

	it('범위 밖 저장값은 기본값으로 읽는다', () => {
		expect(parseSize('7')).toBe(7);
		for (const raw of [null, '', '4', '21', '7.5', 'x']) expect(parseSize(raw), String(raw)).toBe(10);
	});
});

describe('판 저장', () => {
	it('저장한 판을 그대로 읽는다', () => {
		const s = newSession('2026-10-19', 'setup', ['AB', 'CD']);
		s.answers[0] = { moves: ['R', "U'"], ref: { name: 'GC', inverse: true } };
		s.graded = true;
		expect(parseSession(JSON.stringify(s))).toEqual(s);
	});

	it('모양이 어긋나면 판이 없던 것으로 친다', () => {
		const ok = newSession('2026-10-19', 'direct', ['AB']);
		const bad = [
			null,
			'{',
			JSON.stringify({ ...ok, v: 2 }),
			JSON.stringify({ ...ok, mode: 'x' }),
			JSON.stringify({ ...ok, date: '10/19' }),
			JSON.stringify({ ...ok, answers: [] }),
			JSON.stringify({ ...ok, answers: [{ moves: [1], ref: null }] }),
			JSON.stringify({ ...ok, answers: [{ moves: [], ref: { name: 'GC' } }] }),
			JSON.stringify({ ...ok, graded: 'yes' })
		];
		for (const raw of bad) expect(parseSession(raw), String(raw)).toBeNull();
	});
});

describe('isAnswered', () => {
	it('direct 는 무브가 하나라도 있으면, setup 은 기준을 골라야 답이다', () => {
		expect(isAnswered('direct', { moves: ['R'], ref: null })).toBe(true);
		expect(isAnswered('direct', { moves: [], ref: null })).toBe(false);
		expect(isAnswered('setup', { moves: ['R'], ref: null })).toBe(false);
		expect(isAnswered('setup', { moves: [], ref: { name: 'GC', inverse: false } })).toBe(true);
	});
});
