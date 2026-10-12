/**
 * 스티커 문자 훈련 (#19) — 순수부.
 *
 * 외우기(`/3x3/bld/letters/lookup`)와 퀴즈(`/3x3/bld/letters/quiz`)가 쓰는 계산을 모은다.
 * 채점·출제 pool·54칸 칠 배열·54칸 글자 배열·설정 값 판정이다 (GLOBAL AD-LT-1).
 *
 * Svelte·`three`·`cubejs` 를 import 하지 않는다. 무작위 상태의 facelet 문자열과 회색 값은
 * **인자로 받는다** — `quiz.ts` 가 난수를 인자로 받는 것과 같은 이유다. 회색을
 * `$lib/ui/facelets.ts` 에서 끌어오면 domain → ui 로 의존이 거꾸로 선다.
 *
 * 문자 ↔ 자리 표를 새로 만들지 않는다. 전부 `speffz.ts` 를 본다.
 *
 * ─── 엣지 문자는 소문자다 (AD-LT-2) ─────────────────────────
 * `EDGE_INDEX` 의 키가 `a`–`x` 다. 같은 알파벳 A–X 를 코너와 엣지가 같이 쓰므로
 * 대소문자가 종류를 가르는 표시도 된다. 채점은 입력을 종류에 맞춰 정규화한다.
 * ────────────────────────────────────────────────────────────
 */
import type { Cubie, Sticker } from './types.js';
import type { Mark } from '../cube/cube3d-map.js';
import { stateFromFacelets } from '../cube/sim.js';
import {
	CORNER_AT,
	CORNER_FACELETS,
	CORNER_INDEX,
	EDGE_AT,
	EDGE_FACELETS,
	EDGE_INDEX,
	rotationOf,
	type PieceKind
} from '../cube/speffz.js';

/** 다른 조각(외우기) / 다른 큐비(퀴즈)를 회색으로 가릴지, 실제 색으로 보일지. */
export type Others = 'gray' | 'color';
/** 퀴즈 단계. 1단계는 풀린 큐브, 2단계는 무작위 상태 (SPEC FR-LT-13). */
export type QuizStage = 'solved' | 'scrambled';

/*
 * 저장된 설정 판정. 유효값 목록을 화면 쪽에 또 적지 않는다 — 두 곳에 있으면
 * 값을 늘릴 때 한쪽만 고치고, 그 사고는 "설정이 조용히 기본값으로 돌아간다" 로 나타난다
 * (`tracing.svelte.ts:46-50` 과 같은 이유).
 */
export const isLetterKind = (v: unknown): v is PieceKind => v === 'corner' || v === 'edge';
export const isOthers = (v: unknown): v is Others => v === 'gray' || v === 'color';
export const isQuizStage = (v: unknown): v is QuizStage => v === 'solved' || v === 'scrambled';

const facelets = (kind: PieceKind): Record<Cubie, number[]> =>
	kind === 'corner' ? CORNER_FACELETS : EDGE_FACELETS;

/** 출제 pool. 버퍼 큐비도 들어 있다 — 버퍼 스티커에도 문자가 있다 (FR-LT-19). */
export const cubiesOf = (kind: PieceKind): Cubie[] => Object.keys(facelets(kind));

/** 그 큐비의 문자들 = 정답. 순서는 `rotationOf` 의 것이지만 채점은 순서를 보지 않는다. */
export const answerOf = (kind: PieceKind, cubie: Cubie): Sticker[] => rotationOf(kind)[cubie];

const normalize = (kind: PieceKind, ch: string): Sticker =>
	kind === 'edge' ? ch.toLowerCase() : ch.toUpperCase();

const sortedKey = (letters: readonly string[]): string => [...letters].sort().join('');

export type LetterVerdict = { kind: 'correct' } | { kind: 'wrong'; answer: Sticker[] };

/**
 * 채점 (FR-LT-15). **순서는 상관없다** — `aq` 와 `qa` 는 둘 다 정답이다.
 *
 * 둘을 정렬해 비교한다. `Set` 으로 비교하지 않는다 — 중복을 접어 버려서 `aaq` 같은
 * 답이 길이 검사 하나에 기대게 된다. 정렬 비교는 겹쳐 낸 답과 개수가 틀린 답을
 * 저절로 떨어뜨린다.
 */
