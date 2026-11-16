/**
 * 시험 — 출제·판 저장·기록 (SPEC FR-EX, GLOBAL AD-13 ~ AD-15).
 *
 * 매일 퀴즈(`daily.ts`)와 다른 점은 셋이다.
 *   - **날짜가 없다.** 하루 몇 번을 치든 같은 저장소를 쓴다 (SPEC FR-EX-S-4).
 *     `ExamSession` 에 `date` 가 없는 이유다 — 날짜 묶임은 매일 퀴즈 전용이다.
 *   - **기록을 쌓는다.** 채점한 판 하나는 `ExamRecord` 로 복사해 `exam.records` 에
 *     앞자리에 넣는다 (FR-EX-REC-1). 상한은 50건, 넘치면 가장 오래된 것부터
 *     버린다 — `src/lib/domain/tracing.ts:216` `RECORD_LIMIT = 50` 과 같은 패턴.
 *   - **`correct` 는 채점 시점의 스냅샷이다.** 기록 목록을 그릴 때 재채점하지
 *     않는다 (AD-13). 데이터가 바뀌어도 과거 기록이 바뀌지 않고, idle 목록에서
 *     50건을 다시 돌리는 비용도 없다. `answers` 는 남겨 둔다 — 나중에 상세 보기를
 *     붙일 수 있다 (FR-EX-REC-2).
 *
 * 매일 퀴즈·시험이 함께 쓰는 세션 타입은 `session.ts` 에 있다. 저장 키·날짜 규칙은
 * 각자 모듈이 들고 있다 (GLOBAL AD-12).
 *
 * 룬을 쓰지 않는 순수 함수다. `daily.ts` 와 같은 규율이다.
 */

import type { Mode } from './format.js';
import { parseAnswer, type QuizAnswer } from './session.js';
import type { CaseCode } from './types.js';

/** 문항 수 범위. 사용자 결정 2026-10-29 (SPEC FR-EX-S-2). */
export const EXAM_MIN = 5;
export const EXAM_MAX = 50;
export const EXAM_DEFAULT = 10;

/**
 * 선택기 옵션. 5~50 을 5 간격으로. `/settings/notify` 의 `<select>` 패턴을
 * 재사용한다 (AD-15, `src/routes/settings/notify/+page.svelte:80-89`).
 */
export const EXAM_SIZES: readonly number[] = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

/**
 * 기록 상한. 트레이싱(`src/lib/domain/tracing.ts:216`)과 같은 50건이다. 상한이
 * 없으면 저장소 한도(≈5MiB) 에 언젠가 닿고 그 실패는 다음 저장 전체를 막는 형태로
 * 나타난다 — 상한을 두면 그 경로가 없다 (FR-EX-REC-1).
 */
export const EXAM_RECORD_LIMIT = 50;

export const isExamSize = (n: unknown): n is number =>
	typeof n === 'number' && Number.isInteger(n) && n >= EXAM_MIN && n <= EXAM_MAX;

/** 저장값을 문항 수로 읽는다. 범위 밖이면 기본값 (`daily.ts` 와 같은 모양). */
export function parseExamSize(raw: string | null): number {
	const n = raw === null ? NaN : Number(raw);
	return isExamSize(n) ? n : EXAM_DEFAULT;
}

/**
 * 시험 판. 날짜가 없는 것 말고는 `DailySession` 과 같은 모양이다 — 공용 세션 타입은
 * `session.ts` 가 들고 있다 (GLOBAL AD-12).
 */
export interface ExamSession {
	v: 1;
	mode: Mode;
	cases: CaseCode[];
	answers: QuizAnswer[];
	graded: boolean;
}

export function newExamSession(mode: Mode, cases: readonly CaseCode[]): ExamSession {
	return {
		v: 1,
		mode,
		cases: [...cases],
		answers: cases.map(() => ({ moves: [], ref: null })),
		graded: false
	};
}

/**
 * 저장 원문을 읽는다. 모양이 어긋나면 `null` — 판이 없던 것으로 친다. 던지지
 * 않는다 (`daily.ts` 의 `parseSession` 과 같은 이유: 던지면 화면이 안 선다).
 */
