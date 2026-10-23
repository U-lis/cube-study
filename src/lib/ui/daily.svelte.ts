/**
 * 매일 퀴즈 상태 (SPEC FR-DQ).
 *
 * 문제 수와 그날의 판 하나를 저장한다. 판은 문제·답·채점 여부를 통째로 들고 있어서
 * 풀다 나갔다 와도, 채점한 뒤 다시 열어도 그대로다 (FR-DQ-6). 지난 날짜의 판은
 * 화면이 "오늘이 아니다" 로 보고 새로 시작하게 한다 — 여기서 날짜를 판단하지 않는다.
 */
import { browser } from '$app/environment';
import {
	isDailySize,
	newSession,
	parseSession,
	parseSize,
	type DailyAnswer,
	type DailySession
} from '$lib/domain/daily.js';
import type { Mode } from '$lib/domain/format.js';
import type { CaseCode } from '$lib/domain/types.js';

const KEY_SIZE = 'daily.size';
const KEY_SESSION = 'daily.session';

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
		// 저장이 막혀도 이번 세션은 돈다
	}
}

class Daily {
	/** 문제 수. 알림 설정 화면에서 고른다 (FR-DQ-1). */
	size = $state<number>(parseSize(get(KEY_SIZE)));
	session = $state<DailySession | null>(parseSession(get(KEY_SESSION)));

	#save() {
		if (this.session) put(KEY_SESSION, JSON.stringify(this.session));
	}

	setSize(n: number) {
		if (!isDailySize(n)) return;
		this.size = n;
		put(KEY_SIZE, String(n));
	}

	start(date: string, mode: Mode, cases: readonly CaseCode[]) {
		this.session = newSession(date, mode, cases);
		this.#save();
	}

	answer(i: number, a: DailyAnswer) {
		if (!this.session || this.session.graded) return;
		this.session.answers[i] = a;
		this.#save();
	}

	grade() {
		if (!this.session) return;
		this.session.graded = true;
		this.#save();
	}
}

export const daily = new Daily();
