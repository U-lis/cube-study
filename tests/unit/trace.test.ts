/**
 * 트레이싱 엔진 검증 (PHASE_1A_TEST T1A-3 ~ T1A-9).
 *
 * 두 가지를 못박는다.
 *
 * 1. **엔진은 버퍼를 모른다.** 옵션은 전부 이 파일의 리터럴이다. 데이터셋을
 *    끌고 오지 않으므로 코너 UFR 처럼 파일이 없는 버퍼도 그냥 돌려볼 수 있다.
 *    "코드 수정 없이 데이터만 교체" 를 테스트가 그대로 재현한다 (FR-TR-7).
 * 2. **채점은 문자열 비교가 아니다.** 한 스크램블에 유효한 메모가 여러 가지라
 *    기대값을 적어둘 수 없다. 실행해서 풀리는지를 본다 (FR-TR-10).
 *
 * 무작위 표본은 결정적 PRNG 로 만든다(`quiz.test.ts` 와 같은 규율). 표본이
 * 바뀌면 분모도 바뀌므로 SPEC 검증표의 개수(1475·1209·1134·2053)는 **비율** 로
 * 확인하고, 통과율만 100% 를 요구한다 — PHASE_1A_TEST 의 규정이다.
 */
import { describe, it, expect } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import { readFileSync } from 'node:fs';
import { stateFromFacelets, type CubeState } from '../../src/lib/cube/sim.js';
import { invertAlg } from '../../src/lib/cube/notation.js';
import { cubieOf, lettersOf, rotationOf, type PieceKind } from '../../src/lib/cube/speffz.js';
import {
	applyTargets,
	gradeEntry,
	gradeMemo,
	normalizeTwistLetter,
	readEntry,
	trace,
	twistLetter,
	type TraceOptions
} from '../../src/lib/cube/trace.js';
import dataJson from '../../src/lib/data/corner-UBL.json';

/**
 * 픽스처. 데이터셋 meta 에서 올 값이지만 여기서는 리터럴로 적는다 — 5MB JSON 을
 * 끌고 오지 않기 위해서이고, 파일이 없는 버퍼(코너 UFR)도 같은 코드로 돌아간다는
 * 것이 이 테스트의 논점이기 때문이다.
 */
const CORNER_UBL: TraceOptions = {
	pieceKind: 'corner',
	bufferStickers: ['A', 'E', 'R'],
	primarySticker: 'A'
};
const CORNER_UFR: TraceOptions = {
	pieceKind: 'corner',
	bufferStickers: ['C', 'M', 'J'],
	primarySticker: 'C'
};
const EDGE_UF: TraceOptions = { pieceKind: 'edge', bufferStickers: ['c', 'i'], primarySticker: 'c' };
const EDGE_DF: TraceOptions = { pieceKind: 'edge', bufferStickers: ['u', 'k'], primarySticker: 'u' };
const FIXTURES: [string, TraceOptions][] = [
	['코너 UBL', CORNER_UBL],
	['코너 UFR', CORNER_UFR],
	['엣지 UF', EDGE_UF],
	['엣지 DF', EDGE_DF]
];

/** 결정적 PRNG (LCG). 난수를 테스트가 쥐고 있어야 같은 실행이 같은 결과를 낸다. */
function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

/**
 * 무작위 상태 n개를 facelet 문자열로 만든다.
 *
 * `randomize()` 가 `Math.random` 을 부르므로 그동안만 갈아끼운다. 풀이기
 * (`solve.js`)는 안 쓴다 — 단위 테스트는 스크램블 문자열을 만들 일이 없다.
 * (cubejs 타입 선언에 `randomize` 가 없어 여기서만 좁혀 쓴다. 선언 파일은
 * 다른 페이즈가 쓰고 있어 건드리지 않는다.)
 */
function facelets(n: number, seed: number): string[] {
	const real = Math.random;
	Math.random = rng(seed);
	try {
		return Array.from({ length: n }, () =>
			(new Cube() as Cube & { randomize(): Cube }).randomize().asString()
		);
	} finally {
		Math.random = real;
	}
}

/** 3000 표본은 여러 테스트가 나눠 쓴다. 매번 만들면 느리기만 하다. */
const SAMPLE = facelets(3000, 20260821);
const stateOf = (f: string, kind: PieceKind) => stateFromFacelets(f, kind);
const isSolved = (state: CubeState) => Object.entries(state).every(([pos, s]) => pos === s);

/** 제자리 비틀림·뒤집힘 큐비 (큐비는 제자리인데 스티커가 어긋남). */
function twistedCubies(state: CubeState, kind: PieceKind): string[] {
	const rot = rotationOf(kind);
	const cubie = cubieOf(kind);
	return Object.keys(rot).filter(
		(c) => rot[c].every((s) => cubie[state[s]] === c) && rot[c].some((s) => state[s] !== s)
	);
}

const cases = (dataJson as unknown as { cases: Record<string, { direct: { alg: string }; setup: { alg: string } }> })
	.cases;

// ─────────────────────────────────────────────────────────────
// T1A-3. 케이스 왕복 — 378/378
// ─────────────────────────────────────────────────────────────

