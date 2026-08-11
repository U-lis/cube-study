/**
 * v2 파생 필드 검증 — handoff/sim/test_v2.mjs 재현 (5292건).
 */
import { describe, it, expect } from 'vitest';
import { CubeSim } from '../../src/lib/cube/sim.js';
import { invertAlg, cancelMoves, moveCount } from '../../src/lib/cube/notation.js';
import dataJson from '../../src/lib/data/corner-UBL.json';
import type { CaseEntry, Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim();
const data = dataJson as unknown as Dataset;
const entries = Object.entries(data.cases);
const modes = ['direct', 'setup'] as const;

function pick(c: CaseEntry, m: (typeof modes)[number]) {
	return m === 'direct' ? c.direct : c.setup;
}

const AMOUNT: Record<string, number> = { '': 1, "'": 3, '2': 2 };

/** 인접 무브가 통째로 사라진 횟수. `R R'` 은 1, `U U → U2` 는 0. */
function annihilations(alg: string): number {
	let toks = alg.trim() ? alg.trim().split(/\s+/) : [];
	let n = 0;
	for (let changed = true; changed; ) {
		changed = false;
		const out: string[] = [];
		for (let i = 0; i < toks.length; i++) {
			const cur = toks[i];
			const next = toks[i + 1];
			if (next !== undefined && cur[0] === next[0]) {
				const amount = (AMOUNT[cur.slice(1)] + AMOUNT[next.slice(1)]) % 4;
				if (amount === 0) n++;
				else out.push(cur[0] + { 1: '', 2: '2', 3: "'" }[amount]);
				i++;
				changed = true;
			} else {
				out.push(cur);
			}
		}
		toks = out;
	}
	return n;
}

describe('strict 필드 (direct + setup)', () => {
	it('strict.alg 가 해당 케이스를 푼다 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes)
				if (sim.identifyCase(pick(c, m).strict.alg) !== k) bad.push(`${k}/${m}`);
		expect(bad).toEqual([]);
	});

	it('strict.alg 도 엣지 무영향 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes)
				if (!sim.isEdgeNeutral(pick(c, m).strict.alg)) bad.push(`${k}/${m}`);
		expect(bad).toEqual([]);
	});

	it('cancelMoves(strict.alg) === alg (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes) {
				const x = pick(c, m);
				if (cancelMoves(x.strict.alg) !== x.alg) bad.push(`${k}/${m}`);
			}
		expect(bad).toEqual([]);
	});

	it('strict.moves 가 실제 무브 수와 일치 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes) {
				const x = pick(c, m);
				if (x.strict.moves !== moveCount(x.strict.alg)) bad.push(`${k}/${m}`);
			}
		expect(bad).toEqual([]);
	});

	/**
	 * cancels 는 "상쇄로 줄어든 무브 수"다 (v2 정의, v6 에서 복원).
	 *
	 * v3~v5 는 이것을 `(strict.moves - moves) / 2` 로 계산했는데, 상쇄가 늘 무브
	 * 둘을 지운다고 가정한 것이라 틀렸다. `R R → R2` 는 토큰이 하나만 준다.
	 * 378×2 중 470건이 어긋나 있었고 v6 이 나눗셈을 걷어내며 고쳤다.
	 *
	 * 그동안 이 테스트는 그 잘못된 값을 "완전 소멸한 쌍의 수" 로 해석해 통과시키고
	 * 있었다. 두 정의가 우연히 맞아떨어지는 구간이 넓었기 때문이다. 정의를 데이터가
	 * 말하는 대로 되돌린다.
	 */
	it('strict.cancels = 상쇄로 줄어든 무브 수 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes) {
				const x = pick(c, m);
				if (x.strict.cancels !== x.strict.moves - x.moves) bad.push(`${k}/${m}`);
			}
		expect(bad).toEqual([]);
	});

	/**
	 * 완전 소멸한 쌍은 무브를 둘씩 지우므로, 줄어든 무브 수는 그 두 배 이상이다.
	 * 두 값이 다른 개념이라는 것을 못박아 둔다 — 이 부등식이 깨지면 어느 한쪽의
	 * 계산이 다시 틀어진 것이다.
	 */
	it('줄어든 무브 수 >= 완전 소멸한 쌍의 2배 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes) {
				const x = pick(c, m);
				if (annihilations(x.strict.alg) * 2 > x.strict.moves - x.moves) bad.push(`${k}/${m}`);
			}
		expect(bad).toEqual([]);
	});

	/** v6 신규. setupMoves 는 셋업 무브 수 그대로다. */
	it('setup.setupMoves = |S| (378)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries) {
			const n = c.setup.setupMoves;
			if (n !== undefined && n !== moveCount(c.setup.S)) bad.push(k);
		}
		expect(bad).toEqual([]);
	});
});

describe('파생 플래그', () => {
	it('sameAlg (378)', () => {
		const bad = entries.filter(([, c]) => c.sameAlg !== (c.direct.alg === c.setup.alg));
		expect(bad.map(([k]) => k)).toEqual([]);
	});

	it('aSelfInverse / bSelfInverse (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries) {
			if (c.direct.strict.aSelfInverse !== (invertAlg(c.direct.A) === c.direct.A)) bad.push(`${k}/A`);
			if (c.direct.strict.bSelfInverse !== (invertAlg(c.direct.B) === c.direct.B)) bad.push(`${k}/B`);
		}
		expect(bad).toEqual([]);
	});

	it('inverseTrick 값 정합 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries) {
			const d = sim.identifyCase(cancelMoves(invertAlg(c.direct.alg))) === c.inverse;
			if (c.inverseTrick.direct !== d) bad.push(`${k}/direct`);
			const s = invertAlg(c.setup.alg) === data.cases[c.inverse].setup.alg;
			if (c.inverseTrick.setup !== s) bad.push(`${k}/setup`);
		}
		expect(bad).toEqual([]);
	});

	it('setup.alg 뒤집기가 역케이스를 실제로 푼다 (378)', () => {
		// inverseTrick.setup 은 62/378 이지만, 효과 기준으로는 378/378 성립한다.
		const bad = entries.filter(
			([, c]) => sim.identifyCase(cancelMoves(invertAlg(c.setup.alg))) !== c.inverse
		);
		expect(bad.map(([k]) => k)).toEqual([]);
	});
});
