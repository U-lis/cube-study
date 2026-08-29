/**
 * 트레이싱 엔진 — 스크램블 상태에서 타깃 열을 뽑고, 사용자의 메모를 채점한다.
 *
 * ─── 이 파일이 모르는 것 ─────────────────────────────────────
 * 버퍼가 무엇인지 모른다. 조각 종류도 모른다. 케이스 데이터도, 화면도 모른다.
 * 전부 `TraceOptions` 로 들어온다 (FR-TR-7). 기본값조차 두지 않는다 —
 * `sim.ts` 의 `identifyCase` 는 기본값에 버퍼가 박혀 있는데, 그 방식을 따라가면
 * "데이터만 갈아끼워 다른 버퍼를 지원한다" 가 조용히 깨진다.
 *
 * 큐브의 물리도 모른다. 무브를 적용하지 않기 때문이다 — 여기 있는 것은
 * 스티커 치환 규칙 하나(`applyTarget`)뿐이고, 상태를 만드는 일은 cubejs 를 쓰는
 * `sim.ts` 가 한다.
 * ────────────────────────────────────────────────────────────
 *
 * ─── 핵심 규약 ──────────────────────────────────────────────
 * 상태 σ = `CubeState` = { 위치: 그 자리에 온 스티커의 원래 자리 }.
 * 따라서 σ(x) 는 "x 자리에 있는 조각이 가야 할 곳" 이고, 트레이싱은 그저
 * σ 를 따라 걷는 일이다.
 *
 * 사이클의 **정지 조건은 스티커가 아니라 큐비다** (AD-4). 이 한 줄이
 * 끊고 들어간 사이클의 회수 타깃(FR-TR-5)과 제자리 비틀림(FR-TR-6)을 동시에
 * 처리한다. 비틀림 전용 분기는 이 파일에 없다.
 * ────────────────────────────────────────────────────────────
 */

import type { Cubie, Sticker } from '../domain/types.js';
import type { CubeState } from './sim.js';
import { cubieOf, lettersOf, primaryAxisSticker, rotationOf, type PieceKind } from './speffz.js';

/**
 * 비틀림 처리 관례 (FR-TR-24).
 *
 * 이 파일에서 따옴표에 묶인 문자는 이 줄이 유일하다. 관례 이름이지 스티커가
 * 아니다 — 버퍼·조각 상수 금지(FR-TR-7)와 무관하다.
 */
export type TwistConvention = 'A' | 'B';

export interface TraceOptions {
	pieceKind: PieceKind;
	/** 버퍼 큐비의 스티커 전부. 호출부가 데이터셋 meta 에서 읽어 넘긴다. */
	bufferStickers: Sticker[];
	/** 버퍼에서 조각을 읽는 기준 자리. 타깃 하나는 이 자리의 조각을 옮긴다. */
	primarySticker: Sticker;
	/** 기본은 관례 A — 비틀림을 타깃 열에 흡수한다. */
	twistConvention?: TwistConvention;
	/** 끊기 지점 선택. 기본은 후보 첫 번째(Speffz 문자 순). 난수는 밖에서 준다 (AD-6). */
	pickBreakIn?: (candidates: Sticker[]) => Sticker;
}

export interface TraceResult {
	targets: Sticker[];
	/** 관례 A 에서는 항상 빈 배열. */
	twists: Sticker[];
	/** 끊고 들어간 횟수. */
	breakIns: number;
	parity: boolean;
}

export interface MemoInput {
	targets: Sticker[];
	/** 관례 A 에서는 무시한다. */
	twists: Sticker[];
	/**
	 * 개수 판정에서 눈감아 줄 타깃 수 (기본 0).
	 *
	 * 한 줄 입력에서 관례를 섞어 칠 수 있기 때문에 생긴 값이다 — 비틀림 하나는
	 * 끊어서 타깃 열에 넣고 다른 하나는 따로 선언하면, 채점은 관례 B 로 하지만
	 * 타깃 열에는 흡수한 몫이 2개 더 들어 있다. 그 2개를 "불필요한 끊기" 라고
	 * 부르면 사실이 아니다 — 사용자는 그 조각을 실제로 끊어서 처리했다.
	 * `readEntry` 가 세어서 넘긴다.
	 */
	extraAllowance?: number;
}