describe('T1A-3. 378 케이스 왕복', () => {
	/** 케이스를 푸는 알고리즘을 뒤집으면 그 케이스를 만드는 스크램블이다. */
	const scrambleOf = (alg: string) =>
		stateFromFacelets(new Cube().move(invertAlg(alg)).asString(), 'corner');

	it('setup.alg 뒤집기에서 케이스 코드가 그대로 나온다 (378/378)', () => {
		const bad: string[] = [];
		for (const [code, c] of Object.entries(cases)) {
			const r = trace(scrambleOf(c.setup.alg), CORNER_UBL);
			if (r.targets.length !== 2 || r.targets.join('') !== code)
				bad.push(`${code} → ${r.targets.join('')}`);
		}
		expect(bad).toEqual([]);
		expect(Object.keys(cases).length).toBe(378);
	});

	it('direct.alg 뒤집기로도 같은 결과 (378/378)', () => {
		const bad = Object.entries(cases).filter(
			([code, c]) => trace(scrambleOf(c.direct.alg), CORNER_UBL).targets.join('') !== code
		);
		expect(bad.map(([code]) => code)).toEqual([]);
	});

	it('관례 A 이므로 twists 는 전부 빈 배열 (378/378)', () => {
		const bad = Object.entries(cases).filter(
			([, c]) => trace(scrambleOf(c.setup.alg), CORNER_UBL).twists.length !== 0
		);
		expect(bad.length).toBe(0);
	});
});

// ─────────────────────────────────────────────────────────────
// T1A-4 / T1A-6. 라운드트립·평균 타깃 수 — 네 픽스처
// ─────────────────────────────────────────────────────────────

describe('T1A-4·6. 라운드트립 500/500', () => {
	for (const [name, opt] of FIXTURES) {
		it(`${name} — 뽑은 메모를 실행하면 전부 풀린다`, () => {
			let ok = 0;
			for (const f of SAMPLE.slice(0, 500)) {
				const st = stateOf(f, opt.pieceKind);
				if (isSolved(applyTargets(st, trace(st, opt).targets, opt))) ok++;
			}
			expect(ok).toBe(500);
		});

		it(`${name} — 타깃에 버퍼 스티커가 없다`, () => {
			const bad: string[] = [];
			for (const f of SAMPLE.slice(0, 500)) {
				const st = stateOf(f, opt.pieceKind);
				for (const t of trace(st, opt).targets)
					if (opt.bufferStickers.includes(t)) bad.push(t);
			}
			expect(bad).toEqual([]);
		});
	}

	it('이미 풀린 상태는 타깃이 없다', () => {
		for (const [, opt] of FIXTURES) {
			const solved = stateFromFacelets(new Cube().asString(), opt.pieceKind);
			const r = trace(solved, opt);
			expect(r.targets).toEqual([]);
			expect(r.breakIns).toBe(0);
			expect(r.parity).toBe(false);
		}
	});

	/**
	 * 정지 조건을 `T === B`(스티커)로 바꾸면 제자리 비틀림이 타깃 4개가 되고
	 * 라운드트립이 깨진다. 그 코드를 두지 않는 대신, 큐비 조건이 실제로 2개를
	 * 낸다는 것을 여기서 못박는다 (AD-4).
	 */
	it('제자리 비틀린 조각 하나는 타깃 2개를 먹는다', () => {
		const st = stateOf(
			SAMPLE.find((f) => {
				const s = stateOf(f, 'corner');
				return twistedCubies(s, 'corner').length === 1 && trace(s, CORNER_UBL).breakIns > 0;
			})!,
			'corner'
		);
		const twisted = twistedCubies(st, 'corner')[0];
		const cubie = cubieOf('corner');
		const targets = trace(st, CORNER_UBL).targets;
		const hits = targets.filter((t) => cubie[t] === twisted);
		// 버퍼가 비틀린 경우는 타깃 열에 안 나온다 (버퍼는 끊기 후보가 아니다).
		expect(hits.length === 2 || (hits.length === 0 && twisted === cubie[CORNER_UBL.primarySticker])).toBe(
			true
		);
	});

	it('홀수 타깃 비율이 50±2% 다 (비틀림 특례가 있으면 44.4% 로 떨어진다)', () => {
		const off: string[] = [];
		for (const [name, opt] of FIXTURES) {
			const odd = SAMPLE.filter((f) => trace(stateOf(f, opt.pieceKind), opt).parity).length;
			const pct = (odd / SAMPLE.length) * 100;
			if (Math.abs(pct - 50) >= 2) off.push(`${name}: ${pct.toFixed(1)}%`);
		}
		expect(off).toEqual([]);
	});

	/**
	 * 평균 타깃 수는 SPEC 실측(코너 8.13/8.16, 엣지 12.23/11.99)과 맞춘다.
	 *
	 * 다만 UF 와 DF 는 큐브 회전으로 서로 옮겨지는 자리라 균등 표본에서 평균이
	 * **같을 수밖에 없다.** SPEC 의 12.23 / 11.99 차이는 표본 잡음이다. 그래서
	 * 절대값은 ±0.25 로 보고, 대신 두 버퍼가 서로 일치하는지를 따로 못박는다.
	 */
	it('평균 타깃 수가 SPEC 실측과 맞는다', () => {
		const avg = (opt: TraceOptions) =>
			SAMPLE.reduce((a, f) => a + trace(stateOf(f, opt.pieceKind), opt).targets.length, 0) /
			SAMPLE.length;
		const measured = {
			cUBL: avg(CORNER_UBL),
			cUFR: avg(CORNER_UFR),
			eUF: avg(EDGE_UF),
			eDF: avg(EDGE_DF)
		};
		expect(measured.cUBL).toBeCloseTo(8.13, 1);
		expect(measured.cUFR).toBeCloseTo(8.16, 1);
		expect(Math.abs(measured.eUF - 12.23)).toBeLessThan(0.25);
		expect(Math.abs(measured.eDF - 11.99)).toBeLessThan(0.25);
		// 회전 대칭 — 버퍼 자리가 달라도 균등 표본의 평균은 같다.
		expect(Math.abs(measured.cUBL - measured.cUFR)).toBeLessThan(0.1);
		expect(Math.abs(measured.eUF - measured.eDF)).toBeLessThan(0.1);
	});
});

