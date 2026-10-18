/**
 * cron 진입점 — 인자 · 즉시 발송 · 릴레이 호출 (#33, SPEC FR-CR-3, 9, 10).
 * 가짜 fetch 로 돈다. 네트워크 없음.
 */
import { describe, it, expect } from 'vitest';
import { parseArgs, run, sendNowMessages, requestId } from '../../../cron/push.ts';

const ENV = { PUSH_RELAY_API: 'http://relay.test/', PUSH_RELAY_KEY: 'prk_secret' };
const SUB = 's_AAAAAAAAAAAAAAAAAAAAAA';
const SUB2 = 's_BBBBBBBBBBBBBBBBBBBBBB';

function fakeRelay(items: { id: string; meta: unknown }[]) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const f = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		if (url.includes('/v1/subscriptions')) return Response.json({ items, next: null });
		const body = JSON.parse(String(init?.body));
		return Response.json({
			requestId: body.requestId,
			results: body.messages.map((m: { to: string }, i: number) => ({
				to: m.to,
				status: i === 0 ? 'sent' : 'gone'
			}))
		});
	}) as typeof fetch;
	return { f, calls };
}

const logs = () => {
	const lines: string[] = [];
	return { lines, logger: { log: (m: string) => lines.push(m) } };
};

describe('parseArgs', () => {
	it('명령이 없으면 거절한다', () => {
		expect(() => parseArgs([])).toThrow();
		expect(() => parseArgs(['send'])).toThrow();
	});

	it('send-now 는 받는 쪽을 꼭 고른다 — --to 와 --all 중 하나만', () => {
		expect(() => parseArgs(['send-now', '--title', 't'])).toThrow(/--to 와 --all/);
		expect(() => parseArgs(['send-now', '--title', 't', '--all', '--to', SUB])).toThrow();
		expect(parseArgs(['send-now', '--title', 't', '--all']).all).toBe(true);
	});

	it('send-now 의 url 은 앱 경로다', () => {
		expect(() => parseArgs(['send-now', '--title', 't', '--all', '--url', 'https://x'])).toThrow();
	});

	it('instance 는 prod 또는 dev', () => {
		expect(parseArgs(['tick']).instance).toBe('prod');
		expect(parseArgs(['tick', '--instance', 'dev']).instance).toBe('dev');
		expect(() => parseArgs(['tick', '--instance', 'stage'])).toThrow();
	});
});

describe('requestId', () => {
	it('릴레이 스키마 패턴에 맞는다', () => {
		expect(requestId('send-now', new Date())).toMatch(/^[A-Za-z0-9_.:-]{1,64}$/);
	});
});

describe('sendNowMessages', () => {
	it('--all 이면 구독 전부, 같은 분에 다시 돌리면 같은 dedupKey', () => {
		const a = parseArgs(['send-now', '--title', '공지', '--body', 'b', '--url', '/', '--all']);
		const now = new Date('2026-10-18T12:00:30Z');
		const m = sendNowMessages(a, [{ id: SUB, meta: {} }, { id: SUB2, meta: {} }], now);
		expect(m.map((x) => x.to)).toEqual([SUB, SUB2]);
		expect(m[0].dedupKey).toBe('now:2026-10-18T12:00');
		expect(m[0].notification).toMatchObject({ title: '공지', body: 'b', url: '/', badge: '/badge-96.png' });
	});
});

describe('run', () => {
	it('tick: 창 안의 구독에 보내고, sent 가 아닌 결과를 남긴다. 키는 로그에 없다', async () => {
		const meta = { v: 1, tz: 'Asia/Seoul', daily: '21:00', facts: {} };
		const { f, calls } = fakeRelay([
			{ id: SUB, meta },
			{ id: SUB2, meta }
		]);
		const { lines, logger } = logs();
		await run({ argv: ['tick'], env: ENV, now: new Date('2026-10-18T12:00:00Z'), fetch: f, logger });

		const sendCall = calls.find((c) => c.url === 'http://relay.test/v1/send')!;
		expect(new Headers(sendCall.init?.headers).get('authorization')).toBe('Bearer prk_secret');
		const body = JSON.parse(String(sendCall.init?.body));
		expect(body.messages).toHaveLength(2);
		expect(lines.some((l) => l.includes(`to=${SUB2} status=gone`))).toBe(true);
		expect(lines.join('\n')).not.toContain('prk_secret');
		// requestId 는 보내기 전에 남는다
		expect(lines[0]).toContain(`requestId=${body.requestId}`);
	});

	it('tick: 보낼 것이 없으면 /v1/send 를 부르지 않는다', async () => {
		const { f, calls } = fakeRelay([{ id: SUB, meta: { v: 1, tz: 'Asia/Seoul', daily: '21:00', facts: {} } }]);
		const { lines, logger } = logs();
		await run({ argv: ['tick'], env: ENV, now: new Date('2026-10-18T03:00:00Z'), fetch: f, logger });
		expect(calls.some((c) => c.url.endsWith('/v1/send'))).toBe(false);
		expect(lines).toContain('[push] nothing to send');
	});

	it('--dry-run 은 보내지 않는다', async () => {
		const { f, calls } = fakeRelay([]);
		const { lines, logger } = logs();
		await run({
			argv: ['send-now', '--title', 't', '--to', SUB, '--dry-run'],
			env: ENV,
			now: new Date(),
			fetch: f,
			logger
		});
		expect(calls).toEqual([]);
		expect(lines.some((l) => l.startsWith('[push] would send:'))).toBe(true);
	});

	it('send-now --to 는 구독 목록을 읽지 않는다', async () => {
		const { f, calls } = fakeRelay([]);
		await run({
			argv: ['send-now', '--title', 't', '--to', SUB],
			env: ENV,
			now: new Date(),
			fetch: f,
			logger: logs().logger
		});
		expect(calls.map((c) => c.url)).toEqual(['http://relay.test/v1/send']);
	});

	it('키가 없으면 멈춘다', async () => {
		await expect(run({ argv: ['tick'], env: {}, now: new Date() })).rejects.toThrow(/PUSH_RELAY_API/);
	});
});