export type WrongReason =
	| 'wrong-piece' // 다른 큐비를 지목했다
	| 'wrong-orientation' // 큐비는 맞고 스티커(방향)가 틀렸다
	| 'already-solved' // 이미 처리한 큐비로 끊었다
	| 'buffer-sticker'; // 버퍼 스티커를 타깃으로 썼다

export type TraceVerdict =
	| { kind: 'correct' }
	| { kind: 'correct-extra'; extra: number }
	| { kind: 'wrong-at'; index: number; reason: WrongReason; expected: Sticker | null }
	| { kind: 'incomplete'; remaining: Cubie[] }
	| { kind: 'twist-mismatch'; missing: Sticker[]; unexpected: Sticker[] }
	| { kind: 'invalid-letter'; index: number; letter: string };

/** 옵션에서 파생되는 것들. 매 호출마다 만든다 — 캐시할 만큼 무겁지 않다. */
interface Context {
	kind: PieceKind;
	/** 큐비 → 회전 순서대로 나열한 스티커. 방향 계산의 기준이다. */
	rotation: Record<Cubie, Sticker[]>;
	cubie: Record<Sticker, Cubie>;
	letters: Sticker[];
	buffer: Set<Sticker>;
	bufferCubie: Cubie;
	primary: Sticker;
	/** 관례 B 인가 — 비틀림을 타깃 열에서 빼고 따로 보고한다. */
	separateTwists: boolean;
}

function context(opts: TraceOptions): Context {
	const cubie = cubieOf(opts.pieceKind);
	return {
		kind: opts.pieceKind,
		rotation: rotationOf(opts.pieceKind),
		cubie,
		letters: lettersOf(opts.pieceKind),
		buffer: new Set(opts.bufferStickers),
		bufferCubie: cubie[opts.primarySticker],
		primary: opts.primarySticker,
		// 기본은 관례 A. 비교를 B 쪽으로만 쓰는 이유는 이 파일에 스티커로 읽힐
		// 수 있는 따옴표 문자를 남기지 않기 위해서다 (FR-TR-7 의 정적 검사).
		separateTwists: opts.twistConvention === 'B'
	};
}

/** 그 큐비의 스티커가 전부 제자리인가. */
const isCubieSolved = (state: CubeState, c: Context, cubie: Cubie): boolean =>
	c.rotation[cubie].every((s) => state[s] === s);

/**
 * 큐비는 제자리인데 스티커 순열이 항등이 아닌가 (제자리 비틀림·뒤집힘).
 *
 * 관례 B 의 끊기 후보 필터와 잔여 비틀림 산출, 두 곳에서만 쓴다. 생성 루프
 * 안에서는 부르지 않는다 — 부르는 순간 그것이 AD-4 가 금지한 비틀림 특례다.
 */
const isTwistedInPlace = (state: CubeState, c: Context, cubie: Cubie): boolean =>
	c.rotation[cubie].every((s) => c.cubie[state[s]] === cubie) &&
	c.rotation[cubie].some((s) => state[s] !== s);

/** 아직 안 풀린 큐비 (Speffz 문자 순). */
function unsolvedCubies(state: CubeState, c: Context): Cubie[] {
	const seen = new Set<Cubie>();
	const out: Cubie[] = [];
	for (const s of c.letters) {
		const cubie = c.cubie[s];
		if (seen.has(cubie)) continue;
		seen.add(cubie);
		if (!isCubieSolved(state, c, cubie)) out.push(cubie);
	}
	return out;
}

/**
 * 끊기 후보 — 미해결·미방문이며 버퍼가 아닌 큐비의 스티커 전부.
 *
 * 관례 B 만 여기서 갈린다: 제자리 비틀림 큐비를 후보에서 뺀다 (AD-5).
 * 그 외에는 관례를 모르는 코드다.
 */
