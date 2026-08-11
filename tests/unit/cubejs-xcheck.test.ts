/**
 * 외부 라이브러리 교차 검증 — 기준은 `cubejs` (Kociemba 2-phase 구현).
 *
 * v9 이전 데이터는 생성 시뮬레이터의 `L` 이 표준의 역(물리적 `L'`)이었는데,
 * 자체 검증을 전부 통과했다. 검증이 순환 논증이었기 때문이다 — 같은 도구로
 * 만들고 같은 도구로 확인했고, x=R L' 같은 항등식은 내부 정의끼리의 비교라
 * 전역 뒤집힘을 못 잡으며, T-perm·sexy 같은 표본은 `L` 을 쓰지 않았다.
 *
 * 그래서 이 파일만은 `src/lib/cube` 를 일절 쓰지 않는다. facelet 좌표부터
 * 여기서 다시 세우고, perms.json 과 378케이스를 외부 구현과 대조한다.
 * 다른 테스트는 sim.ts 를 쓰므로 이 파일이 깨지면 그쪽 통과는 의미가 없다.
 */
import { describe, it, expect } from 'vitest';
import Cube from 'cubejs';
import permsJson from '../../src/lib/cube/perms.json';
import dataJson from '../../src/lib/data/corner-UBL.json';

type Facelets = Record<string, number[]>;

// cubejs 의 asString() 은 URFDLB 순서 54칸. 아래 좌표는 그 배열의 인덱스다.
// U:0-8 R:9-17 F:18-26 D:27-35 L:36-44 B:45-53 (각 면 좌상→우하)
const CORNER_SP: Record<string, number> = {
	A: 0, B: 2, C: 8, D: 6,        // U
	E: 36, F: 38, G: 44, H: 42,    // L
	I: 18, J: 20, K: 26, L: 24,    // F
	M: 9, N: 11, O: 17, P: 15,     // R
	Q: 45, R: 47, S: 53, T: 51,    // B
	U: 27, V: 29, W: 35, X: 33     // D
};
const EDGE_SP: Record<string, number> = {
	a: 1, b: 5, c: 7, d: 3,
	e: 37, f: 41, g: 43, h: 39,
	i: 19, j: 23, k: 25, l: 21,
	m: 10, n: 14, o: 16, p: 12,
	q: 46, r: 50, s: 52, t: 48,
	u: 28, v: 32, w: 34, x: 30
};
const CORNER_FACELETS: Facelets = {
	UBL: [0, 36, 47], UBR: [2, 45, 11], UFR: [8, 9, 20], UFL: [6, 38, 18],
	DFL: [27, 44, 24], DFR: [29, 26, 15], DBR: [35, 17, 51], DBL: [33, 42, 53]
};
const EDGE_FACELETS: Facelets = {
	UB: [1, 46], UR: [5, 10], UF: [7, 19], UL: [3, 37],
	FR: [23, 12], FL: [21, 41], BR: [48, 14], BL: [50, 39],
	DF: [28, 25], DR: [32, 16], DB: [34, 52], DL: [30, 43]
};

const SOLVED = new Cube().asString();
const invert = (m: Record<string, number>) =>
	Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const CORNER_AT = invert(CORNER_SP);
const EDGE_AT = invert(EDGE_SP);

/** 큐비를 색 조합으로 식별한다 (코너 3색·엣지 2색 조합은 유일). */
const colorKey = (idx: number[], s: string) => idx.map((i) => s[i]).sort().join('');

/**
 * `alg` 를 cubejs 로 돌린 뒤 { 위치 스티커: 그 자리에 온 스티커의 원래 자리 } 를 낸다.
 * perms.json 의 규약(new[pos] = old[table[pos]])과 같은 방향이라 풀린 상태에서는
 * 테이블과 직접 비교할 수 있다.
 */
function stickerPerm(alg: string, facelets: Facelets, at: Record<number, string>) {
	const cube = new Cube();
	cube.move(alg);
	const s = cube.asString();
	const byColor = new Map(
		Object.entries(facelets).map(([cubie, idx]) => [colorKey(idx, SOLVED), cubie])
	);
	const out: Record<string, string> = {};
	for (const [, idx] of Object.entries(facelets)) {
		const origin = byColor.get(colorKey(idx, s));
		if (!origin) throw new Error(`큐비 식별 실패: ${alg}`);
		for (const i of idx) {
			const src = facelets[origin].find((x) => SOLVED[x] === s[i]);
			out[at[i]] = at[src!];
		}
	}
	return out;
}
const cornerPerm = (alg: string) => stickerPerm(alg, CORNER_FACELETS, CORNER_AT);
const edgePerm = (alg: string) => stickerPerm(alg, EDGE_FACELETS, EDGE_AT);

