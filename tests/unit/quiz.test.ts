/**
 * 출제 선택. 난수를 인자로 받으므로 확률에 기대지 않고 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { pickNext, pushRecent, RECENT_LIMIT, type InverseOf } from '../../src/lib/domain/quiz.js';

/** 후보 배열의 i 번째를 고르는 가짜 난수. */
const at = (i: number) => () => i / 1000;
const pool = (n: number) => Array.from({ length: n }, (_, i) => `C${i}`);
/** 역케이스 없음. 0.4.1 까지의 동작을 그대로 재현한다. */
const none: InverseOf = () => undefined;
/** 짝수 i 와 i+1 이 서로의 역이라고 보는 가짜 매핑 (C0↔C1, C2↔C3, ...). */
const pairs: InverseOf = (c) => {
	const n = Number(c.slice(1));
	if (Number.isNaN(n)) return undefined;
	return `C${n % 2 === 0 ? n + 1 : n - 1}`;
};

describe('pickNext — 기본', () => {
	it('빈 pool 은 null', () => {
		expect(pickNext([], [])).toBeNull();
	});

	it('pool 이 하나면 이력과 무관하게 그것을 낸다', () => {
		expect(pickNext(['AA'], ['AA', 'AA'])).toBe('AA');
	});

	it('최근 20개를 제외한다', () => {
		const p = pool(30);
		const recent = p.slice(0, RECENT_LIMIT);
		for (let i = 0; i < 1000; i++) {
			expect(recent).not.toContain(pickNext(p, recent, none, at(i)));
		}
	});

	it('제외하고 남은 후보 안에서만 고른다', () => {
		const p = pool(22);
		const recent = p.slice(0, 20);
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) seen.add(pickNext(p, recent, none, at(i))!);
		expect(seen).toEqual(new Set(p.slice(20)));
	});

	it('이력이 20개보다 길어도 뒤에서 20개만 본다', () => {
		const p = pool(30);
		const recent = [...p.slice(20), ...p.slice(0, RECENT_LIMIT)];
		for (let i = 0; i < 200; i++) {
			const got = pickNext(p, recent, none, at(i))!;
			expect(Number(got.slice(1))).toBeGreaterThanOrEqual(20);
		}
	});

	it('제외는 이력의 앞이 아니라 뒤에서 센다', () => {
		const p = pool(5);
		const recent = ['C4', 'C3', 'C2', 'C1', 'C0'];
		const got = new Set<string>();
		for (let i = 0; i < 1000; i++) got.add(pickNext(p, recent, none, at(i))!);
		expect([...got]).toEqual(['C4']);
	});

	it('이력에 pool 밖 코드가 섞여 있어도 안전하다', () => {
		const p = pool(3);
		const got = pickNext(p, ['ZZ', 'YY', 'C0'], none, at(0));
		expect(p).toContain(got);
		expect(got).not.toBe('C0');
	});

	it('난수가 상한에 닿아도 범위를 넘지 않는다', () => {
		const p = pool(30);
		expect(p).toContain(pickNext(p, [], none, () => 0.999999));
	});
});

describe('pickNext — 역케이스 제외 (0.4.2)', () => {
	it('직전 문제의 역케이스가 바로 나오지 않는다', () => {
		const p = pool(10);
		for (let i = 0; i < 500; i++) {
			// C0 을 냈으면 그 역인 C1 도 막힌다
			const got = pickNext(p, ['C0'], pairs, at(i))!;
			expect(got).not.toBe('C0');
			expect(got).not.toBe('C1');
		}
	});

	it('최근 20개의 역케이스가 전부 막힌다', () => {
		const p = pool(60);
		const recent = p.slice(0, RECENT_LIMIT); // C0~C19
		const blocked = new Set([...recent, ...recent.map((c) => pairs(c)!)]);
		for (let i = 0; i < 1000; i++) {
			expect(blocked).not.toContain(pickNext(p, recent, pairs, at(i)));
		}
	});

	it('역케이스를 안 넘기면 0.4.1 동작 그대로다', () => {
		const p = pool(10);
		const withInv = new Set<string>();
		const without = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			withInv.add(pickNext(p, ['C0'], pairs, at(i))!);
			without.add(pickNext(p, ['C0'], none, at(i))!);
		}
		expect(without).toContain('C1'); // 역케이스가 후보로 남는다
		expect(withInv).not.toContain('C1');
	});

	it('pool 이 작으면 창을 줄여서라도 후보를 남긴다', () => {
		const p = pool(6); // C0~C5, 역쌍 3개
		const recent = p.slice(); // 한 바퀴 다 돌았다
		for (let i = 0; i < 500; i++) {
			expect(p).toContain(pickNext(p, recent, pairs, at(i)));
		}
	});

	it('역쌍 둘만 남으면 역케이스 제외를 포기하되 직전 문제는 끝까지 막는다', () => {
		const p = ['C0', 'C1']; // 서로의 역이다. 둘 다 만족시킬 수 없다.
		for (let i = 0; i < 200; i++) {
			expect(pickNext(p, ['C0'], pairs, at(i))).toBe('C1');
			expect(pickNext(p, ['C1'], pairs, at(i))).toBe('C0');
		}
	});
});

describe('pushRecent', () => {
	it('뒤에 붙인다', () => {
		expect(pushRecent(['A'], 'B')).toEqual(['A', 'B']);
	});

	it('RECENT_LIMIT 을 넘으면 오래된 것부터 버린다', () => {
		let r: string[] = [];
		for (let i = 0; i < 50; i++) r = pushRecent(r, `C${i}`);
		expect(r).toHaveLength(RECENT_LIMIT);
		expect(r[0]).toBe('C30');
		expect(r[RECENT_LIMIT - 1]).toBe('C49');
	});

	it('원본을 바꾸지 않는다', () => {
		const r = ['A'];
		pushRecent(r, 'B');
		expect(r).toEqual(['A']);
	});
});

describe('실제 데이터 크기에서의 분포', () => {
	it('378개를 100번 뽑는 동안 최근 20개 안에서 케이스도 역케이스도 안 겹친다', () => {
		const p = pool(378);
		let recent: string[] = [];
		const drawn: string[] = [];
		for (let i = 0; i < 100; i++) {
			const code = pickNext(p, recent, pairs, Math.random)!;
			expect(recent).not.toContain(code);
			expect(recent.map((c) => pairs(c))).not.toContain(code);
			drawn.push(code);
			recent = pushRecent(recent, code);
		}
		for (let i = 0; i < drawn.length; i++) {
			const window = drawn.slice(Math.max(0, i - RECENT_LIMIT), i);
			expect(window).not.toContain(drawn[i]);
			expect(window).not.toContain(pairs(drawn[i]));
		}
	});
});