// ─────────────────────────────────────────────────────────────
// T1A-5 / T1A-6. 끊기 무작위 — 400/400
// ─────────────────────────────────────────────────────────────

describe('T1A-5·6. 끊기 무작위 400/400', () => {
	for (const [name, opt] of FIXTURES) {
		it(`${name} — 상태 20개 × 끊기 20회 전부 유효하고 타깃 수가 같다`, () => {
			let solvedCount = 0;
			let sameCount = 0;
			let sameParity = 0;
			let combos = 0;
			const variety: number[] = [];

			for (const f of SAMPLE.slice(0, 20)) {
				const st = stateOf(f, opt.pieceKind);
				const base = trace(st, opt);
				const seen = new Set<string>();
				for (let k = 0; k < 20; k++) {
					combos++;
					const r = rng(1000 + k);
					const memo = trace(st, {
						...opt,
						pickBreakIn: (c) => c[Math.floor(r() * c.length)]
					});
					seen.add(memo.targets.join(''));
					if (isSolved(applyTargets(st, memo.targets, opt))) solvedCount++;
					if (memo.targets.length === base.targets.length) sameCount++;
					if (memo.parity === base.parity) sameParity++;
				}
				variety.push(seen.size);
			}

			expect(combos).toBe(400);
			expect(solvedCount).toBe(400);
			expect(sameCount).toBe(400);
			expect(sameParity).toBe(400);
			// 끊기가 있는 상태라면 서로 다른 메모가 실제로 여러 가지 나온다.
			expect(Math.max(...variety)).toBeGreaterThanOrEqual(2);
		});
	}
});

// ─────────────────────────────────────────────────────────────
// T1A-7. 관례 B
// ─────────────────────────────────────────────────────────────

describe('T1A-7. 관례 B', () => {
	const B = (opt: TraceOptions): TraceOptions => ({ ...opt, twistConvention: 'B' });
	const targets: [string, TraceOptions, number][] = [
		// 픽스처, 옵션, SPEC 실측 비율(%)
		['코너 UBL', CORNER_UBL, 49],
		['엣지 UF', EDGE_UF, 40],
		['엣지 DF', EDGE_DF, 38]
	];

	for (const [name, opt, pct] of targets) {
		it(`${name} — 비틀림 있는 상태에서 남는 것이 선언한 비틀림뿐이다`, () => {
			let subject = 0;
			let ok = 0;
			let parityOk = 0;
			let bufferInTwists = 0;

			for (const f of SAMPLE) {
				const st = stateOf(f, opt.pieceKind);
				if (twistedCubies(st, opt.pieceKind).length === 0) continue;
				subject++;

				const a = trace(st, opt);
				const b = trace(st, B(opt));
				if (a.parity === b.parity) parityOk++;
				if (b.twists.some((t) => opt.bufferStickers.includes(t))) bufferInTwists++;

				// 타깃 열만 실행한다. 비틀림은 따로 친다는 것이 관례 B 다.
				const residual = applyTargets(st, b.targets, opt);
				const left = Object.keys(rotationOf(opt.pieceKind)).filter((c) =>
					rotationOf(opt.pieceKind)[c].some((s) => residual[s] !== s)
				);
				const stillTwisted = twistedCubies(residual, opt.pieceKind);
				const declared = [...b.twists].sort().join('');
				const actual = stillTwisted.map((c) => twistLetter(residual, c, opt)).sort().join('');
				if (left.sort().join() === stillTwisted.sort().join() && declared === actual) ok++;
			}

			expect(ok).toBe(subject); // 통과율 100%
			expect(parityOk).toBe(subject); // 패리티는 관례와 무관하다
			// 분모(1475·1209·1134)는 표본이 정한다. SPEC 실측 비율과 ±2%p 로 맞춘다.
			expect(Math.abs((subject / SAMPLE.length) * 100 - pct)).toBeLessThan(2);
			// 버퍼가 비틀린 채 남는 비율 — 코너 80.9% / 엣지 77% (±5%p, 표본 잡음)
			const bufferPct = (bufferInTwists / subject) * 100;
			expect(Math.abs(bufferPct - (opt.pieceKind === 'corner' ? 80.9 : 77))).toBeLessThan(5);
		});
	}

	it('평균 타깃 수가 관례 A → B 로 줄어든다 (SPEC 실측)', () => {
		const expected: [TraceOptions, number, number][] = [
			[CORNER_UBL, 8.79, 6.37],
			[EDGE_UF, 12.87, 10.61],
			[EDGE_DF, 12.9, 10.56]
		];
		for (const [opt, wantA, wantB] of expected) {
			let n = 0;
			let sumA = 0;
			let sumB = 0;
			for (const f of SAMPLE) {
				const st = stateOf(f, opt.pieceKind);
				if (twistedCubies(st, opt.pieceKind).length === 0) continue;
				n++;
				sumA += trace(st, opt).targets.length;
				sumB += trace(st, B(opt)).targets.length;
			}
			expect(Math.abs(sumA / n - wantA)).toBeLessThan(0.15);
			expect(Math.abs(sumB / n - wantB)).toBeLessThan(0.15);
		}
	});
});

