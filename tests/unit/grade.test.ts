import { describe, it, expect } from 'vitest';
import { CubeSim, type Perms } from '../../src/lib/cube/sim.js';
import { grade, verdictText } from '../../src/lib/domain/grade.js';
import permsJson from '../../src/lib/cube/perms.json';
import dataJson from '../../src/lib/data/corner-UBL.json';
import type { Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim(permsJson as unknown as Perms);
const ds = dataJson as unknown as Dataset;
const e = (k: string) => ds.cases[k];
const g = (target: string, alg: string) => grade(sim, ds, e(target), alg);

/** 시뮬레이터로 조건 충족을 확인해 고정한 상수 (PHASE_3_TEST T3-1 #9) */
const EDGE_DIRTY_LB = "M2 R D2 R' U R D2 R' U'"; // 코너는 LB, 엣지 4개 오염
const TWIST_LB = "R D2 R' U R D2 R' U' L2 U R U' L2 U R' U'"; // 3큐비 맞고 방향만 다름

describe('정답 판정', () => {
	it('데이터의 direct.alg', () => expect(g('LB', e('LB').direct.alg).kind).toBe('correct'));
	it('데이터의 setup.alg', () => expect(g('LB', e('LB').setup.alg).kind).toBe('correct'));
	it('데이터의 strict.alg (상쇄 전)', () =>
		expect(g('LB', e('LB').direct.strict.alg).kind).toBe('correct'));

	it('378 케이스 x 3표현 전부 correct (1134)', () => {
		const bad: string[] = [];
		for (const [k, c] of Object.entries(ds.cases)) {
			for (const [label, alg] of [
				['direct', c.direct.alg],
				['setup', c.setup.alg],
				['strict', c.direct.strict.alg]
			] as const) {
				if (g(k, alg).kind !== 'correct') bad.push(`${k}/${label}`);
			}
		}
		expect(bad).toEqual([]);
	});
});

describe('변형 알고리즘도 정답 (FR-18 핵심)', () => {
	it("앞뒤에 U U' 를 넣어도 정답", () => {
		expect(g('LB', `U U' ${e('LB').direct.alg}`).kind).toBe('correct');
	});

	/*
	 * 케이스를 지목하지 않고 데이터에서 고른다. 예전엔 'FS' 를 박아뒀는데 v7 에서
	 * FS 의 셋업 경로가 direct 와 같은 무브 열로 떨어지면서 깨졌다 — 확인하려는
	 * 것은 "다른 무브 열도 정답" 이지 FS 가 그런 케이스라는 사실이 아니다.
	 */
	it('데이터의 alg 와 다른 무브 열이어도 같은 케이스면 정답', () => {
		const found = Object.entries(ds.cases).find(
			([, c]) => c.setup.strict.alg !== c.direct.alg
		);
		expect(found).toBeDefined();
		const [key, c] = found!;
		expect(g(key, c.setup.strict.alg).kind).toBe('correct');
	});

	it('U 로 conjugate 하면 다른 케이스가 되어 오답', () => {
		expect(g('LB', `U ${e('LB').direct.alg} U'`).kind).toBe('wrong');
	});
});

describe('오답 구분', () => {
	it('빈 입력은 identity', () => expect(g('LB', '').kind).toBe('identity'));
	it("R R' 은 identity", () => expect(g('LB', "R R'").kind).toBe('identity'));

	it('다른 케이스 알고리즘은 identified 를 알려준다', () => {
		expect(g('LB', e('TU').direct.alg)).toEqual({ kind: 'wrong', identified: 'TU' });
	});

	it('역케이스 알고리즘은 오답', () => {
		expect(g('LB', e('BL').direct.alg)).toEqual({ kind: 'wrong', identified: 'BL' });
	});

	it('sexy move 는 3-cycle 이 아니다', () => {
		expect(g('LB', "R U R' U'")).toEqual({ kind: 'wrong', identified: null });
	});

	it('알 수 없는 무브', () => {
		expect(g('LB', 'R Z')).toEqual({ kind: 'invalid-move', token: 'Z' });
	});
});

describe('부분 정답 / twist', () => {
	it('코너는 맞지만 엣지 오염', () => {
		const v = g('LB', EDGE_DIRTY_LB);
		expect(v.kind).toBe('edge-dirty');
		if (v.kind === 'edge-dirty') expect(v.cubies).toEqual(['DB', 'DF', 'UB', 'UF']);
	});

	it('3큐비는 맞지만 방향이 다르다', () => {
		expect(g('LB', TWIST_LB).kind).toBe('twist');
	});

	it('5가지 Verdict 가 각각 실제로 발생한다', () => {
		const kinds = new Set([
			g('LB', e('LB').direct.alg).kind,
			g('LB', EDGE_DIRTY_LB).kind,
			g('LB', TWIST_LB).kind,
			g('LB', '').kind,
			g('LB', e('TU').direct.alg).kind
		]);
		expect([...kinds].sort()).toEqual(['correct', 'edge-dirty', 'identity', 'twist', 'wrong']);
	});
});

describe('판정 문구 (NFR-9: 사실만)', () => {
	it('정답', () => expect(verdictText({ kind: 'correct' })).toBe('정답'));
	it('엣지 오염', () =>
		expect(verdictText({ kind: 'edge-dirty', cubies: ['UB', 'UL'] })).toBe(
			'코너는 맞지만 엣지를 건드립니다: UB UL'
		));
	it('방향', () => expect(verdictText({ kind: 'twist' })).toBe('조각 위치는 맞지만 방향이 다릅니다'));
	it('무변화', () => expect(verdictText({ kind: 'identity' })).toBe('큐브가 바뀌지 않았습니다'));

	it('격려·재도전 문구가 없다', () => {
		const all = [
			verdictText({ kind: 'correct' }),
			verdictText({ kind: 'twist' }),
			verdictText({ kind: 'identity' }),
			verdictText({ kind: 'wrong', identified: 'TU' }),
			verdictText({ kind: 'wrong', identified: null })
		].join(' ');
		expect(all).not.toMatch(/다시|힘내|아쉽|축하|훌륭|잘했/);
	});
});
