/**
 * cron 규칙 · 평가 (#33, SPEC FR-CR-4 ~ 8).
 */
import { describe, it, expect } from 'vitest';
import { loadCases } from '../../../cron/cases.ts';
import { plan, BADGE, ICON } from '../../../cron/engine.ts';
import { daily, DAILY_URL, WINDOW_MIN } from '../../../cron/rules/daily.ts';
import { RULES } from '../../../cron/rules/index.ts';
import type { Rule } from '../../../cron/rules/types.ts';

const cases = loadCases();
const SUB = 's_AAAAAAAAAAAAAAAAAAAAAA';
const meta = (daily: string | null, tz = 'Asia/Seoul') => ({ v: 1, tz, daily, facts: {} });
// 2026-10-18 21:00 KST = 12:00Z
const at = (iso: string) => new Date(iso);

describe('daily', () => {
	const ev = (m: ReturnType<typeof meta>, now: Date) =>
		daily.evaluate({ id: SUB, meta: { ...m, v: 1 } }, { now, cases });

	it('정한 시각부터 30분 안에서 맞는다', () => {
		expect(ev(meta('21:00'), at('2026-10-18T11:59:00Z'))).toBeNull();
		expect(ev(meta('21:00'), at('2026-10-18T12:00:00Z'))).not.toBeNull();
		expect(ev(meta('21:00'), at('2026-10-18T12:29:00Z'))).not.toBeNull();
		expect(ev(meta('21:00'), at('2026-10-18T12:30:00Z'))).toBeNull();
		expect(WINDOW_MIN).toBe(30);
	});

	it('창은 현지 자정에서 잘린다 — 다음 날로 넘겨 두 번 가지 않는다', () => {
		// 23:50 KST = 14:50Z. 00:05 KST 는 다음 날이다.
		expect(ev(meta('23:50'), at('2026-10-18T14:59:00Z'))).not.toBeNull();
		expect(ev(meta('23:50'), at('2026-10-18T15:05:00Z'))).toBeNull();
	});

	it('dedupKey 는 현지 날짜다 — 창 안에서 매분 맞아도 하루 한 번', () => {
		const a = ev(meta('21:00'), at('2026-10-18T12:00:00Z'));
		const b = ev(meta('21:00'), at('2026-10-18T12:15:00Z'));
		expect(a?.dedupKey).toBe('daily:2026-10-18');
		expect(b?.dedupKey).toBe(a?.dedupKey);
	});

	it('시간대를 따른다', () => {
		// 21:00 뉴욕(EDT, UTC-4) = 다음 날 01:00Z
		expect(ev(meta('21:00', 'America/New_York'), at('2026-10-18T12:00:00Z'))).toBeNull();
		expect(ev(meta('21:00', 'America/New_York'), at('2026-10-19T01:00:00Z'))?.dedupKey).toBe(
			'daily:2026-10-18'
		);
	});

	it('daily 가 null 이면 보내지 않는다', () => {
		expect(ev(meta(null), at('2026-10-18T12:00:00Z'))).toBeNull();
	});

	it('문구는 사실만 — 매일 퀴즈 화면을 연다. 문제는 고르지 않는다 (FR-DQ-7)', () => {
		const hit = ev(meta('21:00'), at('2026-10-18T12:00:00Z'))!;
		expect(hit.notification.title).toBe('매일 퀴즈');
		expect(hit.notification.body).toBe('코너 3-style');
		expect(hit.notification.url).toBe(DAILY_URL);
		expect(DAILY_URL).toBe('/3x3/bld/3style/corner/daily');
	});
});

describe('plan', () => {
	const now = at('2026-10-18T12:00:00Z');

	it('맞은 규칙마다 메시지 하나, 모두 큐브 badge 와 앱 아이콘을 단다', () => {
		const p = plan([{ id: SUB, meta: meta('21:00') }], RULES, { now, cases });
		expect(p.messages).toHaveLength(1);
		expect(p.messages[0].notification.badge).toBe(BADGE);
		expect(p.messages[0].notification.icon).toBe(ICON);
		expect(p.messages[0].to).toBe(SUB);
	});

	it('meta 가 틀린 구독은 건너뛰고 사정을 남긴다', () => {
		const p = plan([{ id: SUB, meta: { v: 2 } }], RULES, { now, cases });
		expect(p.messages).toEqual([]);
		expect(p.notes[0]).toMatch(/^skip invalid meta/);
	});

	it('한 구독에 여러 규칙이 맞으면 전부 보낸다', () => {
		const cond: Rule = {
			id: 'always',
			kind: 'condition',
			evaluate: () => ({ dedupKey: 'always:1', notification: { title: 't' } })
		};
		const p = plan([{ id: SUB, meta: meta('21:00') }], [...RULES, cond], { now, cases });
		expect(p.messages.map((m) => m.dedupKey)).toEqual(['daily:2026-10-18', 'always:1']);
	});

	it('규칙 하나가 던져도 나머지는 돈다', () => {
		const bad: Rule = {
			id: 'bad',
			kind: 'condition',
			evaluate: () => {
				throw new Error('boom');
			}
		};
		const p = plan([{ id: SUB, meta: meta('21:00') }], [bad, ...RULES], { now, cases });
		expect(p.messages).toHaveLength(1);
		expect(p.notes.some((n) => n.startsWith('rule error: rule=bad'))).toBe(true);
	});

	it('3072 바이트를 넘는 알림은 건너뛴다 — 요청 전체가 400 이 되지 않게', () => {
		const big: Rule = {
			id: 'big',
			kind: 'condition',
			evaluate: () => ({ dedupKey: 'big', notification: { title: 'x'.repeat(4000) } })
		};
		const p = plan([{ id: SUB, meta: meta(null) }], [big], { now, cases });
		expect(p.messages).toEqual([]);
		expect(p.notes[0]).toMatch(/^skip oversized/);
	});

	it('조건 규칙은 아직 없다 — 사용자가 정할 때 생긴다', () => {
		expect(RULES.map((r) => r.id)).toEqual(['daily']);
	});
});