// ─────────────────────────────────────────────────────────────
// T1A-8. 비틀림 표기
// ─────────────────────────────────────────────────────────────

describe('T1A-8. 비틀림 표기', () => {
	it('제자리 비틀린 코너 전부가 문자 하나로 특정된다 (2053/2053)', () => {
		const perCubie = new Map<string, Set<string>>();
		let n = 0;
		let ok = 0;
		const rot = rotationOf('corner');

		for (const f of SAMPLE) {
			const st = stateOf(f, 'corner');
			for (const cubie of twistedCubies(st, 'corner')) {
				n++;
				const letter = twistLetter(st, cubie, CORNER_UBL);
				if (letter.length === 1 && rot[cubie].includes(letter)) ok++;
				if (!perCubie.has(cubie)) perCubie.set(cubie, new Set());
				perCubie.get(cubie)!.add(letter);
			}
		}

		expect(ok).toBe(n);
		// SPEC 실측 2053/3000 = 큐브당 0.684. 표본이 바뀌므로 비율로 본다.
		expect(n / SAMPLE.length).toBeCloseTo(2053 / 3000, 1);
		// 큐비마다 나올 수 있는 문자가 정확히 2가지 — 방향이 둘뿐이라는 뜻이다.
		expect([...perCubie.keys()].sort()).toEqual(Object.keys(rot).sort());
		for (const [, letters] of perCubie) expect(letters.size).toBe(2);
	});

	it('방향 마커를 쓰지 않는다', () => {
		for (const f of SAMPLE.slice(0, 200)) {
			const st = stateOf(f, 'corner');
			for (const cubie of twistedCubies(st, 'corner'))
				expect(twistLetter(st, cubie, CORNER_UBL)).toMatch(/^[A-X]$/);
		}
	});

	it('버퍼 큐비의 비틀림도 문자가 나오고, 타깃 열 문자와 겹치지 않는다', () => {
		const cubie = cubieOf('corner');
		let seen = 0;
		const letters = new Set<string>();
		for (const f of SAMPLE) {
			const st = stateOf(f, 'corner');
			if (!twistedCubies(st, 'corner').includes(cubie[CORNER_UBL.primarySticker])) continue;
			seen++;
			const letter = twistLetter(st, cubie[CORNER_UBL.primarySticker], CORNER_UBL);
			letters.add(letter);
			// 버퍼 스티커는 타깃이 될 수 없으므로 (HANDOFF §4.1) 충돌하지 않는다.
			expect(CORNER_UBL.bufferStickers).toContain(letter);
			expect(trace(st, CORNER_UBL).targets).not.toContain(letter);
		}
		expect(seen).toBeGreaterThan(0);
		expect(letters.size).toBe(2);
	});

	it('엣지는 큐비당 문자 1가지로 정규화되고, 두 문자 모두 같은 곳으로 모인다', () => {
		const cubie = cubieOf('edge');
		const canonical = new Map<string, string>();
		for (const letter of lettersOf('edge')) {
			const norm = normalizeTwistLetter(letter, EDGE_UF);
			const prev = canonical.get(cubie[letter]);
			if (prev) expect(norm).toBe(prev);
			canonical.set(cubie[letter], norm);
		}
		expect(canonical.size).toBe(12);
		// 정규화 결과는 그 큐비의 문자 중 Speffz 순서상 앞 문자다.
		for (const [c, norm] of canonical)
			expect(norm).toBe(lettersOf('edge').find((s) => cubie[s] === c));

		for (const f of SAMPLE.slice(0, 300)) {
			const st = stateOf(f, 'edge');
			for (const c of twistedCubies(st, 'edge'))
				expect(twistLetter(st, c, EDGE_UF)).toBe(canonical.get(c));
		}
	});
});

// ─────────────────────────────────────────────────────────────
// T1A-9. 채점
// ─────────────────────────────────────────────────────────────