function breakInCandidates(state: CubeState, c: Context, visited: Set<Cubie>): Sticker[] {
	return c.letters.filter((s) => {
		const cubie = c.cubie[s];
		if (cubie === c.bufferCubie || visited.has(cubie)) return false;
		if (isCubieSolved(state, c, cubie)) return false;
		return c.separateTwists ? !isTwistedInPlace(state, c, cubie) : true;
	});
}

/**
 * 타깃 하나를 실행한다 — 버퍼에 있는 조각과 t 자리의 조각을 맞바꾸되,
 * 버퍼 조각의 primary 스티커가 t 자리에 오도록 방향을 맞춘다.
 *
 * 무브가 아니다. 우리는 알고리즘을 모르는 채로 효과만 정의한다. 그래서
 * 회전 순서(`rotationOf`)가 여기서 유일하게 중요하다 — 두 큐비의 스티커를
 * 같은 회전 방향으로 짝지어야 방향이 보존된다. 한 큐비만 순서가 반대여도
 * 라운드트립이 통째로 깨진다 (speffz.ts 의 CORNER_ROTATION 주석 참조).
 */
export function applyTarget(state: CubeState, t: Sticker, opts: TraceOptions): CubeState {
	const c = context(opts);
	const from = c.rotation[c.bufferCubie];
	const to = c.rotation[c.cubie[t]];
	const k = from.length;
	const fi = from.indexOf(c.primary);
	const ti = to.indexOf(t);
	const next = { ...state };
	for (let d = 0; d < k; d++) {
		const a = from[(fi + d) % k];
		const b = to[(ti + d) % k];
		next[b] = state[a];
		next[a] = state[b];
	}
	return next;
}

/** 타깃 열을 순서대로 실행한다. */
export const applyTargets = (state: CubeState, targets: Sticker[], opts: TraceOptions): CubeState =>
	targets.reduce((st, t) => applyTarget(st, t, opts), state);

/**
 * 제자리 비틀림을 문자 하나로 적는다 (FR-TR-25, AD-8).
 *
 * 코너: U/D 축 색 스티커가 **지금 앉아 있는 자리** 의 문자. 제자리 비틀림
 * 상태는 둘뿐이라 이 문자 하나가 방향까지 특정한다. 방향 마커를 안 쓴다.
 * 엣지: 뒤집힘 상태가 하나뿐이라 큐비를 지목하면 끝이다. Speffz 순서상 앞
 * 문자로 정규화한다.
 */
export function twistLetter(state: CubeState, cubie: Cubie, opts: TraceOptions): Sticker {
	const c = context(opts);
	if (c.kind !== 'corner') return canonicalCubieLetter(c, cubie);
	const axis = primaryAxisSticker(c.kind, cubie);
	const seat = c.rotation[cubie].find((s) => state[s] === axis);
	if (!seat) throw new Error(`${cubie}: 축 스티커가 이 큐비에 없다 — 제자리가 아니다`);
	return seat;
}

/** 큐비를 대표하는 문자 (Speffz 순서상 앞 문자). */
const canonicalCubieLetter = (c: Context, cubie: Cubie): Sticker =>
	c.letters.find((s) => c.cubie[s] === cubie)!;

/**
 * 사용자가 적은 비틀림 문자를 비교용으로 정규화한다.
 *
 * 엣지는 같은 큐비의 두 문자가 같은 뜻이므로 하나로 모은다. 코너는 문자가
 * 방향까지 담으므로 그대로 둔다 — 다른 문자는 다른 방향이다.
 */
export function normalizeTwistLetter(letter: Sticker, opts: TraceOptions): Sticker {
	const c = context(opts);
	return c.kind === 'corner' ? letter : canonicalCubieLetter(c, c.cubie[letter]);
}

