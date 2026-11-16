/**
 * OP 코너 — 전수 풀이 회귀 (SPEC §3 "검증").
 *
 * 시드 고정 PRNG 로 코너만 뒤섞은 스크램블(엣지·센터는 풀린 상태)을 ~100개 만들고,
 * 각각에 대해:
 *   1. UBL 버퍼로 타깃 열을 추출한다 (기존 `trace` 재사용).
 *   2. 데이터 공식(`setup [Y] setup'` 을 펼친 것)을 순서대로 친다.
 *   3. 타깃 수가 짝수면 코너·엣지·센터 전부 풀려야 한다.
 *   4. 타깃 수가 홀수면 UB↔UL(facelet 37·46 + 1·3) 교환만 남고 나머지는 풀려야 한다.
 *
 * ─── 코너만 흩트린 스크램블을 왜 쓰는가 ──────────────────────
 * OP 공식 한 줄은 코너 교환 + 엣지 UB↔UL 교환이 함께 난다 (SPEC FR-OP-D-4).
 * N 개 공식을 치면 엣지에는 `N × UB↔UL` 이 쌓인다. 스크램블이 엣지를 흩트려
 * 두면 그 효과가 섞여서 "OP 가 코너를 풀었는가" 가 가려진다. 이 테스트의 논점은
 * **OP 공식의 효과** 이므로, 엣지는 처음부터 풀린 상태에서 시작한다.
 *
 * 코너만 흩트린 상태는 큐브 물리상 패리티 제약을 어길 수 있지만(코너 패리티만
 * 홀수인 상태), cubejs 는 facelet 문자열에서 큐브를 복원할 때 그 제약을 검사하지
 * 않는다 (`fromString` 은 그대로 받는다). 그래서 홀수 N 케이스도 그대로 확인한다
 * — 이 경우 끝에 UB↔UL 만 남는다.
 * ────────────────────────────────────────────────────────────
 *
 * 데이터 JSON 은 손대지 않는다 (CLAUDE.md). 테스트가 틀렸다는 결론이 나오면
 * 테스트를 고친다.
 */
import { describe, it, expect } from 'vitest';
import CubeBase from 'cubejs/lib/cube.js';

// cubejs 는 `fromString` 을 타입 선언에 담지 않는다 (`src/lib/cube/cubejs.d.ts`).
// 테스트에서만 쓰는 생성자라 여기서 좁혀 쓴다 — m2-solve 가 `randomize` 로 하는 것과 같은 규율.
const Cube = CubeBase as typeof CubeBase & { fromString(s: string): CubeBase };
import {
	itemsOf,
	expandY,
	type OpDataSet,
	type OpItem
} from '../../src/lib/domain/op.js';
import { trace, applyTarget, type TraceOptions } from '../../src/lib/cube/trace.js';
import { stateFromFacelets, type CubeState } from '../../src/lib/cube/sim.js';
import {
	CORNER_INDEX,
	CORNER_LETTERS,
	CORNER_ROTATION,
	CORNER_CUBIE
} from '../../src/lib/cube/speffz.js';
import dataJson from '../../src/lib/data/corner-UBL-op.json';

const ds = dataJson as unknown as OpDataSet;
const items: OpItem[] = itemsOf(ds);
const Y_PERM = ds.meta.yPerm;

/** 데이터 행 id → 펼친 공식 문자열. 매 스크램블마다 다시 만들지 않는다. */
const EXPANDED: Record<string, string> = {};
for (const item of items) EXPANDED[item.id] = expandY(item.alg, Y_PERM);

const CORNER_UBL: TraceOptions = {
	pieceKind: 'corner',
	bufferStickers: ['A', 'E', 'R'],
	primarySticker: 'A'
};

const SOLVED = new Cube().asString();

/** 시드 고정 PRNG (mulberry32). m2-solve.test.ts 와 같은 규율. */
function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 코너 솔브드 상태. speffz 문자 → 그 자리의 원래 스티커 (즉 자기 자신). */
function solvedCornerState(): CubeState {
	return Object.fromEntries(CORNER_LETTERS.map((s) => [s, s]));
}

/**
 * 코너 상태만 담은 CubeState 를 54칸 facelet 문자열로 되돌린다 (엣지·센터는 solved).
 *
 * 각 코너 자리 s 는 state[s] 가 "그 자리에 와 있는 원래 스티커" 다. 그 스티커의
 * 원래 색은 `SOLVED[CORNER_INDEX[state[s]]]` 다. 이 식 하나로 세 면이 다 정해진다
 * — `CORNER_ROTATION` 을 따로 돌릴 필요가 없다. 스티커마다 "원래 어느 자리의 색"
 * 을 묻고 그 색을 그 스티커의 현재 facelet 위치에 둔다.
 */
function faceletsFromCornerState(st: CubeState): string {
	const chars = SOLVED.split('');
	for (const s of CORNER_LETTERS) {
		chars[CORNER_INDEX[s]] = SOLVED[CORNER_INDEX[st[s]]];
	}
	return chars.join('');
}

/**
 * 임의 코너 스크램블을 만든다 — k 개의 무작위 applyTarget 을 solved 코너 상태에
 * 적용한다. 짝수 k → 짝수 패리티, 홀수 k → 홀수 패리티.
 *
 * 끊기(사이클 닫힘)가 섞이지 않도록 매번 **버퍼가 아닌 랜덤 자리** 를 교환 타깃으로
 * 쓴다. 그러면 매 교환이 "그 자리 내용과 버퍼 내용을 바꾼다" 는 뜻이고 결과가 늘
 * 순열이다 (큐비 집합이 섞인다).
 */
