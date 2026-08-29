/**
 * 랜덤 스테이트 스크램블의 순수부 + 큐 관리.
 *
 * Worker 컨텍스트에 의존하는 것이 하나도 없다. 풀이기(`Cube.initSolver()`)를 부르는 쪽은
 * `scramble.worker.ts` 하나뿐이고, 여기는 그 결과 문자열만 다룬다. 그래서 node 단위 테스트가
 * 1.7초짜리 초기화 없이 돈다.
 *
 * ─── `{ scramble, core }` 규약 (FR-TR-3, GLOBAL AD-10) ───────────────
 * `scramble` — 표시용. 사용자가 실물 큐브에 그대로 돌리는 문자열.
 * `core`     — **상태 계산용**. 방향 회전(x y z)을 제거한 문자열이다.
 *              `sim.applyToCorners/Edges` 에 넣는 쪽은 언제나 `core` 다.
 *
 * 회전은 `isSolved()` 를 유지한 채 `asString()` 의 facelet 배치만 바꾼다. 회전이 섞인
 * 문자열로 타깃을 계산하면 문자가 통째로 틀어지고, 원인을 찾기 매우 어렵다. 지금은
 * `Cube.random().solve()` 의 역이 면 무브만 내놓아 `core === scramble` 이지만, 규약을
 * 나중에 만들면 회전이 붙는 순간 조용히 깨진다.
 * ────────────────────────────────────────────────────────────────────
 */

import { invertAlg, splitMoves } from './notation.js';

export interface Scramble {
	/** 표시용. 방향 회전이 남아 있을 수 있다. */
	scramble: string;
	/** 상태 계산용. 방향 회전이 없다. */
	core: string;
}

/** 우리가 큐브 객체에서 쓰는 전부. 단위 테스트가 가짜 객체를 넘길 수 있게 좁게 잡는다. */
export interface CubeLike {
	solve(maxDepth?: number): string;
}

type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
type Axis = 'x' | 'y' | 'z';

/**
 * 회전이 면을 어디로 **보내는가**. `x` 는 `R`, `y` 는 `U`, `z` 는 `F` 방향의 전체 회전이다.
 * 예: `y` 는 U 를 돌리는 방향이라 F 면이 통째로 L 자리로 간다 → F→L→B→R→F.
 * (cubejs 로 확인: `new Cube().move('y').asString()` 의 L 면이 전부 F 색이다)
 */
const CYCLE: Record<Axis, Face[]> = {
	x: ['F', 'U', 'B', 'D'],
	y: ['F', 'L', 'B', 'R'],
	z: ['U', 'R', 'D', 'L']
};

const AMOUNT: Record<string, number> = { '': 1, "'": 3, '2': 2 };
const SUFFIX: Record<number, string> = { 1: '', 2: '2', 3: "'" };

/**
 * 회전 아닌 토큰의 분해. 전부 "면 무브들 + 회전 하나" 로 쓸 수 있고, 같은 축의 회전끼리는
 * 교환법칙이 성립하므로 면 무브를 먼저 내보낸 뒤 회전을 누적해도 결과가 같다.
 *
 *   Rw = L x      Lw = R x'     Uw = D y      Dw = U y'     Fw = B z      Bw = F z'
 *   M  = R L' x'  E  = U D' y'  S  = F' B z
 *
 * 부호는 토큰의 회전량 k 에 곱해진다 (`Rw2` 는 `L2 x2`).
 */
const DECOMPOSE: Record<string, { moves: [Face, number][]; rot?: [Axis, number] }> = {
	U: { moves: [['U', 1]] },
	R: { moves: [['R', 1]] },
	F: { moves: [['F', 1]] },
	D: { moves: [['D', 1]] },
	L: { moves: [['L', 1]] },
	B: { moves: [['B', 1]] },
	Rw: { moves: [['L', 1]], rot: ['x', 1] },
	Lw: { moves: [['R', 1]], rot: ['x', -1] },
	Uw: { moves: [['D', 1]], rot: ['y', 1] },
	Dw: { moves: [['U', 1]], rot: ['y', -1] },
	Fw: { moves: [['B', 1]], rot: ['z', 1] },
	Bw: { moves: [['F', 1]], rot: ['z', -1] },
	M: { moves: [['R', 1], ['L', -1]], rot: ['x', -1] },
	E: { moves: [['U', 1], ['D', -1]], rot: ['y', -1] },
	S: { moves: [['F', -1], ['B', 1]], rot: ['z', 1] }
};

