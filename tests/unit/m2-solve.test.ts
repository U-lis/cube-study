/**
 * M2 엣지 — 전수 풀이 회귀 (SPEC §2 "풀이 전체").
 *
 * 시드 고정 PRNG 로 무작위 25-무브 스크램블을 ~300개 만들고, 각각에 대해:
 * 1. DF 버퍼로 타깃 열을 추출한다 (추상 교환으로).
 * 2. 데이터의 공식을 순서대로 친다 — C·W·I·S 짝수 번째는 `{letter}2` 행 id.
 * 3. 짝수 개수면 엣지·센터·코너 전부 풀려야 한다.
 * 4. 홀수 개수면 패리티 공식을 추가 — UB↔UL 교환만 남고 센터·코너는 풀린다.
 *
 * 이 검사가 지키는 것: 데이터 공식의 효과가 실제 풀이로 이어진다는 것.
 * 데이터 JSON 은 손대지 않는다. 이 테스트가 깨지면 데이터가 아니라 데이터를
 * 돌리는 쪽을 먼저 의심한다 (CLAUDE.md).
 */
import { describe, it, expect } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import {
	CORNER_FACELETS,
	EDGE_AT,
	EDGE_FACELETS,
	EDGE_INDEX
} from '../../src/lib/cube/speffz.js';
import dataJson from '../../src/lib/data/edge-DF-m2.json';
import { type M2DataSet } from '../../src/lib/domain/m2.js';

const ds = dataJson as unknown as M2DataSet;

/** 큐비 → 두 스티커 문자 (예: UF → ['c', 'i']). speffz 좌표에서 파생. */
const EDGE_LETTERS_OF: Record<string, string[]> = Object.fromEntries(
	Object.entries(EDGE_FACELETS).map(([piece, idxs]) => [piece, idxs.map((i) => EDGE_AT[i])])
);
/** 스티커 → 그 짝 스티커. UF 는 c↔i. */
const MATE: Record<string, string> = {};
for (const [, pair] of Object.entries(EDGE_LETTERS_OF)) {
	MATE[pair[0]] = pair[1];
	MATE[pair[1]] = pair[0];
}
const EDGE_PAIRS: string[][] = Object.values(EDGE_LETTERS_OF);

/** 시드 고정 PRNG (mulberry32). 재현 가능한 랜덤 스크램블용. */
function mulberry32(seed: number) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 54칸 facelet → 엣지 조각 상태 { 위치: 그 자리에 온 원래 스티커 }. solve.mjs 와 같은 규약. */
function edgeState(s: string): Record<string, string> {
	const COLOR: Record<string, string> = {};
	const solved = new Cube().asString();
	for (const letter of Object.keys(EDGE_INDEX)) {
		COLOR[letter] = solved[EDGE_INDEX[letter]];
	}
	const st: Record<string, string> = {};
	for (const pair of EDGE_PAIRS) {
		const [x, y] = pair;
		const cx = s[EDGE_INDEX[x]];
		const cy = s[EDGE_INDEX[y]];
		for (const q of EDGE_PAIRS) {
			const [a, b] = q;
			if (COLOR[a] === cx && COLOR[b] === cy) {
				st[x] = a;
				st[y] = b;
			} else if (COLOR[b] === cx && COLOR[a] === cy) {
				st[x] = b;
				st[y] = a;
			}
		}
	}
	return st;
}

/**
 * DF 버퍼로 메모한다 — solve.mjs 의 `memo` 와 같은 알고리즘.
 * 1. `st['u']` 가 가리키는 스티커를 다음 타깃으로 삼는다.
 * 2. 버퍼에 걸리면(u 또는 k) 아직 안 풀린 다른 조각의 첫 스티커로 사이클을 다시 시작한다.
 * 3. 추상 교환: u↔target, k↔mate.
 */
function memo(st0: Record<string, string>): string[] {
	const st = { ...st0 };
	const t: string[] = [];
	const solvedPair = (p: string[]) => st[p[0]] === p[0] && st[p[1]] === p[1];
	for (let g = 0; g < 40; g++) {
		let x = st.u;
		if (x === 'u' || x === 'k') {
			const nxt = EDGE_PAIRS.find((p) => !(p[0] === 'u' || p[1] === 'u') && !solvedPair(p));
			if (!nxt) break;
			x = nxt[0];
		}
		t.push(x);
		const y = MATE[x];
		[st.u, st[x]] = [st[x], st.u];
		[st.k, st[y]] = [st[y], st.k];
	}
	return t;
}

/** 랜덤 스크램블. */
function makeScramble(rand: () => number, n = 25): string {
	const FACES = 'UDLRFB';
	const MODS = ['', "'", '2'];
	let last = '';
	const out: string[] = [];
	for (let i = 0; i < n; i++) {
		let f = FACES[Math.floor(rand() * 6)];
		while (f === last) f = FACES[Math.floor(rand() * 6)];
		last = f;
		out.push(f + MODS[Math.floor(rand() * 3)]);
	}
	return out.join(' ');
}

