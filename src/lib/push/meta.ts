/**
 * 구독 meta (SPEC FR-MT-1 ~ 4).
 *
 * 릴레이는 meta 를 해석하지 않고 cron 이 구독 목록에서 그대로 돌려받는다. cron 이
 * 볼 수 있는 기기 사정은 **여기 실린 것뿐이다** — 진도는 기기 `localStorage` 에만 있고
 * 서버가 없다. 그래서 조건 알림이 읽을 사실(`facts`)도 여기 싣는다.
 *
 * 룬도 브라우저도 쓰지 않는 순수 함수다. 시각은 인자로 받는다.
 * 같은 모양을 cron 이 `cron/meta.ts` 에서 검증한다 — 둘이 어긋나면 cron 이 그 구독을
 * 건너뛴다. 한쪽을 바꾸면 다른 쪽도 바꾼다.
 */

/** 매일 퀴즈 기본 시각 (D-9, #33 초안). */
export const DEFAULT_DAILY = '21:00';

/** 직렬화 상한 (연동 문서 §2). */
export const META_BYTE_LIMIT = 1024;

export interface PushFacts {
	/** 코너 퀴즈를 마지막으로 채점한 현지 날짜 `YYYY-MM-DD`. 없으면 칸이 없다. */
	lastQuiz?: string;
}

export interface PushMeta {
	v: 1;
	/** IANA 시간대. 기기 시간대를 그대로 싣는다. */
	tz: string;
	/** 매일 퀴즈 시각 `HH:MM`. `null` 이면 매일 퀴즈를 안 받는다. */
	daily: string | null;
	facts: PushFacts;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isHHMM = (s: unknown): s is string => typeof s === 'string' && HHMM.test(s);

export function buildMeta(tz: string, daily: string | null, facts: PushFacts): PushMeta {
	const f: PushFacts = {};
	if (facts.lastQuiz) f.lastQuiz = facts.lastQuiz;
	return { v: 1, tz, daily: isHHMM(daily) ? daily : null, facts: f };
}

/** 그 시간대의 현지 날짜 `YYYY-MM-DD`. */
export function localDate(now: Date, tz: string): string {
	// en-CA 는 YYYY-MM-DD 로 낸다. 라이브러리 없이 시간대를 다루는 유일한 표준 경로다.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

export const metaBytes = (m: PushMeta): number => new TextEncoder().encode(JSON.stringify(m)).length;
