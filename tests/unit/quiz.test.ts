/**
 * 출제 선택. 난수를 인자로 받으므로 확률에 기대지 않고 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { pickNext, pushRecent, RECENT_LIMIT } from '../../src/lib/domain/quiz.js';

/** 후보 배열의 i 번째를 고르는 가짜 난수. */
const at = (i: number) => () => i / 1000;
const pool = (n: number) => Array.from({ length: n }, (_, i) => `C${i}`);

describe('pickNext', () => {
	it('빈 pool 은 null', () => {
		expect(pickNext([], [])).toBeNull();
	});

	it('pool 이 하나면 이력과 무관하게 그것을 낸다', () => {
		expect(pickNext(['AA'], ['AA', 'AA'])).toBe('AA');
	});

	it('최근 20개를 제외한다', () => {
		const p = pool(30);
		const recent = p.slice(0, RECENT_LIMIT);
		// 어떤 난수를 넣어도 제외 대상은 안 나온다
		for (let i = 0; i < 1000; i++) {
			const got = pickNext(p, recent, () => i / 1000);
			expect(recent).not.toContain(got);
		}
	});

	it('제외하고 남은 후보 안에서만 고른다', () => {
		const p = pool(22);
		const recent = p.slice(0, 20);
		const rest = new Set(p.slice(20));
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) seen.add(pickNext(p, recent, () => i / 1000)!);
		expect(seen).toEqual(rest);
	});

	it('이력이 20개보다 길어도 뒤에서 20개만 본다', () => {
		const p = pool(30);
		const recent = [...p.slice(20), ...p.slice(0, RECENT_LIMIT)];
		for (let i = 0; i < 200; i++) {
			const got = pickNext(p, recent, () => i / 1000)!;
			// 뒤 20개(C0~C19)는 잠기고, 앞에 있던 C20~C29 는 후보로 살아난다
			expect(Number(got.slice(1))).toBeGreaterThanOrEqual(20);
		}
	});

	it('pool 이 20보다 작으면 제외 범위를 pool.length - 1 로 줄인다', () => {
		const p = pool(5);
		// pool 을 한 바퀴 다 돈 상태. 20개를 그대로 제외하면 후보가 0이 된다.
		const recent = ['C0', 'C1', 'C2', 'C3', 'C4'];
		const got = new Set<string>();
		for (let i = 0; i < 1000; i++) got.add(pickNext(p, recent, () => i / 1000)!);
		// 뒤 4개(C1~C4)만 잠기고 가장 오래된 C0 이 남는다. 출제가 멈추지 않는다.
		expect([...got]).toEqual(['C0']);
	});

	it('제외는 이력의 앞이 아니라 뒤에서 센다', () => {
		const p = pool(5);
		// 앞쪽 C0 은 이미 밀려난 것으로 친다 — 뒤 4개만 잠긴다
		const recent = ['C4', 'C3', 'C2', 'C1', 'C0'];
		const got = new Set<string>();
		for (let i = 0; i < 1000; i++) got.add(pickNext(p, recent, () => i / 1000)!);
		expect([...got]).toEqual(['C4']);
	});

	it('작은 pool 에서도 직전 문제는 항상 제외된다 (0.4.0 동작이 하한)', () => {
		const p = pool(2);
		for (let i = 0; i < 100; i++) {
			expect(pickNext(p, ['C1'], () => i / 1000)).toBe('C0');
			expect(pickNext(p, ['C0'], () => i / 1000)).toBe('C1');
		}
	});

	it('이력에 pool 밖 코드가 섞여 있어도 안전하다', () => {
		const p = pool(3);
		const got = pickNext(p, ['ZZ', 'YY', 'C0'], at(0));
		expect(p).toContain(got);
		expect(got).not.toBe('C0');
	});

	it('난수가 상한에 닿아도 범위를 넘지 않는다', () => {
		const p = pool(30);
		const got = pickNext(p, [], () => 0.999999);
		expect(p).toContain(got);
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
	it('378개 pool 을 100번 뽑는 동안 최근 20개 안에서는 한 번도 안 겹친다', () => {
		const p = pool(378);
		let recent: string[] = [];
		const drawn: string[] = [];
		for (let i = 0; i < 100; i++) {
			const code = pickNext(p, recent, Math.random)!;
			expect(recent).not.toContain(code);
			drawn.push(code);
			recent = pushRecent(recent, code);
		}
		// 20칸 창 안에서 중복이 없음을 다시 확인한다
		for (let i = 0; i < drawn.length; i++) {
			const window = drawn.slice(Math.max(0, i - RECENT_LIMIT), i);
			expect(window).not.toContain(drawn[i]);
		}
	});
});
