/**
 * 매일 퀴즈 — 출제와 저장 형식 (SPEC FR-DQ). 순수 함수.
 *
 * 연습 퀴즈(`quiz.ts`)와 달리 **한 판이 하루에 하나**다. 문제를 다 풀고 나서 한 번에
 * 채점하고, 그 결과를 그날 동안 남긴다. 그래서 출제는 판을 시작할 때 한 번 하고
 * 그 목록을 저장한다 — 날짜로 시드를 만들어 다시 계산하지 않는다. 그사이 암기 체크가
 * 바뀌어도 이미 받은 문제가 바뀌면 안 되기 때문이다.
 *
 * memorize.ts 와 같은 규칙을 따른다 — Svelte 를 import 하지 않고, 난수는 인자로 받는다.
 */

import type { AnchorRef } from './anchor.js';
import type { Mode } from './format.js';
import type { InverseOf } from './quiz.js';
import type { CaseCode } from './types.js';

/** 문제 수 범위 (사용자 결정 2026-10-19). */
export const DAILY_MIN = 5;
export const DAILY_MAX = 20;
export const DAILY_DEFAULT = 10;

export const DAILY_SIZES: readonly number[] = Array.from(
	{ length: DAILY_MAX - DAILY_MIN + 1 },
	(_, i) => DAILY_MIN + i
);

export const isDailySize = (n: unknown): n is number =>
	typeof n === 'number' && Number.isInteger(n) && n >= DAILY_MIN && n <= DAILY_MAX;

/** 저장값을 문제 수로 읽는다. 범위 밖이면 기본값. */
export function parseSize(raw: string | null): number {
	const n = raw === null ? NaN : Number(raw);
	return isDailySize(n) ? n : DAILY_DEFAULT;
}

function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

/**
 * 그날의 문제를 고른다 (FR-DQ-3).
 *
 * **외운 것이 먼저다.** 외운 것이 n 개 이상이면 외운 것만 낸다. 모자라면 나머지를
 * 외우지 않은 것에서 무작위로 채운다. 순서는 섞는다 — 채운 문제가 끝에 몰리면
 * 어디부터가 안 외운 것인지 보인다.
 *
 * 한 판 안에서 역쌍(XY/YX)은 되도록 같이 내지 않는다. 답이 서로의 뒤집기라
 * 하나를 풀면 다른 하나가 공짜다 (`quiz.ts` 0.4.2 와 같은 이유). 다만 이것이
 * "외운 것 먼저" 를 이기지는 않는다 — 외운 것이 역쌍으로만 남으면 그대로 낸다.
 *
 * memorized 에 all 밖 코드가 섞여 있어도 안전하다 (버린다). 전체가 n 보다 적으면
 * 전체를 낸다.
 */
export function buildDailySet(
	all: readonly CaseCode[],
	memorized: ReadonlySet<CaseCode>,
	n: number,
	inverseOf: InverseOf,
	rand: () => number
): CaseCode[] {
	const picked: CaseCode[] = [];
	const blocked = new Set<CaseCode>();
	const take = (c: CaseCode) => {
		picked.push(c);
		blocked.add(c);
		const inv = inverseOf(c);
		if (inv !== undefined) blocked.add(inv);
	};
	const fill = (pool: readonly CaseCode[]) => {
		const order = shuffle(pool, rand);
		// 역쌍을 피해 한 바퀴, 모자라면 역쌍을 허용해 한 바퀴
		for (const c of order) if (picked.length < n && !blocked.has(c)) take(c);
		for (const c of order) if (picked.length < n && !picked.includes(c)) take(c);
	};
	fill(all.filter((c) => memorized.has(c)));
	fill(all.filter((c) => !memorized.has(c)));
	return shuffle(picked, rand);
}

/**
 * 한 문제의 답. 입력 방식과 같은 모양이다 — direct 는 무브열, setup 은 셋업 무브와
 * 고른 기준공식. 판을 시작할 때 고른 방식이 판 끝까지 간다.
 */
export interface DailyAnswer {
	moves: string[];
	ref: AnchorRef | null;
}

export interface DailySession {
	v: 1;
	/** 판을 시작한 현지 날짜 `YYYY-MM-DD`. 오늘이 아니면 지난 판이다. */
	date: string;
	mode: Mode;
	cases: CaseCode[];
	answers: DailyAnswer[];
	graded: boolean;
}

export const emptyAnswer = (): DailyAnswer => ({ moves: [], ref: null });

export function newSession(date: string, mode: Mode, cases: readonly CaseCode[]): DailySession {
	return { v: 1, date, mode, cases: [...cases], answers: cases.map(emptyAnswer), graded: false };
}

/** 답을 낸 것인가. setup 은 기준을 골라야 답이다 — 셋업 무브만으로는 식이 안 선다. */
export function isAnswered(mode: Mode, a: DailyAnswer): boolean {
	return mode === 'setup' ? a.ref !== null : a.moves.length > 0;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseAnswer(raw: unknown): DailyAnswer | null {
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

/**
 * 저장 원문을 읽는다. 모양이 하나라도 어긋나면 null — 그날 판이 없던 것으로 친다.
 * 던지지 않는다 (memorize.ts 의 parseStored 와 같은 이유: 던지면 화면이 안 선다).
 */
export function parseSession(raw: string | null): DailySession | null {
	if (raw === null) return null;
	let r: Record<string, unknown>;
	try {
		r = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!r || typeof r !== 'object' || r.v !== 1) return null;
	if (typeof r.date !== 'string' || !DATE.test(r.date)) return null;
	if (r.mode !== 'setup' && r.mode !== 'direct') return null;
	if (!Array.isArray(r.cases) || !r.cases.every((c) => typeof c === 'string')) return null;
	if (!Array.isArray(r.answers) || r.answers.length !== r.cases.length) return null;
	const answers: DailyAnswer[] = [];
	for (const a of r.answers) {
		const p = parseAnswer(a);
		if (!p) return null;
		answers.push(p);
	}
	if (typeof r.graded !== 'boolean') return null;
	return { v: 1, date: r.date, mode: r.mode, cases: r.cases as string[], answers, graded: r.graded };
}