/**
 * 스크램블 상태에서 타깃 열을 뽑는다 (FR-TR-4).
 *
 * 1. 버퍼 자리의 조각을 따라 걷는다. 버퍼로 돌아오면 손이 빈다 — 뱉지 않는다.
 * 2. 남은 미해결 큐비가 있으면 그 스티커 하나로 끊고 들어가, 뱉은 타깃이
 *    끊은 자리와 **같은 큐비** 가 될 때까지 걷는다. 그 마지막 타깃이 버퍼에
 *    파킹해둔 조각의 회수다 (FR-TR-5).
 * 3. 후보가 없을 때까지 2 를 되풀이한다.
 *
 * 제자리 비틀린 조각은 σ 가 같은 큐비 안에서 도는 경우일 뿐이라 2 의 규칙이
 * 그대로 타깃 2개를 낸다 (FR-TR-6). 따로 볼 것이 없다.
 */
export function trace(state: CubeState, opts: TraceOptions): TraceResult {
	const c = context(opts);
	const pick = opts.pickBreakIn ?? ((cands: Sticker[]) => cands[0]);
	const targets: Sticker[] = [];
	const visited = new Set<Cubie>();
	let breakIns = 0;

	let t = state[c.primary];
	while (!c.buffer.has(t)) {
		targets.push(t);
		visited.add(c.cubie[t]);
		t = state[t];
	}

	for (;;) {
		const candidates = breakInCandidates(state, c, visited);
		if (candidates.length === 0) break;
		const b = pick(candidates);
		if (!candidates.includes(b)) throw new Error(`끊기 후보가 아닌 문자: ${b}`);
		breakIns++;
		targets.push(b);
		visited.add(c.cubie[b]);
		let x = state[b];
		for (;;) {
			targets.push(x);
			visited.add(c.cubie[x]);
			if (c.cubie[x] === c.cubie[b]) break;
			x = state[x];
		}
	}

	return {
		targets,
		twists: residualTwists(applyTargets(state, targets, opts), c, opts),
		breakIns,
		parity: targets.length % 2 === 1
	};
}

/**
 * 타깃 열을 실행하고 **남은** 상태에서 비틀림을 뽑는다 (AD-5).
 *
 * 초기 상태에서 뽑으면 안 된다 — 방향 합이 보존되므로 다른 비틀림을 남기면
 * 버퍼가 보정을 떠안는다. 관례 B 에서 버퍼가 비틀린 채 남는 비율이 코너 80.9%,
 * 엣지 77% 다. 초기 상태에는 그게 안 보인다.
 */
function residualTwists(residual: CubeState, c: Context, opts: TraceOptions): Sticker[] {
	if (!c.separateTwists) return [];
	return unsolvedCubies(residual, c)
		.filter((cubie) => isTwistedInPlace(residual, c, cubie))
		.map((cubie) => twistLetter(residual, cubie, opts));
}

/**
 * 사용자의 메모를 실행 모델로 채점한다 (FR-TR-10, 11, 12).
 *
 * 문자열 비교가 아니다. 끊기 지점 선택이 자유라 한 스크램블에 유효한 메모가
 * 평균 11가지(최대 21) 있다. 비교는 개수 판정 한 곳에만 쓴다.
 *
 * 단계마다 보는 것은 하나다 — **지금 버퍼에 든 조각이 갈 곳이 정해져 있는가.**
 *  - 정해져 있다: 그 조각의 목적지 스티커 하나뿐이다. 방향까지 본다.
 *  - 손이 비었다(사이클 닫힘): 아직 안 건드린 큐비의 아무 스티커나 된다.
 *
 * 이미 건드린 큐비로 끊는 것만 막는다. 안 건드렸지만 이미 풀려 있는 큐비로
 * 끊는 것은 막지 않는다 — 실행해보면 같은 문자 두 번으로 제자리에 돌아오고
 * 큐브는 그대로 풀린다. 그것이 FR-TR-12 가 말하는 불필요한 끊기(타깃 2개
 * 증가)이며 오답이 아니라 `correct-extra` 다.
 */