const FACE_MOVES = ['U', 'D', 'R', 'L', 'F', 'B'].flatMap((f) => [f, `${f}'`, `${f}2`]);

// ── 슬라이스(M E S) — cubejs 는 면 무브만 안다 ────────────────────────────
//
// 그래서 회전을 경유한다. 회전표는 큐비·면 이름의 글자 치환으로 기계적으로 만들고
// (손으로 적은 표가 아니다), cubejs 로 검증된 면 무브와의 켤레 관계로 그 회전표가
// 맞는지부터 확인한다. 그 다음에야 슬라이스를 회전 항등식으로 검증한다.
//
//   x' = L R' M      (M 은 L 방향)
//   y  = U D' E'     (E 는 D 방향)
//   z  = F B' S      (S 는 F 방향)
//
// 이 관례("M 은 L, E 는 D, S 는 F 를 따른다")를 이 파일이 유일하게 붙들고 있다.
const AXIS: Record<string, Record<string, string>> = {
	x: { U: 'B', B: 'D', D: 'F', F: 'U', R: 'R', L: 'L' },
	y: { F: 'L', L: 'B', B: 'R', R: 'F', U: 'U', D: 'D' },
	z: { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' }
};
const faceOf = (i: number) => 'URFDLB'[Math.floor(i / 9)];
const sorted = (s: string) => [...s].sort().join('');

/** 회전을 큐비·면 이름 치환으로 옮겨 { 위치: 원래 위치 } 표를 만든다. */
function rotTable(axis: string, facelets: Facelets, at: Record<number, string>) {
	const m = AXIS[axis];
	const indexOf: Record<string, number> = {};
	for (const [cubie, idx] of Object.entries(facelets))
		for (const i of idx) indexOf[`${cubie}|${faceOf(i)}`] = i;
	const table: Record<string, string> = {};
	for (const [cubie, idx] of Object.entries(facelets)) {
		const moved = sorted([...cubie].map((ch) => m[ch]).join(''));
		const target = Object.keys(facelets).find((k) => sorted(k) === moved)!;
		for (const i of idx) table[at[indexOf[`${target}|${m[faceOf(i)]}`]]] = at[i];
	}
	return table;
}

type Table = Record<string, string>;
const invertTable = (t: Table): Table =>
	Object.fromEntries(Object.entries(t).map(([k, v]) => [v, k]));
/** "A 다음 B" 의 표. perms 규약(next[pos] = st[table[pos]])에서 따라 나온다. */
const compose = (a: Table, b: Table): Table =>
	Object.fromEntries(Object.keys(a).map((p) => [p, a[b[p]]]));
const identity = (t: Table): Table =>
	Object.fromEntries(Object.keys(t).map((p) => [p, p]));
const algTable = (alg: string, moves: Record<string, Table>): Table =>
	alg
		.trim()
		.split(/\s+/)
		.reduce((acc, tok) => compose(acc, moves[tok]), identity(moves['U']));
/** R T R⁻¹ */
const conjugate = (r: Table, t: Table): Table => {
	const ri = invertTable(r);
	return Object.fromEntries(Object.keys(t).map((p) => [p, r[t[ri[p]]]]));
};

const KINDS = [
	['코너', permsJson.cornerMoves as unknown as Record<string, Table>, CORNER_FACELETS, CORNER_AT],
	['엣지', permsJson.edgeMoves as unknown as Record<string, Table>, EDGE_FACELETS, EDGE_AT]
] as const;

describe('cubejs 교차 검증 — Speffz 좌표', () => {
	it('perms.json 의 스티커→큐비 대응이 facelet 좌표와 일치한다 (48개)', () => {
		const bad: string[] = [];
		for (const [sp, cubie] of Object.entries(permsJson.cornerLetterToCubie))
			if (!CORNER_FACELETS[cubie].includes(CORNER_SP[sp])) bad.push(`${sp}→${cubie}`);
		for (const [sp, cubie] of Object.entries(permsJson.edgeLetterToCubie))
			if (!EDGE_FACELETS[cubie].includes(EDGE_SP[sp])) bad.push(`${sp}→${cubie}`);
		expect(bad).toEqual([]);
	});

	it('cubejs 의 L 이 표준이다 (U 스티커가 F 로)', () => {
		// 이 한 줄이 v9 버그의 진원지다. 기준 라이브러리부터 확인하고 시작한다.
		expect(cornerPerm('L')['I']).toBe('A'); // UFL 의 F면 ← UBL 의 U면
	});
});

describe('cubejs 교차 검증 — 무브 테이블', () => {
	it.each(FACE_MOVES)('%s 의 코너 테이블이 cubejs 와 같다', (m) => {
		expect(permsJson.cornerMoves[m as keyof typeof permsJson.cornerMoves]).toEqual(
			cornerPerm(m)
		);
	});
	it.each(FACE_MOVES)('%s 의 엣지 테이블이 cubejs 와 같다', (m) => {
		expect(permsJson.edgeMoves[m as keyof typeof permsJson.edgeMoves]).toEqual(edgePerm(m));
	});
});

describe('cubejs 교차 검증 — 378 케이스 × 2 표기', () => {
	const cases = Object.entries(dataJson.cases) as [
		string,
		{ direct: { alg: string }; setup: { alg: string } }
	][];

	it('756개 알고리즘이 각자의 케이스를 푼다 (방향 포함)', () => {
		const bad: string[] = [];
		for (const [code, c] of cases) {
			const [x, y] = [code[0], code[1]];
			for (const mode of ['direct', 'setup'] as const) {
				const p = cornerPerm(c[mode].alg);
				// 케이스 XY = 버퍼 조각이 X 자리로, X 조각이 Y 자리로, Y 조각이 버퍼로.
				// 스티커 추적이므로 방향(orientation)까지 걸린다.
				if (p['A'] !== y || p[x] !== 'A' || p[y] !== x)
					bad.push(`${code}/${mode}: A→${p['A']}, ${x}→${p[x]}, ${y}→${p[y]}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('756개 알고리즘이 엣지를 건드리지 않는다', () => {
		const bad: string[] = [];
		for (const [code, c] of cases)
			for (const mode of ['direct', 'setup'] as const) {
				const p = edgePerm(c[mode].alg);
				if (Object.entries(p).some(([pos, st]) => pos !== st)) bad.push(`${code}/${mode}`);
			}
		expect(bad).toEqual([]);
	});
});

describe('cubejs 교차 검증 — 합성 규약', () => {
	it('테이블 합성이 cubejs 의 연속 적용과 같다', () => {
		expect(algTable('R U', permsJson.cornerMoves as unknown as Record<string, Table>)).toEqual(
			cornerPerm('R U')
		);
		expect(algTable('R U', permsJson.edgeMoves as unknown as Record<string, Table>)).toEqual(
			edgePerm('R U')
		);
	});
});

describe.each(KINDS)('슬라이스 검증 (%s)', (_kind, moves, facelets, at) => {
	const rot = {
		x: rotTable('x', facelets, at),
		y: rotTable('y', facelets, at),
		z: rotTable('z', facelets, at)
	};

	// 회전표를 먼저 검증한다. x U x' = F 처럼, 켤레를 취하면 "회전이 그 자리로
	// 보내는 면" 의 무브가 나와야 한다. 방향을 반대로 잡았으면 여기서 깨진다.
	it.each(['x', 'y', 'z'])('%s 회전표가 면 무브 6개와 켤레 관계다', (axis) => {
		const bad: string[] = [];
		for (const f of ['U', 'D', 'R', 'L', 'F', 'B']) {
			const source = Object.entries(AXIS[axis]).find(([, to]) => to === f)![0];
			try {
				expect(conjugate(rot[axis as 'x'], moves[f])).toEqual(moves[source]);
			} catch {
				bad.push(`${axis}: ${f} 자리로 오는 면은 ${source} 인데 켤레가 다르다`);
			}
		}
		expect(bad).toEqual([]);
	});

	it("M 은 L 방향이다 (L R' M = x')", () => {
		expect(algTable("L R' M", moves)).toEqual(invertTable(rot.x));
	});
	it("E 는 D 방향이다 (U D' E' = y)", () => {
		expect(algTable("U D' E'", moves)).toEqual(rot.y);
	});
	it("S 는 F 방향이다 (F B' S = z)", () => {
		expect(algTable("F B' S", moves)).toEqual(rot.z);
	});

	it('슬라이스의 역·2회전이 서로 맞다', () => {
		for (const s of ['M', 'E', 'S']) {
			expect(algTable(`${s} ${s}'`, moves)).toEqual(identity(moves['U']));
			expect(algTable(`${s} ${s}`, moves)).toEqual(moves[`${s}2`]);
		}
	});
});