describe('T1A-9. 채점 — 실행 모델', () => {
	const cubie = cubieOf('corner');
	const rot = rotationOf('corner');
	/** 끊기가 반드시 생기고 버퍼 조각이 밖에 나가 있는 상태를 하나 고른다. */
	const state = stateOf(
		SAMPLE.find((f) => {
			const st = stateOf(f, 'corner');
			const r = trace(st, CORNER_UBL);
			return (
				r.breakIns > 0 &&
				cubie[st[CORNER_UBL.primarySticker]] !== cubie[CORNER_UBL.primarySticker] &&
				Object.keys(rot).some(
					(c) => c !== cubie[CORNER_UBL.primarySticker] && rot[c].every((s) => st[s] === s)
				)
			);
		})!,
		'corner'
	);
	const base = trace(state, CORNER_UBL);
	const memo = (targets: string[], twists: string[] = []) => ({ targets, twists });

	it('1. 엔진이 낸 타깃 열은 정답', () => {
		expect(gradeMemo(state, memo(base.targets), CORNER_UBL)).toEqual({ kind: 'correct' });
	});

	it('2. 끊기 지점을 다르게 잡은 다른 메모도 정답 (문자열이 달라도 된다)', () => {
		const other = trace(state, { ...CORNER_UBL, pickBreakIn: (c) => c[c.length - 1] });
		expect(other.targets.join('')).not.toBe(base.targets.join(''));
		expect(gradeMemo(state, memo(other.targets), CORNER_UBL)).toEqual({ kind: 'correct' });
	});

	it('3. 불필요한 끊기는 오답이 아니라 correct-extra 다', () => {
		// 처음부터 풀려 있어 타깃 열에 안 나오는 큐비를 하나 골라 두 번 친다.
		const untouched = Object.keys(rot).find(
			(c) => c !== cubie[CORNER_UBL.primarySticker] && rot[c].every((s) => state[s] === s)
		)!;
		const s = rot[untouched][0];
		const verdict = gradeMemo(state, memo([...base.targets, s, s]), CORNER_UBL);
		expect(verdict).toEqual({ kind: 'correct-extra', extra: 2 });
	});

	it('4. 같은 큐비의 다른 스티커는 wrong-orientation', () => {
		const wrong = rot[cubie[base.targets[0]]].find((s) => s !== base.targets[0])!;
		expect(gradeMemo(state, memo([wrong, ...base.targets.slice(1)]), CORNER_UBL)).toEqual({
			kind: 'wrong-at',
			index: 0,
			reason: 'wrong-orientation',
			expected: base.targets[0]
		});
	});

	it('5. 엉뚱한 큐비는 wrong-piece', () => {
		const wrong = lettersOf('corner').find(
			(s) =>
				!CORNER_UBL.bufferStickers.includes(s) &&
				cubie[s] !== cubie[base.targets[0]] &&
				cubie[s] !== cubie[CORNER_UBL.primarySticker]
		)!;
		expect(gradeMemo(state, memo([wrong, ...base.targets.slice(1)]), CORNER_UBL)).toEqual({
			kind: 'wrong-at',
			index: 0,
			reason: 'wrong-piece',
			expected: base.targets[0]
		});
	});

	/** 버퍼 사이클의 길이 — 여기까지 치면 손이 빈다(사이클 닫힘). */
	const firstCycle = (() => {
		let n = 0;
		let t = state[CORNER_UBL.primarySticker];
		while (!CORNER_UBL.bufferStickers.includes(t)) {
			n++;
			t = state[t];
		}
		return n;
	})();

	it('6. 사이클 닫힘 시점에 이미 처리한 큐비로 끊으면 already-solved', () => {
		const done = base.targets[0]; // 첫 타깃으로 이미 제자리에 넣은 큐비
		const verdict = gradeMemo(
			state,
			memo([...base.targets.slice(0, firstCycle), done]),
			CORNER_UBL
		);
		expect(verdict).toEqual({
			kind: 'wrong-at',
			index: firstCycle,
			reason: 'already-solved',
			expected: null
		});
	});

	it('7. 사이클 닫힘 시점에는 안 푼 큐비의 아무 스티커나 된다', () => {
		const alt = trace(state, {
			...CORNER_UBL,
			pickBreakIn: (c) => c[c.length - 1]
		});
		const head = alt.targets.slice(0, firstCycle + 1);
		expect(head[firstCycle]).not.toBe(base.targets[firstCycle]);
		expect(gradeMemo(state, memo(head), CORNER_UBL).kind).toBe('incomplete');
		expect(gradeMemo(state, memo(alt.targets), CORNER_UBL)).toEqual({ kind: 'correct' });
	});

	it('8. 버퍼 스티커를 타깃으로 쓰면 buffer-sticker', () => {
		const verdict = gradeMemo(
			state,
			memo([CORNER_UBL.bufferStickers[1], ...base.targets]),
			CORNER_UBL
		);
		expect(verdict).toEqual({
			kind: 'wrong-at',
			index: 0,
			reason: 'buffer-sticker',
			expected: null
		});
	});

	it('9. 앞부분만 입력하면 incomplete + 남은 큐비 목록', () => {
		const head = base.targets.slice(0, firstCycle);
		const verdict = gradeMemo(state, memo(head), CORNER_UBL);
		expect(verdict.kind).toBe('incomplete');
		if (verdict.kind !== 'incomplete') return;
		expect(verdict.remaining.length).toBeGreaterThan(0);
		const residual = applyTargets(state, head, CORNER_UBL);
		expect(verdict.remaining).toEqual(
			Object.keys(rot)
				.filter((c) => rot[c].some((s) => residual[s] !== s))
				.sort((a, b) => lettersOf('corner').findIndex((s) => cubie[s] === a) -
					lettersOf('corner').findIndex((s) => cubie[s] === b))
		);
	});

	it('10. 조각 종류가 안 맞는 문자는 invalid-letter', () => {
		expect(gradeMemo(state, memo([base.targets[0], 'c']), CORNER_UBL)).toEqual({
			kind: 'invalid-letter',
			index: 1,
			letter: 'c'
		});
	});

	it('16. 어긋남이 둘이어도 첫 지점만 짚는다', () => {
		const bad = [...base.targets];
		const i = firstCycle - 1;
		bad[i] = rot[cubie[bad[i]]].find((s) => s !== bad[i])!;
		bad[i + 1] = rot[cubie[bad[i + 1]]].find((s) => s !== bad[i + 1])!;
		const verdict = gradeMemo(state, memo(bad), CORNER_UBL);
		expect(verdict.kind).toBe('wrong-at');
		if (verdict.kind === 'wrong-at') expect(verdict.index).toBe(i);
	});

	it('17. 패리티는 타깃 수의 홀짝이다', () => {
		const odd = SAMPLE.find((f) => trace(stateOf(f, 'corner'), CORNER_UBL).parity)!;
		const r = trace(stateOf(odd, 'corner'), CORNER_UBL);
		expect(r.parity).toBe(true);
		expect(r.targets.length % 2).toBe(1);
	});

	it('18. 같은 상태에서 관례 A 와 B 의 패리티가 같다', () => {
		for (const f of SAMPLE.slice(0, 300)) {
			const st = stateOf(f, 'corner');
			expect(trace(st, { ...CORNER_UBL, twistConvention: 'B' }).parity).toBe(
				trace(st, CORNER_UBL).parity
			);
		}
	});
});