export function gradeMemo(state: CubeState, input: MemoInput, opts: TraceOptions): TraceVerdict {
	const c = context(opts);

	for (let i = 0; i < input.targets.length; i++)
		if (!(input.targets[i] in c.cubie))
			return { kind: 'invalid-letter', index: i, letter: input.targets[i] };

	// 관례 B 의 비틀림 칸은 타깃 열 뒤에 이어 센다. 입력 구획이 둘이라
	// 인덱스가 겹치면 화면이 어느 칸을 짚어야 할지 알 수 없다.
	if (c.separateTwists)
		for (let j = 0; j < input.twists.length; j++)
			if (!(input.twists[j] in c.cubie))
				return {
					kind: 'invalid-letter',
					index: input.targets.length + j,
					letter: input.twists[j]
				};

	let cur = state;
	const visited = new Set<Cubie>();
	for (let i = 0; i < input.targets.length; i++) {
		const t = input.targets[i];
		if (c.buffer.has(t))
			return { kind: 'wrong-at', index: i, reason: 'buffer-sticker', expected: null };

		// 버퍼 자리에 온 조각이 가야 할 곳. 버퍼 큐비면 손이 빈 것이다.
		const held = cur[c.primary];
		if (c.cubie[held] !== c.bufferCubie) {
			if (t !== held)
				return {
					kind: 'wrong-at',
					index: i,
					reason: c.cubie[t] === c.cubie[held] ? 'wrong-orientation' : 'wrong-piece',
					expected: held
				};
		} else if (visited.has(c.cubie[t])) {
			return { kind: 'wrong-at', index: i, reason: 'already-solved', expected: null };
		}

		visited.add(c.cubie[t]);
		cur = applyTarget(cur, t, opts);
	}

	const remaining = unsolvedCubies(cur, c);
	if (c.separateTwists) {
		if (remaining.some((cubie) => !isTwistedInPlace(cur, c, cubie)))
			return { kind: 'incomplete', remaining };
		const residual = remaining.map((cubie) => twistLetter(cur, cubie, opts));
		const verdict = compareTwists(residual, input.twists, opts);
		if (verdict) return verdict;
	} else if (remaining.length > 0) {
		return { kind: 'incomplete', remaining };
	}

	// 여기서만 엔진 산출과 개수를 비교한다. 끊기 지점을 어떻게 골라도 타깃 수는
	// 스크램블이 정한 값 그대로라(400/400) "적음" 은 정답일 수 없다.
	const extra =
		input.targets.length - trace(state, opts).targets.length - (input.extraAllowance ?? 0);
	return extra > 0 ? { kind: 'correct-extra', extra } : { kind: 'correct' };
}

/** 잔여 비틀림과 사용자 선언을 집합으로 비교한다 (순서는 안 본다, FR-TR-18). */
function compareTwists(
	residual: Sticker[],
	declared: Sticker[],
	opts: TraceOptions
): TraceVerdict | null {
	const want = new Set(residual.map((s) => normalizeTwistLetter(s, opts)));
	const got = new Set(declared.map((s) => normalizeTwistLetter(s, opts)));
	const missing = [...want].filter((s) => !got.has(s));
	const unexpected = [...got].filter((s) => !want.has(s));
	if (missing.length === 0 && unexpected.length === 0) return null;
	return { kind: 'twist-mismatch', missing, unexpected };
}

/* ═══════════════════════════════════════════════════════════
 * 한 줄 입력의 판독 (FR-TR-18, 24)
 * ═══════════════════════════════════════════════════════════ */

/** 항목 하나를 무엇으로 읽었는가. */
export type EntryRole = 'target' | 'twist';

