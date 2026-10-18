/**
 * 스티커 문자 훈련의 도메인 순수부 (Phase 1, `PHASE_1_TEST.md`).
 */
import { describe, it, expect } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import {
	answerOf,
	cubieAt,
	cubiesOf,
	gradeLetters,
	isLetterKind,
	isOthers,
	isQuizStage,
	labelsLookup,
	marksQuiz,
	paintLookup,
	paintQuiz
} from '../../src/lib/domain/letters.js';
import {
	CORNER_AT,
	CORNER_FACELETS,
	EDGE_AT,
	EDGE_FACELETS,
	type PieceKind
} from '../../src/lib/cube/speffz.js';

const SOLVED = new Cube().asString();
const GRAY = '#999';
/** 칸마다 다른 "실제 색". 칸 번호가 곧 색이라 어느 칸이 칠해졌는지 바로 보인다. */
const COLORS = Array.from({ length: 54 }, (_, i) => `c${i}`);
const CENTERS = [4, 13, 22, 31, 40, 49];
const KINDS: PieceKind[] = ['corner', 'edge'];
const faceletsOf = (kind: PieceKind) => (kind === 'corner' ? CORNER_FACELETS : EDGE_FACELETS);

describe('채점 — 순서 무관 정렬 비교 (FR-LT-15)', () => {
	it('엣지 UB 는 aq 와 qa 가 둘 다 정답이다', () => {
		expect(gradeLetters('edge', 'UB', ['a', 'q']).kind).toBe('correct');
		expect(gradeLetters('edge', 'UB', ['q', 'a']).kind).toBe('correct');
	});

	it('코너 UBL 은 어떤 순서로 내도 정답이다', () => {
		expect(gradeLetters('corner', 'UBL', ['R', 'A', 'E']).kind).toBe('correct');
	});

	it('같은 문자를 겹쳐 낸 답은 오답이고 정답을 돌려준다', () => {
		const v = gradeLetters('edge', 'UB', ['a', 'a']);
		expect(v).toEqual({ kind: 'wrong', answer: ['a', 'q'] });
	});

	it('개수가 모자라거나 넘치면 오답이다', () => {
		expect(gradeLetters('edge', 'UB', ['a']).kind).toBe('wrong');
		expect(gradeLetters('edge', 'UB', ['a', 'q', 'b']).kind).toBe('wrong');
	});

	it('대소문자는 종류에 맞춰 정규화한다', () => {
		expect(gradeLetters('edge', 'UB', ['A', 'Q']).kind).toBe('correct');
		expect(gradeLetters('corner', 'UBL', ['a', 'e', 'r']).kind).toBe('correct');
	});

	it('모든 큐비에서 정답을 뒤집어 넣으면 정답이다', () => {
		for (const kind of KINDS)
			for (const cubie of cubiesOf(kind))
				expect(gradeLetters(kind, cubie, [...answerOf(kind, cubie)].reverse()).kind).toBe('correct');
	});
});

describe('출제 pool (FR-LT-19)', () => {
	it('코너 8 · 엣지 12 이고 버퍼 큐비도 들어 있다', () => {
		expect(cubiesOf('corner')).toHaveLength(8);
		expect(cubiesOf('edge')).toHaveLength(12);
		expect(cubiesOf('corner')).toContain('UBL');
		expect(cubiesOf('edge')).toContain('UF');
	});
});

describe('외우기 — 글자 배열 (FR-LT-7)', () => {
	it('고른 종류의 24칸에만 그 칸의 문자가 찍힌다', () => {
		for (const kind of KINDS) {
			const at = kind === 'corner' ? CORNER_AT : EDGE_AT;
			const labels = labelsLookup(kind);
			expect(labels).toHaveLength(54);
			expect(labels.filter((l) => l !== null)).toHaveLength(24);
			labels.forEach((l, i) => expect(l).toBe(at[i] ?? null));
		}
	});
});

describe('외우기 — 칠 (FR-LT-7a)', () => {
	it('다른 조각이 회색이면 센터와 고른 종류만 실제 색이다', () => {
		for (const kind of KINDS) {
			const keep = new Set([...CENTERS, ...Object.values(faceletsOf(kind)).flat()]);
			const out = paintLookup(kind, 'gray', COLORS, GRAY);
			out.forEach((c, i) => expect(c).toBe(keep.has(i) ? COLORS[i] : GRAY));
		}
	});

	it('다른 조각이 색이면 54칸 전부 실제 색이다', () => {
		for (const kind of KINDS) expect(paintLookup(kind, 'color', COLORS, GRAY)).toEqual(COLORS);
	});
});

describe('퀴즈 — 문제 큐비의 자리 (AD-LT-5)', () => {
	it('풀린 상태에서는 큐비의 원래 칸이다', () => {
		for (const kind of KINDS)
			for (const cubie of cubiesOf(kind))
				expect(cubieAt(kind, SOLVED, cubie).sort()).toEqual([...faceletsOf(kind)[cubie]].sort());
	});

	it('섞인 상태에서는 그 큐비의 색이 앉은 칸이다', () => {
		const cube = new Cube();
		cube.move("R U F' L2 D B' R2 U'");
		const scrambled = cube.asString();
		for (const kind of KINDS)
			for (const cubie of cubiesOf(kind)) {
				const at = cubieAt(kind, scrambled, cubie);
				const home = faceletsOf(kind)[cubie];
				expect(at).toHaveLength(home.length);
				// 칸에 앉은 색(면 문자) 집합 = 그 큐비의 원래 색 집합
				expect(at.map((i) => scrambled[i]).sort()).toEqual(home.map((i) => SOLVED[i]).sort());
			}
	});
});

describe('퀴즈 — 칠과 외곽선 (FR-LT-12, 12a)', () => {
	const mark = { color: '#f0f', outline: 'double' as const };

	it('회색 설정: 센터와 문제 큐비만 실제 색이다', () => {
		const out = paintQuiz('corner', 'DFR', 'gray', SOLVED, COLORS, GRAY);
		const keep = new Set([...CENTERS, ...CORNER_FACELETS.DFR]);
		out.forEach((c, i) => expect(c).toBe(keep.has(i) ? COLORS[i] : GRAY));
	});

	it('색 설정: 54칸 전부 실제 색이다', () => {
		expect(paintQuiz('edge', 'FR', 'color', SOLVED, COLORS, GRAY)).toEqual(COLORS);
	});

	it('외곽선은 문제 큐비 칸에만 있다', () => {
		const marks = marksQuiz('edge', 'FR', SOLVED, mark);
		marks.forEach((m, i) => expect(m).toEqual(EDGE_FACELETS.FR.includes(i) ? mark : null));
	});
});

describe('설정 값 판정 (AD-LT-11)', () => {
	it('유효값만 통과한다', () => {
		expect(isLetterKind('corner') && isLetterKind('edge')).toBe(true);
		expect(isOthers('gray') && isOthers('color')).toBe(true);
		expect(isQuizStage('solved') && isQuizStage('scrambled')).toBe(true);
		for (const bad of [null, '', 'both', undefined, 1])
			expect(isLetterKind(bad) || isOthers(bad) || isQuizStage(bad)).toBe(false);
	});
});
