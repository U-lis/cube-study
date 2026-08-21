/**
 * 3x3 큐브 시뮬레이터 — 무브 정의는 전부 외부 라이브러리(cubejs)가 한다.
 *
 * ─── 왜 자체 구현을 버렸나 ──────────────────────────────────
 * 0.3.0 까지는 `perms.json` 에 무브 테이블 27개를 직접 들고 있었다. 그 안의
 * `L` 이 표준의 역(물리적 `L'`)이었고 `E` 는 `D` 가 아니라 `U` 를 따랐는데,
 * 우리 검증은 그 파일로 만든 데이터를 그 파일로 확인하는 순환 논증이라
 * 378 케이스 전수 검증을 매번 통과했다. 실제 큐브로 돌려본 사용자가 잡았다.
 *
 * 그래서 무브의 물리를 우리 저장소에서 없앴다. 여기 남은 것은 큐브 상태를
 * Speffz 문자로 읽는 방법(`speffz.ts` 의 좌표)뿐이고, 그 좌표도 데이터의
 * `target1/target2` 삼중항과 대조해 확인한다 (`tests/unit/speffz.test.ts`).
 * ────────────────────────────────────────────────────────────
 *
 * ─── 핵심 규약 (0.3.0 과 동일) ───────────────────────────────
 * state 는 { 위치: 그_위치에_있는_원래_스티커 } 객체.
 * 풀린 상태 = { A:'A', B:'B', ... }
 * ────────────────────────────────────────────────────────────
 */

import Cube from 'cubejs/lib/cube.js';
import type { Cubie, Sticker } from '../domain/types.js';
import type { PieceKind } from './speffz.js';
import {
	CORNER_AT,
	CORNER_CUBIE,
	CORNER_FACELETS,
	CORNER_LETTERS,
	EDGE_AT,
	EDGE_CUBIE,
	EDGE_FACELETS,
	EDGE_LETTERS
} from './speffz.js';

export type { PieceKind } from './speffz.js';
export type CubeState = Record<Sticker, Sticker>;

export interface IdentifyOptions {
	bufferStickers?: Sticker[];
	primarySticker?: Sticker;
	bufferCubie?: Cubie;
}

const SOLVED_STRING = new Cube().asString();

/** 조각의 색 조합. 코너 3색·엣지 2색 조합은 큐브에서 유일하므로 조각을 특정한다. */
const colorKey = (facelets: number[], s: string) =>
	facelets
		.map((i) => s[i])
		.sort()
		.join('');

const BY_COLOR = {
	corner: new Map(
		Object.entries(CORNER_FACELETS).map(([cubie, ix]) => [colorKey(ix, SOLVED_STRING), cubie])
	),
	edge: new Map(
		Object.entries(EDGE_FACELETS).map(([cubie, ix]) => [colorKey(ix, SOLVED_STRING), cubie])
	)
};

/**
 * 54칸 facelet 문자열 → `CubeState` { 위치: 그 자리에 온 스티커의 원래 자리 }.
 *
 * 조각의 정체는 색 조합으로, 방향은 "그 색이 원래 어느 면이었나"로 되찾는다.
 * cubejs 내부 표현(cp/co/ep/eo)을 읽지 않는 이유는 그쪽 인덱스 관례를 우리가
 * 또 하나 떠안게 되기 때문이다. `asString()` 은 공개 API 이고 색은 거짓말을 안 한다.
 *
 * `permOf` 에서 떼어낸 것은 알고리즘 문자열 말고 **facelet 문자열** 에서도
 * 상태를 만들어야 하기 때문이다. 스크램블 워커가 준 문자열 하나에서 상태와
 * 3D 뷰어의 색을 같이 뽑아야 원본이 둘로 갈라지지 않는다 (AD-2).
 */
export function stateFromFacelets(s: string, kind: PieceKind): CubeState {
	const facelets = kind === 'corner' ? CORNER_FACELETS : EDGE_FACELETS;
	const at = kind === 'corner' ? CORNER_AT : EDGE_AT;
	const byColor = BY_COLOR[kind];

	const perm: CubeState = {};
	for (const indices of Object.values(facelets)) {
		const origin = byColor.get(colorKey(indices, s))!;
		for (const i of indices) {
			const source = facelets[origin].find((x) => SOLVED_STRING[x] === s[i])!;
			perm[at[i]] = at[source];
		}
	}
	return perm;
}

