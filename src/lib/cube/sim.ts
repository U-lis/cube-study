/**
 * 3x3 큐브 스티커 시뮬레이터.
 *
 * 원본: .dc_workspace/handoff/sim/cube-sim.js (378케이스 전수 검증 통과).
 * 타입만 입혔고 로직과 규약은 그대로다. 재작성이 아니다.
 *
 * ─── 핵심 규약 ───────────────────────────────────────────────
 * state 는 { 위치: 그_위치에_있는_원래_스티커 } 객체.
 * 풀린 상태 = { A:'A', B:'B', ... }
 *
 * 무브 적용: next[pos] = st[table[pos]]
 * perms.json 의 테이블에는 역치환이 이미 적용되어 있어 단순 조회로 동작한다.
 * Python 원본(bld_sim.py)은 반대 규약이므로 그쪽을 참고해 옮기면 결과가 어긋난다.
 * ────────────────────────────────────────────────────────────
 */

import type { Cubie, Sticker } from '../domain/types.js';

export type PieceKind = 'corner' | 'edge';
export type CubeState = Record<Sticker, Sticker>;
type MoveTable = Record<Sticker, Sticker>;

export interface Perms {
	_convention?: string;
	cornerLetters: string;
	edgeLetters: string;
	cornerLetterToCubie: Record<Sticker, Cubie>;
	edgeLetterToCubie: Record<Sticker, Cubie>;
	cornerMoves: Record<string, MoveTable>;
	edgeMoves: Record<string, MoveTable>;
}

export interface IdentifyOptions {
	bufferStickers?: Sticker[];
	primarySticker?: Sticker;
	bufferCubie?: Cubie;
}

export class CubeSim {
	private readonly perms: Perms;
	private readonly cornerLetters: Sticker[];
	private readonly edgeLetters: Sticker[];

	constructor(perms: Perms) {
		this.perms = perms;
		this.cornerLetters = perms.cornerLetters.split('');
		this.edgeLetters = perms.edgeLetters.split('');
	}

	solvedCorners(): CubeState {
		return Object.fromEntries(this.cornerLetters.map((p) => [p, p]));
	}

	solvedEdges(): CubeState {
		return Object.fromEntries(this.edgeLetters.map((p) => [p, p]));
	}

	/** 알고리즘을 상태에 적용한다. 미지 무브는 throw. */
	apply(state: CubeState, alg: string, kind: PieceKind = 'corner'): CubeState {
		const moves = kind === 'corner' ? this.perms.cornerMoves : this.perms.edgeMoves;
		let st: CubeState = { ...state };
		const trimmed = alg.trim();
		if (!trimmed) return st;

		for (const tok of trimmed.split(/\s+/)) {
			if (!tok) continue;
			const table = moves[tok];
			if (!table) throw new Error(`Unknown move: ${tok}`);
			const next: CubeState = {};
			for (const pos in st) next[pos] = st[table[pos]];
			st = next;
		}
		return st;
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
		const map =
			kind === 'corner' ? this.perms.cornerLetterToCubie : this.perms.edgeLetterToCubie;
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

/** 기본 perms 로 시뮬레이터를 만든다. 모듈 스코프에 캐시된다. */
export async function getSim(): Promise<CubeSim> {
	if (cached) return cached;
	const mod = await import('./perms.json');
	cached = new CubeSim(mod.default as unknown as Perms);
	return cached;
}