/** 타깃 letter + 순번(0-indexed) → 데이터의 행 id. C·W·I·S 는 짝수 번째면 `${letter}2`. */
function rowIdFor(letter: string, k: number): string {
	if (k % 2 === 1 && (letter === 'c' || letter === 'w' || letter === 'i' || letter === 's')) {
		return `${letter}2`;
	}
	return letter;
}

const SWAP_LETTERS = ['a', 'd', 'q', 'e']; // UB↔UL 스티커 (패리티 후 남는 유일한 교환).
const SOLVED_FACELETS = new Cube().asString();
const SOLVED_CENTERS = [4, 13, 22, 31, 40, 49].map((i) => SOLVED_FACELETS[i]).join('');

function centers(f: string) {
	return [4, 13, 22, 31, 40, 49].map((i) => f[i]).join('');
}

function isAllEdgesSolved(st: Record<string, string>): boolean {
	return Object.keys(st).every((p) => st[p] === p);
}

/** UB↔UL 교환만 남은 상태인가. a↔d, q↔e 가 바뀌어 있고 그 외는 제자리. */
function isOnlyUbUlSwap(st: Record<string, string>): boolean {
	for (const p of Object.keys(st)) {
		if (SWAP_LETTERS.includes(p)) continue;
		if (st[p] !== p) return false;
	}
	return st.a === 'd' && st.d === 'a' && st.q === 'e' && st.e === 'q';
}

/** 코너 facelet 전체 (중복 없이). M2 공식은 이 자리들을 건드리지 않아야 한다. */
const CORNER_IDX: number[] = [...new Set(Object.values(CORNER_FACELETS).flat())];

describe('M2 전수 풀이: ~300 스크램블, 짝수 → 다 풀림 / 홀수 + 패리티 → UB↔UL 만', () => {
	// 300 번은 한 번에 돌리고 결과만 집계한다 — 각 스크램블을 it 블록으로 만들면
	// 실패 시 300 줄의 "같은 원인" 실패가 뜬다.
	it('짝수 개수 타깃: 공식을 순서대로 치면 엣지·센터가 풀리고 코너는 손대지 않는다', () => {
		const rand = mulberry32(42);
		let evenChecked = 0;
		for (let n = 0; n < 300; n++) {
			const sc = makeScramble(rand);
			const c = new Cube();
			c.move(sc);
			const scrambledFacelets = c.asString();
			const t = memo(edgeState(scrambledFacelets));
			if (t.length % 2 !== 0) continue; // 짝수만 이 블록에서 검사
			evenChecked++;
			for (let k = 0; k < t.length; k++) {
				const id = rowIdFor(t[k], k);
				const row = ds.rows.find((r) => r.id === id);
				if (!row) throw new Error(`row ${id} not found`);
				c.move(row.alg);
			}
			const curFacelets = c.asString();
			const st = edgeState(curFacelets);
			expect(isAllEdgesSolved(st), `scramble "${sc}" (targets: ${t.join(',')})`).toBe(true);
			expect(centers(curFacelets)).toBe(SOLVED_CENTERS);
			// 코너는 M2 공식의 범위 밖. 스크램블 직후와 같아야 한다.
			for (const i of CORNER_IDX) {
				expect(curFacelets[i], `corner facelet ${i} changed (scramble "${sc}")`).toBe(
					scrambledFacelets[i]
				);
			}
		}
		expect(evenChecked).toBeGreaterThan(50); // 300 중 상당수가 짝수여야 통계가 유의미.
	});

	it('홀수 개수 타깃 + 패리티: UB↔UL 교환만 남고 센터는 풀리고 코너는 손대지 않는다', () => {
		const rand = mulberry32(42);
		let oddChecked = 0;
		for (let n = 0; n < 300; n++) {
			const sc = makeScramble(rand);
			const c = new Cube();
			c.move(sc);
			const scrambledFacelets = c.asString();
			const t = memo(edgeState(scrambledFacelets));
			if (t.length % 2 === 0) continue;
			oddChecked++;
			for (let k = 0; k < t.length; k++) {
				const id = rowIdFor(t[k], k);
				const row = ds.rows.find((r) => r.id === id);
				if (!row) throw new Error(`row ${id} not found`);
				c.move(row.alg);
			}
			c.move(ds.parity.alg);
			const curFacelets = c.asString();
			const st = edgeState(curFacelets);
			expect(
				isOnlyUbUlSwap(st),
				`scramble "${sc}" (odd targets: ${t.join(',')}) — edges: ${JSON.stringify(st)}`
			).toBe(true);
			expect(centers(curFacelets)).toBe(SOLVED_CENTERS);
			for (const i of CORNER_IDX) {
				expect(curFacelets[i], `corner facelet ${i} changed (scramble "${sc}")`).toBe(
					scrambledFacelets[i]
				);
			}
		}
		expect(oddChecked).toBeGreaterThan(50);
	});
});