/** 알고리즘 하나의 스티커 치환. 물리는 cubejs 가 하고 우리는 읽기만 한다. */
function permOf(alg: string, kind: PieceKind): CubeState {
	const cube = new Cube();
	try {
		cube.move(alg);
	} catch (e) {
		// grade.ts 가 읽는 문구로 맞춰준다 (cubejs 는 "Invalid move: X" 라고 한다).
		const m = /(?:Invalid|Unknown) move: (\S+)/.exec((e as Error).message);
		throw new Error(`Unknown move: ${m ? m[1] : alg}`);
	}
	return stateFromFacelets(cube.asString(), kind);
}

export class CubeSim {
	private readonly cache = new Map<string, CubeState>();

	private perm(alg: string, kind: PieceKind): CubeState {
		const key = `${kind}:${alg}`;
		let p = this.cache.get(key);
		if (!p) {
			p = permOf(alg, kind);
			this.cache.set(key, p);
		}
		return p;
	}

	solvedCorners(): CubeState {
		return Object.fromEntries(CORNER_LETTERS.map((p) => [p, p]));
	}

	solvedEdges(): CubeState {
		return Object.fromEntries(EDGE_LETTERS.map((p) => [p, p]));
	}

	/** 알고리즘을 상태에 적용한다. 미지 무브는 throw. */
	apply(state: CubeState, alg: string, kind: PieceKind = 'corner'): CubeState {
		const trimmed = alg.trim();
		if (!trimmed) return { ...state };
		const table = this.perm(trimmed, kind);
		return Object.fromEntries(Object.keys(state).map((pos) => [pos, state[table[pos]]]));
	}

	applyToCorners(state: CubeState, alg: string): CubeState {
		return this.apply(state, alg, 'corner');
	}

	applyToEdges(state: CubeState, alg: string): CubeState {
		return this.apply(state, alg, 'edge');
	}

	isSolved(state: CubeState): boolean {
		return Object.entries(state).every(([pos, sticker]) => pos === sticker);
	}

	movedStickers(state: CubeState): [Sticker, Sticker][] {
		return Object.entries(state).filter(([pos, s]) => pos !== s);
	}

	/** 영향받은 큐비 집합 (정렬됨) */
	affectedCubies(state: CubeState, kind: PieceKind = 'corner'): Cubie[] {
		const map = kind === 'corner' ? CORNER_CUBIE : EDGE_CUBIE;
		const set = new Set<Cubie>();
		for (const [pos, s] of Object.entries(state)) {
			if (pos !== s) set.add(map[pos]);
		}
		return [...set].sort();
	}

	/** 알고리즘이 엣지를 전혀 안 건드리는가. 3-style 코너 알고리즘의 필수 조건. */
	isEdgeNeutral(alg: string): boolean {
		return this.isSolved(this.applyToEdges(this.solvedEdges(), alg));
	}

	/**
	 * 알고리즘이 어떤 3-style 케이스를 푸는지 식별한다 (UBL 버퍼 기준).
	 * 3-cycle 이 아니면 null. 퀴즈 채점의 핵심.
	 */
	identifyCase(alg: string, opts: IdentifyOptions = {}): string | null {
		const buffer = new Set(opts.bufferStickers ?? ['A', 'E', 'R']);
		const primary = opts.primarySticker ?? 'A';
		const bufferCubie = opts.bufferCubie ?? 'UBL';

		const st = this.applyToCorners(this.solvedCorners(), alg);
		const moved = this.movedStickers(st);
		if (moved.length !== 9) return null;

		const cubies = this.affectedCubies(st, 'corner');
		if (cubies.length !== 3 || !cubies.includes(bufferCubie)) return null;

		// X = 버퍼의 primary 스티커가 도착한 위치
		let X: Sticker | null = null;
		for (const [pos, s] of Object.entries(st)) {
			if (s === primary) {
				X = pos;
				break;
			}
		}
		if (!X || buffer.has(X)) return null;

		const Y = st[primary];
		if (buffer.has(Y) || st[Y] !== X) return null;

		return X + Y;
	}
}

let cached: CubeSim | null = null;

/** 시뮬레이터를 만든다. 모듈 스코프에 캐시된다. */
export async function getSim(): Promise<CubeSim> {
	if (!cached) cached = new CubeSim();
	return cached;
}
