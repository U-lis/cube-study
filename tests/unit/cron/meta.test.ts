/**
 * 앱이 만드는 meta 와 cron 의 검증이 같은 모양인가 (#33, SPEC FR-MT-1).
 *
 * cron 은 `src/` 를 import 하지 않으므로 모양을 따로 적는다. 둘이 어긋나면 cron 이 그
 * 구독을 말없이 건너뛴다 — 알림이 안 오는데 아무도 모른다. 여기서 앱의 결과를 cron 에
 * 먹여 본다.
 */
import { describe, it, expect } from 'vitest';
import { buildMeta, localDate, metaBytes, META_BYTE_LIMIT, DEFAULT_DAILY } from '../../../src/lib/push/meta.ts';
import { validateMeta } from '../../../cron/meta.ts';
import { localDate as cronLocalDate } from '../../../cron/time.ts';

describe('meta', () => {
	it('앱이 만든 meta 를 cron 이 받아들인다', () => {
		for (const m of [
			buildMeta('Asia/Seoul', '21:00', {}),
			buildMeta('Asia/Seoul', null, { lastQuiz: '2026-10-18' }),
			buildMeta('America/New_York', '07:05', { lastQuiz: '2026-01-02' })
		]) {
			expect(validateMeta(JSON.parse(JSON.stringify(m)))).toEqual(m);
		}
	});

	it('틀린 시각은 null 로 싣는다', () => {
		expect(buildMeta('Asia/Seoul', '25:00', {}).daily).toBeNull();
	});

	it('cron 은 틀린 모양을 거절한다', () => {
		expect(validateMeta(null)).toBeNull();
		expect(validateMeta({ v: 2, tz: 'Asia/Seoul', daily: null })).toBeNull();
		expect(validateMeta({ v: 1, tz: 'Nowhere/City', daily: null })).toBeNull();
		expect(validateMeta({ v: 1, tz: 'Asia/Seoul', daily: '9:00' })).toBeNull();
		expect(validateMeta({ v: 1, tz: 'Asia/Seoul', daily: null, facts: { lastQuiz: 'x' } })).toBeNull();
	});

	it('1024 바이트 안에 든다', () => {
		const m = buildMeta('America/Argentina/ComodRivadavia', '23:59', { lastQuiz: '2026-12-31' });
		expect(metaBytes(m)).toBeLessThan(META_BYTE_LIMIT);
	});

	it('앱과 cron 의 현지 날짜 계산이 같다', () => {
		const now = new Date('2026-10-18T15:30:00Z');
		for (const tz of ['Asia/Seoul', 'UTC', 'America/Los_Angeles']) {
			expect(localDate(now, tz)).toBe(cronLocalDate(now, tz));
		}
	});

	it('기본 시각은 21:00', () => {
		expect(DEFAULT_DAILY).toBe('21:00');
	});
});
