/**
 * v2 파생 필드 검증 — handoff/sim/test_v2.mjs 재현 (5292건).
 */
import { describe, it, expect } from 'vitest';
import { CubeSim, type Perms } from '../../src/lib/cube/sim.js';
import { invertAlg, cancelMoves, moveCount } from '../../src/lib/cube/notation.js';
import permsJson from '../../src/lib/cube/perms.json';
import dataJson from '../../src/lib/data/corner-UBL.json';
import type { CaseEntry, Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim(permsJson as unknown as Perms);
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
	 * v3 의 cancels 는 "완전히 소멸한 무브 쌍의 수"다. v2 의 "줄어든 무브 수"와
	 * 다르다 — `U U → U2` 는 무브가 하나 줄지만 소멸한 쌍은 없다.
	 */
	it('strict.cancels = 완전 소멸한 쌍의 수 (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes) {
				const x = pick(c, m);
				if (x.strict.cancels !== annihilations(x.strict.alg)) bad.push(`${k}/${m}`);
			}
		expect(bad).toEqual([]);
	});

	it('cancels 는 줄어든 무브 수 이하다 (소멸 1쌍당 2수) (756)', () => {
		const bad: string[] = [];
		for (const [k, c] of entries)
			for (const m of modes) {
				const x = pick(c, m);
				if (x.strict.cancels * 2 > x.strict.moves - x.moves) bad.push(`${k}/${m}`);
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