export interface EntryReading {
	/** 타깃으로 읽은 문자들. 순서가 그대로 살아 있다. */
	targets: Sticker[];
	/** 비틀림 선언으로 읽은 문자들. 순서는 뜻이 없다. */
	twists: Sticker[];
	/** 입력 순서 그대로의 판독. 화면이 "몇 번째 칸을 무엇으로 읽었는가" 를 안다. */
	roles: EntryRole[];
	/** 타깃 열의 i 번째가 입력의 몇 번째 칸이었나. 판정 인덱스를 되돌리는 표다. */
	targetAt: number[];
	/** 비틀림 열의 j 번째가 입력의 몇 번째 칸이었나. */
	twistAt: number[];
	/**
	 * 사용자가 비틀림을 **따로 적었는가**. 세션 설정이 아니라 판독 결과다.
	 *
	 * 관례 이름(`TwistConvention`)이 아니라 불리언으로 낸다. 이 파일에 관례 이름
	 * 문자열을 하나 더 적으면 버퍼 리터럴 정적 검사(FR-TR-7)에 걸린다 — 관례
	 * 이름이지 스티커가 아니지만, 검사를 사람의 판단으로 무르지 않는 편이 낫다.
	 * 이름으로 옮기는 일은 `domain/tracing.ts` 의 `conventionOf` 가 한다.
	 *
	 * 비틀림 선언이 하나라도 있으면 따로 처리한 것이고, 없으면 끊어서 처리한
	 * 것이다. 비틀림이 아예 없는 스크램블은 두 관례의 입력이 **글자까지 같아서**
	 * 구분할 근거가 없다 — 그때는 끊어서 처리 쪽으로 읽는다.
	 */
	separated: boolean;
	/** 끊어서 흡수한 비틀림 쌍의 수. `MemoInput.extraAllowance` 의 출처다. */
	absorbed: number;
}

/**
 * 한 줄로 친 입력을 타깃 열과 비틀림 선언으로 가른다 (FR-TR-18).
 *
 * ─── 왜 화면이 아니라 여기인가 ──────────────────────────────
 * 이것은 표시가 아니라 **판정** 이다. 화면에서 가르면 규칙이 E2E 로만 검증되고,
 * 규칙이 틀리면 사용자는 맞게 친 답을 오답으로 돌려받는다. 그래서 순수 함수다.
 * ────────────────────────────────────────────────────────────
 *
 * ─── 규칙 (무작위 3000상태 실측) ────────────────────────────
 * 제자리 비틀린 큐비는 σ 가 그 큐비 안에서만 도는 경우라, 다른 조각이 그리로
 * 흘러들지 않는다. 그래서 그 큐비에 닿는 길은 **끊고 들어가는 것 하나뿐** 이고,
 * 끊고 들어간 다음 타깃은 곧바로 같은 큐비다. 따라서:
 *
 * 1. 같은 큐비의 문자가 **연속 두 번** → 끊어서 처리한 자리다. 둘 다 타깃이다.
 *    (제자리 비틀림 3460칸 / 예외 0. 이미 풀린 조각으로 끊은 경우도 여기 걸리는데,
 *     그쪽은 타깃이 맞고 `correct-extra` 로 판정된다.)
 * 2. **단독** 으로 선 문자가 제자리 비틀린 큐비를 가리키면 → 비틀림 선언이다.
 *    (관례 A 의 타깃 열에 그런 단독 항목이 나타난 경우 0.)
 * 3. 그 외는 전부 타깃이다.
 *
 * 버퍼는 처음 상태로 판단할 수 없다. 관례 B 의 버퍼 비틀림은 **타깃을 다 실행한
 * 뒤** 에 남는 것이고(`residualTwists` 와 같은 이유), 처음부터 비틀려 있던 버퍼가
 * 타깃에 흡수돼 풀리는 경우가 248건 중 150건이다. 그래서 버퍼 문자는 일단 미뤄두고,
 * 나머지를 실행해 본 뒤 **그 잔여 상태에서** 버퍼가 비틀려 있을 때만 선언으로 읽는다.
 * 아니면 타깃 열에 그대로 남아 `buffer-sticker` 오답이 된다.
 */