function makeCornerScramble(rand: () => number, k: number): CubeState {
	// 버퍼 아닌 코너 스티커 (A·E·R 제외) — 21개.
	const NON_BUFFER_STICKERS = CORNER_LETTERS.filter(
		(s) => !CORNER_UBL.bufferStickers.includes(s)
	);
	let state = solvedCornerState();
	for (let i = 0; i < k; i++) {
		const t = NON_BUFFER_STICKERS[Math.floor(rand() * NON_BUFFER_STICKERS.length)];
		state = applyTarget(state, t, CORNER_UBL);
	}
	return state;
}

/** 센터 facelets. 참조 비교에 쓴다. */
const CENTER_INDICES = [4, 13, 22, 31, 40, 49];

/**
 * 기대 facelet. 코너와 센터는 SOLVED, 엣지는:
 *   - 짝수 N: SOLVED 그대로.
 *   - 홀수 N: UB↔UL (facelet 1↔3, 46↔37) 교환.
 *
 * Y-perm 의 엣지 부수효과는 UB·UL 두 큐비를 통째로 바꾸는데, facelet 수준에서는
 * UB(1, 46) 과 UL(3, 37) 의 두 쌍이 1↔3, 46↔37 로 간다 (B 면 ↔ L 면).
 */
function expectedFacelets(oddN: boolean): string {
	if (!oddN) return SOLVED;
	const chars = SOLVED.split('');
	[chars[1], chars[3]] = [chars[3], chars[1]];
	[chars[46], chars[37]] = [chars[37], chars[46]];
	return chars.join('');
}

describe('OP 전수 풀이: ~100 스크램블, 짝수 → 전부 풀림 / 홀수 → UB↔UL 만', () => {
	const SCRAMBLE_LEN_MIN = 2;
	const SCRAMBLE_LEN_MAX = 12;

	// 짝/홀 두 블록으로 나눠 300씩 돌려 각 분기에 ≥50 샘플이 들어가게 한다.
	// (m2-solve 와 같은 규율.)
	it('짝수 개수 타깃: 코너·엣지·센터 전부 solved', () => {
		const rand = mulberry32(42);
		let evenChecked = 0;
		for (let n = 0; n < 300; n++) {
			const k =
				SCRAMBLE_LEN_MIN + Math.floor(rand() * (SCRAMBLE_LEN_MAX - SCRAMBLE_LEN_MIN + 1));
			const scrambleState = makeCornerScramble(rand, k);
			const scrambledFacelets = faceletsFromCornerState(scrambleState);
			const cube = Cube.fromString(scrambledFacelets);

			const traced = trace(scrambleState, CORNER_UBL);
			const N = traced.targets.length;
			if (N % 2 !== 0) continue;
			evenChecked++;

			for (const letter of traced.targets) {
				const id = letter.toLowerCase();
				const alg = EXPANDED[id];
				if (alg === undefined) {
					throw new Error(`row ${id} not found (letter ${letter})`);
				}
				cube.move(alg);
			}

			const got = cube.asString();
			expect(
				got,
				`k=${k}, targets=${traced.targets.join(',')}, scramble state ${JSON.stringify(scrambleState)}`
			).toBe(SOLVED);
		}
		expect(evenChecked, '짝수 샘플이 50개 이상이어야 유의미').toBeGreaterThan(50);
	});

	it('홀수 개수 타깃: UB↔UL 교환만, 나머지 풀림', () => {
		const rand = mulberry32(42);
		let oddChecked = 0;
		for (let n = 0; n < 300; n++) {
			const k =
				SCRAMBLE_LEN_MIN + Math.floor(rand() * (SCRAMBLE_LEN_MAX - SCRAMBLE_LEN_MIN + 1));
			const scrambleState = makeCornerScramble(rand, k);
			const scrambledFacelets = faceletsFromCornerState(scrambleState);
			const cube = Cube.fromString(scrambledFacelets);

			const traced = trace(scrambleState, CORNER_UBL);
			const N = traced.targets.length;
			if (N % 2 === 0) continue;
			oddChecked++;

			for (const letter of traced.targets) {
				const id = letter.toLowerCase();
				cube.move(EXPANDED[id]);
			}

			const got = cube.asString();
			expect(
				got,
				`k=${k}, targets=${traced.targets.join(',')}, scramble state ${JSON.stringify(scrambleState)}`
			).toBe(expectedFacelets(true));
		}
		expect(oddChecked, '홀수 샘플이 20개 이상이어야 유의미').toBeGreaterThan(20);
	});
});

describe('OP 코너 공식 자체: 센터 facelets 는 결코 바뀌지 않는다', () => {
	// Y-perm 과 데이터 setup 은 D, F, R 계열만 쓴다. 모두 면 회전이라
	// 센터 facelet 의 색이 그대로 남는다 (SPEC FR-OP-D-1).
	for (const item of items) {
		it(`${item.id}: 센터 6칸 변화 없음`, () => {
			const alg = EXPANDED[item.id];
			const f = Cube.fromString(SOLVED).move(alg).asString();
			for (const i of CENTER_INDICES) {
				expect(f[i], `center ${i}`).toBe(SOLVED[i]);
			}
		});
	}
});

// unused import 가 아니라 CubeState 설명의 참조로 남긴다 — IDE/린트가 지우지 않도록.
void CORNER_CUBIE;
void CORNER_ROTATION;