export function gradeLetters(
	kind: PieceKind,
	cubie: Cubie,
	entered: readonly string[]
): LetterVerdict {
	const answer = answerOf(kind, cubie);
	const given = entered.map((ch) => normalize(kind, ch));
	return sortedKey(given) === sortedKey(answer)
		? { kind: 'correct' }
		: { kind: 'wrong', answer: [...answer] };
}

/** 면 중앙 칸. 중앙은 움직이지 않으므로 언제나 실제 색이다 (FR-LT-7a, 12). */
const isCenter = (i: number): boolean => i % 9 === 4;

/**
 * 외우기 — 54칸 글자 (FR-LT-7). 고른 종류의 24칸에만 그 칸의 문자가 찍힌다.
 * 풀린 큐브라 칸의 문자가 곧 그 스티커의 문자다.
 */
export function labelsLookup(kind: PieceKind): (Sticker | null)[] {
	const at = kind === 'corner' ? CORNER_AT : EDGE_AT;
	return Array.from({ length: 54 }, (_, i) => at[i] ?? null);
}

/**
 * 외우기 — 54칸 색 (FR-LT-7a).
 *
 * `colors` 는 화면이 `faceletColors` 로 만든 실제 색이다. 센터와 고른 종류의 칸은
 * 언제나 실제 색이고, 다른 종류의 칸만 `others` 를 따른다.
 */
export function paintLookup(
	kind: PieceKind,
	others: Others,
	colors: readonly string[],
	gray: string
): string[] {
	if (others === 'color') return [...colors];
	const index = kind === 'corner' ? CORNER_INDEX : EDGE_INDEX;
	const keep = new Set(Object.values(index));
	return colors.map((c, i) => (isCenter(i) || keep.has(i) ? c : gray));
}

/**
 * 문제 큐비의 스티커가 **지금** 앉은 칸들 (AD-LT-5).
 *
 * `stateFromFacelets` 는 자리 문자 → 그 자리에 온 원래 문자다. 원래 문자가 문제 큐비의
 * 것인 자리들을 모으면 된다. 풀린 상태면 큐비의 원래 칸과 같다 — 1단계와 2단계가
 * 같은 경로를 탄다.
 */
export function cubieAt(kind: PieceKind, faceletString: string, cubie: Cubie): number[] {
	const state = stateFromFacelets(faceletString, kind);
	const index = kind === 'corner' ? CORNER_INDEX : EDGE_INDEX;
	const mine = new Set(answerOf(kind, cubie));
	return Object.entries(state)
		.filter(([, origin]) => mine.has(origin))
		.map(([position]) => index[position]);
}

/**
 * 퀴즈 — 54칸 색 (FR-LT-12, 12a). 센터와 문제 큐비는 실제 색, 나머지는 `others` 를 따른다.
 *
 * 외우기와 달리 "나머지" 에는 **같은 종류의 다른 큐비** 도 들어간다.
 */
export function paintQuiz(
	kind: PieceKind,
	cubie: Cubie,
	others: Others,
	faceletString: string,
	colors: readonly string[],
	gray: string
): string[] {
	if (others === 'color') return [...colors];
	const keep = new Set(cubieAt(kind, faceletString, cubie));
	return colors.map((c, i) => (isCenter(i) || keep.has(i) ? c : gray));
}

/**
 * 퀴즈 — 문제 큐비를 가리키는 외곽선 (FR-LT-12a, AD-LT-7).
 *
 * "다른 큐비: 회색" 에서도 두른다. 설정에 따라 표시 방식이 갈리지 않게 규칙을
 * 하나로 둔다 — 회색 바탕에서는 해가 없다.
 */
export function marksQuiz(
	kind: PieceKind,
	cubie: Cubie,
	faceletString: string,
	mark: Mark
): (Mark | null)[] {
	const hit = new Set(cubieAt(kind, faceletString, cubie));
	return Array.from({ length: 54 }, (_, i) => (hit.has(i) ? mark : null));
}