export function readEntry(
	state: CubeState,
	entry: readonly Sticker[],
	opts: TraceOptions
): EntryReading {
	const c = context(opts);
	const cubieAt = (i: number): Cubie | null =>
		i >= 0 && i < entry.length && entry[i] in c.cubie ? c.cubie[entry[i]] : null;

	// 1. 연속한 같은 큐비를 짝으로 묶는다. 묶인 칸은 후보에서 빠진다.
	const paired = entry.map(() => false);
	for (let i = 0; i + 1 < entry.length; i++) {
		const a = cubieAt(i);
		if (a === null || a !== cubieAt(i + 1)) continue;
		paired[i] = paired[i + 1] = true;
		i++; // 세 개가 이어져도 앞의 둘만 한 짝이다.
	}

	// 2. 단독으로 선 비틀림 후보. 버퍼는 잔여 상태로 판단하므로 함께 미뤄둔다.
	const pending = new Set<number>();
	for (let i = 0; i < entry.length; i++) {
		if (paired[i]) continue;
		const cubie = cubieAt(i);
		if (cubie === null) continue;
		if (cubie === c.bufferCubie || isTwistedInPlace(state, c, cubie)) pending.add(i);
	}

	// 3. 후보를 뺀 나머지를 실행해 잔여 상태를 얻는다. 모르는 문자는 여기서도
	//    빼둔다 — `applyTarget` 은 24글자 밖의 문자를 다룰 수 없고, 그 판정은
	//    `gradeMemo` 의 `invalid-letter` 가 따로 한다.
	const provisional = entry.filter((s, i) => !pending.has(i) && s in c.cubie);
	const residual = applyTargets(state, provisional, opts);

	const roles: EntryRole[] = entry.map((_, i) =>
		pending.has(i) && isTwistedInPlace(residual, c, c.cubie[entry[i]]) ? 'twist' : 'target'
	);

	const targets: Sticker[] = [];
	const twists: Sticker[] = [];
	const targetAt: number[] = [];
	const twistAt: number[] = [];
	for (let i = 0; i < entry.length; i++) {
		if (roles[i] === 'twist') {
			twists.push(entry[i]);
			twistAt.push(i);
		} else {
			targets.push(entry[i]);
			targetAt.push(i);
		}
	}

	// 흡수한 비틀림 쌍만 센다. 이미 풀린 조각으로 끊은 짝은 진짜 불필요한 끊기다.
	let absorbed = 0;
	for (let i = 0; i + 1 < entry.length; i++) {
		const a = cubieAt(i);
		if (a === null || a !== cubieAt(i + 1)) continue;
		if (isTwistedInPlace(state, c, a)) absorbed++;
		i++;
	}

	return {
		targets,
		twists,
		roles,
		targetAt,
		twistAt,
		separated: twists.length > 0,
		absorbed
	};
}

/**
 * 한 줄 입력을 판독해 채점한다 (FR-TR-10~12, 18).
 *
 * 채점 관례는 **세션 설정이 아니라 판독 결과** 를 쓴다. 어느 쪽으로 쳐도 정답은
 * 정답이라는 것이 이 화면의 약속이고, 설정은 정답 예시를 어느 관례로 보여줄지만
 * 정한다.
 *
 * 판정의 인덱스는 **입력 칸 번호로 되돌린다.** 엔진은 타깃 열 기준으로 세는데
 * 사용자가 보는 것은 한 줄이라, 되돌리지 않으면 "3번째 타깃" 이 화면의 3번째
 * 글자가 아니게 된다.
 */
export function gradeEntry(
	state: CubeState,
	entry: readonly Sticker[],
	opts: TraceOptions
): { reading: EntryReading; verdict: TraceVerdict } {
	const reading = readEntry(state, entry, opts);
	const verdict = gradeMemo(
		state,
		{
			targets: reading.targets,
			twists: reading.twists,
			extraAllowance: reading.separated ? 2 * reading.absorbed : 0
		},
		// 관례 이름을 적지 않는다 — 끊어서 처리는 엔진의 기본값이라 지우면 된다.
		{ ...opts, twistConvention: reading.separated ? 'B' : undefined }
	);
	return { reading, verdict: remapIndex(verdict, reading) };
}

/** 타깃/비틀림 열의 인덱스를 입력 칸 번호로 되돌린다. */
function remapIndex(v: TraceVerdict, r: EntryReading): TraceVerdict {
	if (v.kind === 'wrong-at') return { ...v, index: r.targetAt[v.index] ?? v.index };
	if (v.kind === 'invalid-letter') {
		const at =
			v.index < r.targets.length
				? r.targetAt[v.index]
				: r.twistAt[v.index - r.targets.length];
		return { ...v, index: at ?? v.index };
	}
	return v;
}