export function parseExamSession(raw: string | null): ExamSession | null {
	if (raw === null) return null;
	let r: Record<string, unknown>;
	try {
		r = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!r || typeof r !== 'object' || r.v !== 1) return null;
	if (r.mode !== 'setup' && r.mode !== 'direct') return null;
	if (!Array.isArray(r.cases) || !r.cases.every((c) => typeof c === 'string')) return null;
	if (!Array.isArray(r.answers) || r.answers.length !== r.cases.length) return null;
	const answers: QuizAnswer[] = [];
	for (const a of r.answers) {
		const p = parseAnswer(a);
		if (!p) return null;
		answers.push(p);
	}
	if (typeof r.graded !== 'boolean') return null;
	return { v: 1, mode: r.mode, cases: r.cases as string[], answers, graded: r.graded };
}

/**
 * 기록 한 건. `correct` 는 채점 시점의 스냅샷 (AD-13). `answers` 를 같이 들어
 * 두는 이유는 상세 보기 (FR-EX-REC-2) 를 나중에 붙일 수 있게 하기 위함이다 —
 * 지금 화면은 쓰지 않는다.
 */
export interface ExamRecord {
	/** Unix ms. */
	at: number;
	/** 채점한 현지 날짜 `YYYY-MM-DD`. */
	date: string;
	mode: Mode;
	cases: CaseCode[];
	answers: QuizAnswer[];
	/** 채점 시점의 정답 수 스냅샷. 재채점하지 않는다 (AD-13). */
	correct: number;
}

export interface ExamRecordsStored {
	schemaVersion: 1;
	records: ExamRecord[];
}

export const EXAM_RECORDS_SCHEMA_VERSION = 1;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 저장 원문을 안전하게 읽는다. 깨진 JSON · 스키마 불일치 · 형태 이상은 전부 빈
 * 배열로 되돌린다. 이 함수가 던지면 화면이 아니라 앱 기동이 막힌다
 * (`tracing.ts` 의 `parseRecords` 와 같은 이유).
 *
 * 항목 단위로 거른다. 한 건이 깨졌다고 나머지 49건을 같이 버릴 이유가 없다 —
 * 사용자가 잃는 것이 더 크다.
 */
export function parseRecords(raw: string | null): ExamRecord[] {
	if (raw == null || raw === '') return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!parsed || typeof parsed !== 'object') return [];
	const o = parsed as Record<string, unknown>;
	if (o.schemaVersion !== EXAM_RECORDS_SCHEMA_VERSION) return [];
	if (!Array.isArray(o.records)) return [];
	return o.records.filter(isRecord).slice(0, EXAM_RECORD_LIMIT);
}

function isRecord(v: unknown): v is ExamRecord {
	if (!v || typeof v !== 'object') return false;
	const r = v as Record<string, unknown>;
	if (typeof r.at !== 'number') return false;
	if (typeof r.date !== 'string' || !DATE.test(r.date)) return false;
	if (r.mode !== 'setup' && r.mode !== 'direct') return false;
	if (!Array.isArray(r.cases) || !r.cases.every((c) => typeof c === 'string')) return false;
	if (!Array.isArray(r.answers) || r.answers.length !== r.cases.length) return false;
	for (const a of r.answers) if (!parseAnswer(a)) return false;
	if (typeof r.correct !== 'number' || !Number.isInteger(r.correct) || r.correct < 0) return false;
	return true;
}

/** 상한을 적용해 직렬화한다. 자르는 지점을 저장 경로 하나로 모은다. */
export function serializeRecords(records: readonly ExamRecord[]): string {
	const stored: ExamRecordsStored = {
		schemaVersion: EXAM_RECORDS_SCHEMA_VERSION,
		records: records.slice(0, EXAM_RECORD_LIMIT)
	};
	return JSON.stringify(stored);
}

/**
 * 새 기록을 **맨 앞** 에 넣는다. 상한을 넘으면 가장 오래된 것부터 버린다.
 *
 * 새 배열을 낸다 — 제자리에서 밀어 넣으면 반응성 저장소가 변화를 못 본다
 * (`tracing.ts` 의 `pushRecord` 와 같은 이유).
 */
export function pushRecord(records: readonly ExamRecord[], rec: ExamRecord): ExamRecord[] {
	return [rec, ...records].slice(0, EXAM_RECORD_LIMIT);
}