describe('T1A-9. 채점 — 관례 B 의 비틀림 선언', () => {
	const B: TraceOptions = { ...CORNER_UBL, twistConvention: 'B' };
	/** 비틀림이 둘 이상 남는 상태 — 순서·누락·과잉을 전부 시험할 수 있다. */
	const state = stateOf(
		SAMPLE.find((f) => trace(stateOf(f, 'corner'), B).twists.length >= 2)!,
		'corner'
	);
	const base = trace(state, B);
	const memo = (targets: string[], twists: string[]) => ({ targets, twists });

	it('11. 타깃 열 + 정확한 비틀림 선언은 정답', () => {
		expect(gradeMemo(state, memo(base.targets, base.twists), B)).toEqual({ kind: 'correct' });
	});

	it('12. 비틀림 하나를 빠뜨리면 twist-mismatch 의 missing 에 잡힌다', () => {
		const verdict = gradeMemo(state, memo(base.targets, base.twists.slice(1)), B);
		expect(verdict).toEqual({
			kind: 'twist-mismatch',
			missing: [base.twists[0]],
			unexpected: []
		});
	});

	it('13. 없는 비틀림을 선언하면 unexpected 에 잡힌다', () => {
		const cubie = cubieOf('corner');
		const residual = applyTargets(state, base.targets, B);
		const left = twistedCubies(residual, 'corner');
		const bogus = lettersOf('corner').find(
			(s) => !base.twists.includes(s) && !left.includes(cubie[s])
		)!;
		const verdict = gradeMemo(state, memo(base.targets, [...base.twists, bogus]), B);
		expect(verdict).toEqual({ kind: 'twist-mismatch', missing: [], unexpected: [bogus] });
	});

	it('14. 비틀림은 집합으로 본다 — 순서가 달라도 정답', () => {
		expect(gradeMemo(state, memo(base.targets, [...base.twists].reverse()), B)).toEqual({
			kind: 'correct'
		});
	});

	it('15. 관례 A 세션의 비틀림 선언은 무시한다 (결정적)', () => {
		const a = trace(state, CORNER_UBL);
		expect(gradeMemo(state, memo(a.targets, ['B']), CORNER_UBL)).toEqual({ kind: 'correct' });
		expect(gradeMemo(state, memo(a.targets, []), CORNER_UBL)).toEqual({ kind: 'correct' });
	});

	it('타깃 열만 맞고 비틀림 문자가 조각 종류에 안 맞으면 invalid-letter', () => {
		const verdict = gradeMemo(state, memo(base.targets, ['c']), B);
		expect(verdict).toEqual({
			kind: 'invalid-letter',
			index: base.targets.length,
			letter: 'c'
		});
	});

	it('엣지 비틀림 선언은 같은 큐비의 두 문자 중 어느 쪽이든 정답', () => {
		const edgeB: TraceOptions = { ...EDGE_UF, twistConvention: 'B' };
		const cubie = cubieOf('edge');
		const rot = rotationOf('edge');
		const f = SAMPLE.find((x) => trace(stateOf(x, 'edge'), edgeB).twists.length >= 1)!;
		const st = stateOf(f, 'edge');
		const r = trace(st, edgeB);
		const flipped = r.twists.map((t) => rot[cubie[t]].find((s) => s !== t)!);
		expect(gradeMemo(st, { targets: r.targets, twists: r.twists }, edgeB)).toEqual({
			kind: 'correct'
		});
		expect(gradeMemo(st, { targets: r.targets, twists: flipped }, edgeB)).toEqual({
			kind: 'correct'
		});
	});
});