const WIDE_ALIAS: Record<string, string> = { r: 'Rw', l: 'Lw', u: 'Uw', d: 'Dw', f: 'Fw', b: 'Bw' };

/**
 * 회전 `axis` 를 k 번 한 뒤의 무브를 회전 전 방향으로 되돌리는 대응. `CYCLE` 의 **역** 이다.
 *
 * 무브 열은 왼쪽부터 적용하므로 `y R` = `B y` 다 (cubejs 로 확인). 즉 `R` 자리에 들어갈 면은
 * "y 가 R 을 보내는 면(F)" 이 아니라 "y 가 R 로 보내오는 면(B)" 이다. 방향을 뒤집어 잡으면
 * 회전이 붙는 순간 타깃이 통째로 어긋나므로 여기 한 곳에서 못을 박는다.
 */
function faceMap(axis: Axis, k: number): Record<Face, Face> {
	const cycle = CYCLE[axis];
	const map = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' } as Record<Face, Face>;
	for (let i = 0; i < 4; i++) map[cycle[i]] = cycle[(((i - k) % 4) + 4) % 4];
	return map;
}

/**
 * 방향 회전을 걷어낸다.
 *
 * 회전을 그냥 지우면 안 된다 — `y R` 에서 `y` 만 빼면 `R` 이 남지만 실제 효과는 `F` 다.
 * 뒤따르는 무브를 회전으로 켤레(conjugate)시켜 원래 방향의 무브로 바꾼다.
 * 결과 `core` 는 원본과 "전체 회전을 제외하고" 같은 상태를 만든다.
 *
 * wide 무브(`Rw`, `r`)와 슬라이스(`M E S`)는 "면 무브 + 회전" 으로 분해해 같은 규칙을 태운다.
 * 미지 토큰은 throw 한다 (`sim.ts:73` 과 같은 문구).
 */
