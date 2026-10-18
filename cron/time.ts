// 시간대 계산 — `Intl.DateTimeFormat` 만 쓴다. 날짜 라이브러리 없음 (SPEC FR-CR-2).

/** 현지 날짜 `YYYY-MM-DD`. en-CA 가 ISO 형식으로 낸다. 앱 `src/lib/push/meta.ts` 와 같은 방식. */
export function localDate(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 현지 자정부터 센 분 (0 ~ 1439). */
export function localMinute(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

export const hhmmToMinute = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** 두 현지 날짜 사이의 날 수 (b − a). 시간대와 무관한 달력 계산이다. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.round(ms / 86_400_000);
}