// ─────────────────────────────────────────────────────────────
// T4-8. 한 줄 입력의 판독 — readEntry / gradeEntry (FR-TR-18, 24)
// ─────────────────────────────────────────────────────────────

/**
 * 입력 구획이 하나로 합쳐지면서 "어느 것이 비틀림인가" 를 사용자가 아니라
 * **판독기가** 정한다. 그 규칙이 틀리면 맞게 친 답이 오답으로 돌아오므로,
 * 여기가 이번 변경에서 가장 무거운 테스트다.
 *
 * 기대값을 문자열로 적지 않는다. 관례 A·B 의 입력을 엔진으로 만들고, 판독이
 * 그것을 되돌리는지를 본다 — 버퍼가 바뀌어도 따라온다 (FR-TR-7).
 */
describe('T4-8. 한 줄 입력 판독', () => {
	/** 표본 하나에서 두 관례의 산출과 그때의 비틀림 문자를 뽑는다. */
	function bothWays(f: string, opts: TraceOptions) {
		const state = stateOf(f, opts.pieceKind);
		const a = trace(state, { ...opts, twistConvention: undefined });
		const b = trace(state, { ...opts, twistConvention: 'B' });
		return { state, a, b };
	}

	/** 타깃 열을 실행한 뒤 남는 비틀림 문자들. 판독기를 쓰지 않고 직접 계산한다. */
	const residualLetters = (state: CubeState, targets: string[], opts: TraceOptions) => {
		const residual = applyTargets(state, targets, opts);
		return twistedCubies(residual, opts.pieceKind).map((c) => twistLetter(residual, c, opts));
	};

	describe.each(FIXTURES)('%s', (_name, opts) => {
		const kind = opts.pieceKind;
		const bufferCubie = cubieOf(kind)[opts.primarySticker];
		const rot = rotationOf(kind);
		const sample = SAMPLE.slice(0, 400);

		it('끊어서 처리한 입력은 전부 타깃으로 읽는다 (관례 A)', () => {
			let twisted = 0;
			for (const f of sample) {
				const { state, a } = bothWays(f, opts);
				const r = readEntry(state, a.targets, opts);
				expect(r.twists).toEqual([]);
				expect(r.targets).toEqual(a.targets);
				expect(r.separated).toBe(false);
				if (r.absorbed > 0) twisted++;
				expect(gradeEntry(state, a.targets, opts).verdict).toEqual({ kind: 'correct' });
			}
			// 흡수한 비틀림이 한 번도 없었다면 이 테스트는 아무것도 안 본 것이다.
			expect(twisted).toBeGreaterThan(0);
		});

		it('따로 처리한 입력은 비틀림을 갈라낸다 (관례 B)', () => {
			let seen = 0;
			for (const f of sample) {
				const { state, b } = bothWays(f, opts);
				if (b.twists.length === 0) continue;
				seen++;
				const entry = [...b.targets, ...b.twists];
				const r = readEntry(state, entry, opts);
				expect(new Set(r.twists)).toEqual(new Set(b.twists));
				expect(r.targets).toEqual(b.targets);
				expect(r.separated).toBe(true);
				expect(gradeEntry(state, entry, opts).verdict).toEqual({ kind: 'correct' });
			}
			expect(seen).toBeGreaterThan(0);
		});

		it('비틀림 선언의 순서를 바꿔도 같이 읽는다 (집합이다)', () => {
			let seen = 0;
			for (const f of sample) {
				const { state, b } = bothWays(f, opts);
				if (b.twists.length < 2) continue;
				seen++;
				const entry = [...b.targets, ...[...b.twists].reverse()];
				expect(gradeEntry(state, entry, opts).verdict).toEqual({ kind: 'correct' });
			}
			expect(seen).toBeGreaterThan(0);
		});

		it('두 관례를 섞어 쳐도 정답이다', () => {
			let seen = 0;
			for (const f of sample) {
				const { state, b } = bothWays(f, opts);
				// 버퍼가 아닌 비틀림 하나를 골라 **끊어서** 처리하고 나머지는 선언한다.
				const pick = b.twists.find((t) => cubieOf(kind)[t] !== bufferCubie);
				if (!pick || b.twists.length < 2) continue;
				const cubie = cubieOf(kind)[pick];
				// 끊고 들어가면 다음 타깃은 곧바로 같은 큐비다 — 그것이 판독 규칙 1 이다.
				const s = rot[cubie][0];
				const targets = [...b.targets, s, applyTargets(state, b.targets, opts)[s]];
				const declared = residualLetters(state, targets, opts);
				/*
				 * 끊어서 처리한 몫이 남은 비틀림을 **전부** 지워버리는 판은 건너뛴다.
				 * 방향의 합이 보존되므로 한 조각을 끊어 넣으면 버퍼가 지고 있던 보정이
				 * 함께 풀린다 (AD-8) — 그런 판은 섞어 친 것이 아니라 그냥 관례 A 다.
				 */
				if (declared.length === 0) continue;
				const entry = [...targets, ...declared];

				const r = readEntry(state, entry, opts);
				expect(r.targets).toEqual(targets);
				expect(new Set(r.twists)).toEqual(new Set(declared));
				expect(r.absorbed).toBe(1);
				expect(r.separated).toBe(true);
				// 흡수한 두 칸을 "불필요한 끊기" 라고 부르지 않는다.
				expect(gradeEntry(state, entry, opts).verdict).toEqual({ kind: 'correct' });
				seen++;
			}
			expect(seen).toBeGreaterThan(0);
		});

		it('버퍼 비틀림 선언을 정상 입력으로 읽는다', () => {
			let seen = 0;
			for (const f of sample) {
				const { state, b } = bothWays(f, opts);
				const bufferTwist = b.twists.find((t) => cubieOf(kind)[t] === bufferCubie);
				if (!bufferTwist) continue;
				seen++;
				const entry = [...b.targets, ...b.twists];
				const r = readEntry(state, entry, opts);
				expect(r.twists).toContain(bufferTwist);
				expect(r.targets).not.toContain(bufferTwist);
				expect(gradeEntry(state, entry, opts).verdict).toEqual({ kind: 'correct' });
			}
			expect(seen).toBeGreaterThan(0);
		});

		it('타깃 자리의 버퍼 스티커는 비틀림으로 읽지 않고 오답으로 짚는다', () => {
			let seen = 0;
			for (const f of sample) {
				const { state, a } = bothWays(f, opts);
				// 버퍼가 잔여에 비틀린 채 남지 않는 판만 본다 — 그때의 버퍼 문자는
				// 선언으로 읽을 근거가 없으므로 타깃 열에 남아야 한다.
				if (residualLetters(state, a.targets, opts).length > 0) continue;
				seen++;
				const entry = [opts.primarySticker, ...a.targets];
				const r = readEntry(state, entry, opts);
				expect(r.twists).toEqual([]);
				const { verdict } = gradeEntry(state, entry, opts);
				expect(verdict).toEqual({
					kind: 'wrong-at',
					index: 0,
					reason: 'buffer-sticker',
					expected: null
				});
			}
			expect(seen).toBeGreaterThan(0);
		});

		it('판정 인덱스가 입력 칸 번호로 돌아온다', () => {
			let seen = 0;
			for (const f of sample) {
				const { state, b } = bothWays(f, opts);
				if (b.twists.length === 0 || b.targets.length < 2) continue;
				seen++;
				// 비틀림 선언을 **맨 앞** 에 적고, 타깃 열 중간에 24글자 밖의 문자를 끼운다.
				const entry = [...b.twists, ...b.targets.slice(0, 2), '?', ...b.targets.slice(2)];
				const { verdict } = gradeEntry(state, entry, opts);
				// 타깃 열 기준이면 2, 입력 칸 기준이면 선언 개수만큼 밀린 자리다.
				expect(verdict).toEqual({
					kind: 'invalid-letter',
					index: b.twists.length + 2,
					letter: '?'
				});
				break;
			}
			expect(seen).toBe(1);
		});

		it('빈 입력은 아무것도 읽지 않는다', () => {
			const state = stateOf(SAMPLE[0], kind);
			const r = readEntry(state, [], opts);
			expect(r).toMatchObject({ targets: [], twists: [], separated: false, absorbed: 0 });
		});

		it('24글자 밖의 문자가 섞여도 던지지 않는다', () => {
			const state = stateOf(SAMPLE[0], kind);
			const { verdict } = gradeEntry(state, ['?', ...trace(state, opts).targets], opts);
			expect(verdict).toEqual({ kind: 'invalid-letter', index: 0, letter: '?' });
		});
	});
});