export function splitCore(scramble: string): Scramble {
	const toks = splitMoves(scramble);
	let rho = faceMap('x', 0); // 항등
	const core: string[] = [];

	for (const t of toks) {
		const m = /^([RUFDLBMESrufdlbxyz]w?)('|2)?$/.exec(t);
		if (!m) throw new Error(`Unknown move: ${t}`);
		const k = AMOUNT[m[2] ?? ''];
		const base = WIDE_ALIAS[m[1]] ?? m[1];

		if (base === 'x' || base === 'y' || base === 'z') {
			rho = compose(rho, faceMap(base, k));
			continue;
		}
		const spec = DECOMPOSE[base];
		if (!spec) throw new Error(`Unknown move: ${t}`);
		for (const [face, sign] of spec.moves) {
			core.push(rho[face] + SUFFIX[((sign * k) % 4 + 4) % 4]);
		}
		if (spec.rot) rho = compose(rho, faceMap(spec.rot[0], spec.rot[1] * k));
	}

	return { scramble: toks.join(' '), core: core.join(' ') };
}

/** `(rho ∘ next)(f) = rho(next(f))`. 나중 회전이 안쪽으로 들어간다. */
function compose(rho: Record<Face, Face>, next: Record<Face, Face>): Record<Face, Face> {
	const out = {} as Record<Face, Face>;
	for (const f of Object.keys(rho) as Face[]) out[f] = rho[next[f]];
	return out;
}

/**
 * 풀이의 역이 곧 스크램블이다 (FR-TR-1). 자체 Kociemba 구현을 두지 않는 이유가 이 한 줄이다.
 *
 * `solve()` 의 실패(빈 문자열이 아니라 throw)는 여기서 잡지 않는다. 순수부가 에러 표현을
 * 정하면 호출부가 두 가지 실패 규약을 떠안는다 — 워커가 `{ type: 'error' }` 로 바꾼다.
 */
export function scrambleFrom(cube: CubeLike): Scramble {
	return splitCore(invertAlg(cube.solve()));
}

/* ── Worker 프로토콜 (GLOBAL §3.2) ──────────────────────────────── */

export type ToWorker = { type: 'init' } | { type: 'request'; n: number };

export type FromWorker =
	| { type: 'ready' }
	| ({ type: 'scramble' } & Scramble)
	| { type: 'error'; message: string };

/** 큐 목표 길이. FR-TR-2 의 "5~10개". 생성 실측 27ms 라 소비 직후 바로 채워진다. */
export const QUEUE_TARGET = 8;

/**
 * 큐가 쓰는 저장소. `ScrambleSource` 가 `this`(= `$state` 필드)를 그대로 넘긴다.
 * 배열은 **재할당** 한다 — `push` 는 `$state` 를 깨우지 않는다.
 */
export interface ScrambleSink {
	ready: boolean;
	queue: Scramble[];
	error: string | null;
}

/** 우리가 Worker 에서 쓰는 전부. 가짜 객체를 넣어 node 에서 테스트한다. */
export interface WorkerLike {
	postMessage(message: unknown): void;
	terminate(): void;
	onmessage: ((event: { data: unknown }) => void) | null;
}

/**
 * 워커 수명과 스크램블 큐. **룬(rune)을 쓰지 않는다.**
 *
 * `$state` 를 직접 들면 이 클래스가 `.svelte.ts` 로 가야 하고, 그러면 vitest(플러그인 없는
 * node 환경)에서 컴파일되지 않아 T1B-4 를 전부 E2E 로 미뤄야 한다. 그래서 상태의 저장소는
 * 밖(`ScrambleSink`)에 두고 결정 로직만 여기 둔다. `ScrambleSource` 는 이 클래스에 자기
 * `$state` 필드를 빌려주는 얇은 껍데기다.
 */
export class ScrambleQueue {
	#worker: WorkerLike | null = null;
	/** 요청했지만 아직 도착하지 않은 개수. 이걸 안 세면 보충 요청이 매번 중복 발신된다. */
	#pending = 0;
	readonly #sink: ScrambleSink;
	readonly #spawn: () => WorkerLike;
	readonly #target: number;

	constructor(sink: ScrambleSink, spawn: () => WorkerLike, target: number = QUEUE_TARGET) {
		this.#sink = sink;
		this.#spawn = spawn;
		this.#target = target;
	}

	/** 테스트·검사용. 살아 있는 워커가 없으면 `null`. */
	get worker(): WorkerLike | null {
		return this.#worker;
	}

	start(): void {
		if (this.#worker) return;
		const w = this.#spawn();
		w.onmessage = (e) => this.#receive(e.data);
		this.#worker = w;
		w.postMessage({ type: 'init' } satisfies ToWorker);
	}

	/**
	 * 큐에서 하나 꺼내고 부족분을 채운다. 준비 전이거나 큐가 비면 `null` —
	 * throw 하지 않는다. 화면은 `null` 을 "준비 중" 으로 표시한다 (FR-TR-2).
	 */
	take(): Scramble | null {
		if (!this.#sink.ready || this.#sink.queue.length === 0) return null;
		const [head, ...rest] = this.#sink.queue;
		this.#sink.queue = rest;
		this.#refill();
		return head;
	}

	/** 화면 이탈 시 메인이 부른다. 100MB 가 여기서 반납된다 (NFR-TR-1). */
	dispose(): void {
		this.#worker?.terminate();
		this.#worker = null;
		this.#pending = 0;
		this.#sink.ready = false;
		this.#sink.queue = [];
		this.#sink.error = null;
	}

	#receive(data: unknown): void {
		const msg = data as FromWorker;
		if (msg.type === 'ready') {
			this.#sink.ready = true;
			this.#refill();
		} else if (msg.type === 'scramble') {
			this.#pending = Math.max(0, this.#pending - 1);
			this.#sink.queue = [...this.#sink.queue, { scramble: msg.scramble, core: msg.core }];
		} else if (msg.type === 'error') {
			// 큐는 그대로 둔다. 화면은 다음 스크램블로 넘어갈 수 있어야 한다.
			this.#pending = Math.max(0, this.#pending - 1);
			this.#sink.error = msg.message;
		}
	}

	#refill(): void {
		if (!this.#worker || !this.#sink.ready) return;
		const n = this.#target - this.#sink.queue.length - this.#pending;
		if (n <= 0) return;
		this.#pending += n;
		this.#worker.postMessage({ type: 'request', n } satisfies ToWorker);
	}
}
