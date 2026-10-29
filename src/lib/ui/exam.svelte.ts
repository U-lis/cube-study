/**
 * 시험 상태 (SPEC FR-EX).
 *
 * 매일 퀴즈(`daily.svelte.ts`)와 평행한다. 다른 점은 셋이다.
 *   - 날짜 묶임이 없다 — 하루 몇 번을 쳐도 같은 저장을 쓴다 (FR-EX-S-4).
 *   - 채점한 판 하나는 `ExamRecord` 로 복사해 `exam.records` 에 앞으로 밀어 넣는다
 *     (FR-EX-REC-1). 상한 50건은 `pushRecord` 가 지킨다.
 *   - `correct` 는 채점 시점의 스냅샷을 쓴다 (AD-13). 기록 목록은 저장된 숫자를
 *     그대로 보인다 — 재채점하지 않는다.
 *
 * 입력 방식은 매일 퀴즈와 공유 읽기다 (`settings.quizInput`). 시험 전용 키를
 * 두지 않는다 (AD-15). 그래서 이 모듈은 `quizInput` 을 저장하지 않는다.
 */

import { browser } from '$app/environment';
import {
	EXAM_DEFAULT,
	isExamSize,
	newExamSession,
	parseExamSession,
	parseExamSize,
	parseRecords,
	pushRecord,
	serializeRecords,
	type ExamRecord,
	type ExamSession
} from '$lib/domain/exam.js';
import type { Mode } from '$lib/domain/format.js';
import type { QuizAnswer } from '$lib/domain/session.js';
import type { CaseCode } from '$lib/domain/types.js';

const KEY_SIZE = 'exam.size';
const KEY_SESSION = 'exam.session';
const KEY_RECORDS = 'exam.records';

function get(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function put(key: string, v: string) {
	try {
		localStorage.setItem(key, v);
	} catch {
		// 저장이 막혀도 이번 세션은 돈다 (daily.svelte.ts 와 같은 처리)
	}
}
function remove(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// 조용히 넘긴다
	}
}

class Exam {
	/** 문항 수. 시험 화면 설정 줄에서 고른다 (FR-EX-S-2). */
	size = $state<number>(parseExamSize(get(KEY_SIZE)));
	session = $state<ExamSession | null>(parseExamSession(get(KEY_SESSION)));
	records = $state<ExamRecord[]>(parseRecords(get(KEY_RECORDS)));

	#saveSession() {
		if (this.session) put(KEY_SESSION, JSON.stringify(this.session));
		else remove(KEY_SESSION);
	}
	#saveRecords() {
		put(KEY_RECORDS, serializeRecords(this.records));
	}

	/**
	 * 문항 수를 바꾼다. idle (판이 없거나 채점한 판) 에서만 반영한다 — 측정하는 판이
	 * 도는 동안 바꾸면 안 된다 (CONVENTIONS 2.3).
	 */
	setSize(n: number) {
		if (!isExamSize(n)) return;
		if (this.session && !this.session.graded) return;
		this.size = n;
		put(KEY_SIZE, String(n));
	}

	/**
	 * 판을 시작한다. 이미 unanswered 세션이 있으면 그대로 둔다 — 중간에 나갔다
	 * 돌아오면 그 자리부터 이어 푼다 (FR-EX-S-6).
	 */
	start(mode: Mode, cases: readonly CaseCode[]) {
		if (this.session && !this.session.graded) return;
		this.session = newExamSession(mode, cases);
		this.#saveSession();
	}

	answer(i: number, a: QuizAnswer) {
		if (!this.session || this.session.graded) return;
		this.session.answers[i] = a;
		this.#saveSession();
	}

	/**
	 * 채점한다. `correct` 는 호출부가 넘긴다 — 데이터셋·시뮬레이터를 이 모듈이
	 * 알지 않게 한다 (`QuizResults.svelte` 와 같은 분리).
	 *
	 * 호출부가 바로 `push.noteQuiz()` 를 부른다 (SPEC D-10, AD-14).
	 */
	grade(correct: number, date: string, now: number = Date.now()) {
		if (!this.session || this.session.graded) return;
		this.session.graded = true;
		this.#saveSession();
		const sn = this.session;
		this.records = pushRecord(this.records, {
			at: now,
			date,
			mode: sn.mode,
			cases: [...sn.cases],
			answers: sn.answers.map((a) => ({ moves: [...a.moves], ref: a.ref })),
			correct
		});
		this.#saveRecords();
	}

	/** idle 로 되돌아간다. 기록은 건드리지 않는다. */
	reset() {
		this.session = null;
		this.#saveSession();
	}
}

export const exam = new Exam();

/** 저장 키 (테스트가 심을 때 참조한다). */
export const KEYS = {
	size: KEY_SIZE,
	session: KEY_SESSION,
	records: KEY_RECORDS
} as const;

/** 공개 size 기본값 — `EXAM_DEFAULT` 를 다시 export 해 둔다. */
export { EXAM_DEFAULT };
