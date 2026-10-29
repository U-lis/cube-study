/**
 * 퀴즈 세션의 공용 타입과 헬퍼 (SPEC FR-EX-R, GLOBAL AD-12).
 *
 * 매일 퀴즈(`daily.ts`)와 시험(`exam.ts`)이 함께 쓰는 것만 둔다. 세션 스토어
 * (저장 키, 날짜 규칙)와 활성 단계 자판+AnchorPad 는 각자 모듈이 들고 있다 —
 * 매일 퀴즈는 하루 한 판·날짜 묶임, 시험은 50건 기록이라 서로 섞이면 둘 다 더 복잡해진다.
 */

import type { AnchorRef } from './anchor.js';
import type { Mode } from './format.js';
import type { Verdict } from './grade.js';
import type { CaseEntry } from './types.js';

/**
 * 한 문제의 답. 입력 방식과 같은 모양이다 — direct 는 무브열, setup 은 셋업
 * 무브와 고른 기준공식. 판을 시작할 때 고른 방식이 판 끝까지 간다.
 */
export interface QuizAnswer {
	moves: string[];
	ref: AnchorRef | null;
}

/**
 * 결과 그리드 한 줄. 호출자가 채점한 뒤 넘긴다 — 공용 결과 컴포넌트가 데이터셋이나
 * 시뮬레이터를 알지 않게 한다. 매일 퀴즈와 시험이 같은 자리에 쓴다.
 */
export interface QuizResultRow {
	entry: CaseEntry;
	answer: QuizAnswer;
	verdict: Verdict | null;
}

export const emptyAnswer = (): QuizAnswer => ({ moves: [], ref: null });

/** 답을 낸 것인가. setup 은 기준을 골라야 답이다 — 셋업 무브만으로는 식이 안 선다. */
export function isAnswered(mode: Mode, a: QuizAnswer): boolean {
	return mode === 'setup' ? a.ref !== null : a.moves.length > 0;
}

/**
 * 저장 원문의 한 칸을 읽는다. 모양이 어긋나면 null — 호출자가 세션 전체를 버린다.
 * 던지지 않는다 (던지면 화면이 안 선다).
 */
export function parseAnswer(raw: unknown): QuizAnswer | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	if (!Array.isArray(r.moves) || !r.moves.every((m) => typeof m === 'string')) return null;
	let ref: AnchorRef | null = null;
	if (r.ref !== null) {
		const x = r.ref as Record<string, unknown> | undefined;
		if (!x || typeof x.name !== 'string' || typeof x.inverse !== 'boolean') return null;
		ref = { name: x.name, inverse: x.inverse };
	}
	return { moves: r.moves as string[], ref };
}