// ─────────────────────────────────────────────────────────────
// 정적 검사 (PHASE_1A_TEST §정적 검사)
// ─────────────────────────────────────────────────────────────

describe('엔진에 상수가 없다', () => {
	const src = readFileSync('src/lib/cube/trace.ts', 'utf8');

	it('버퍼·큐비 리터럴이 없다 (관례 이름 선언 한 줄 제외)', () => {
		const hits = src
			.split('\n')
			.map((line, i) => [i + 1, line] as const)
			.filter(([, line]) => /'(A|E|R|C|M|J|UBL|UFR|UF|DF)'/.test(line));
		// 남는 한 줄은 `TwistConvention` 선언이다. 관례 이름이지 스티커가 아니라
		// 버퍼 하드코딩(FR-TR-7)과 무관하고, 타입 선언이라 다르게 적을 수도 없다.
		expect(hits.map(([n, line]) => `${n}: ${line.trim()}`)).toEqual([
			`36: export type TwistConvention = 'A' | 'B';`
		]);
	});

	it('케이스 데이터에 의존하지 않는다', () => {
		expect(/loadDataset|corner-UBL/.test(src)).toBe(false);
	});

	it('화면·저장소에 의존하지 않는다', () => {
		expect(/svelte|localStorage|document|window/.test(src)).toBe(false);
	});

	it('버퍼·조각 옵션은 필수 필드다 (기본값을 두지 않는다)', () => {
		expect(/bufferStickers\?:|primarySticker\?:|pieceKind\?:/.test(src)).toBe(false);
	});
});
