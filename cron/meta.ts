// 구독 meta 검증 — 앱 `src/lib/push/meta.ts` 의 `PushMeta` 와 같은 모양 (SPEC FR-MT-1).
//
// `src/` 를 import 하지 않으므로 모양을 여기 다시 적는다 (SPEC FR-CR-1). 한쪽을 바꾸면
// 다른 쪽도 바꾼다 — `tests/unit/cron/meta.test.ts` 가 앱의 `buildMeta` 결과를 이
// 검증기에 먹여 둘이 어긋나지 않는지 본다.

export interface Facts {
  /** 코너 퀴즈를 마지막으로 채점한 현지 날짜. */
  lastQuiz?: string;
}

export interface Meta {
  v: 1;
  tz: string;
  daily: string | null;
  facts: Facts;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 틀리면 null. 진입점이 건너뛰고 로그에 남긴다 (FR-CR-8). */
export function validateMeta(raw: unknown): Meta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  if (typeof r.tz !== 'string' || r.tz === '') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: r.tz });
  } catch {
    return null;
  }
  if (r.daily !== null && !(typeof r.daily === 'string' && HHMM.test(r.daily))) return null;

  const facts: Facts = {};
  if (r.facts !== undefined) {
    if (!r.facts || typeof r.facts !== 'object' || Array.isArray(r.facts)) return null;
    const f = r.facts as Record<string, unknown>;
    if (f.lastQuiz !== undefined) {
      if (typeof f.lastQuiz !== 'string' || !DATE.test(f.lastQuiz)) return null;
      facts.lastQuiz = f.lastQuiz;
    }
  }
  return { v: 1, tz: r.tz, daily: r.daily as string | null, facts };
}
