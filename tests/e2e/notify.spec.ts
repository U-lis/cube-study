/**
 * 알림 설정 화면 (#33, 0.7.0 SPEC FR-NT · FR-MT).
 *
 * 릴레이 `client.js` 를 가짜로 바꿔 끼운다. 진짜 릴레이에 닿지 않는다 — 브라우저 권한과
 * 푸시 서비스는 Playwright 가 흉내 낼 수 없고, 그 경로는 릴레이 쪽 검사가 본다.
 * 여기서 보는 것은 **앱이 릴레이에게 무엇을 언제 부탁하는가** 다.
 */
import { test, expect, type Page } from '@playwright/test';

const NOTIFY = '/settings/notify';

/** 가짜 PushRelay. 부른 기록을 `window.__relay` 에 남긴다. */
async function fakeRelay(page: Page, initial: 'off' | 'on' | 'denied' | 'unsupported' = 'off', failCode = '') {
	await page.route('**/client.js', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `
				window.__relay = { state: ${JSON.stringify(initial)}, calls: [] };
				window.PushRelay = {
					async state() { window.__relay.calls.push(['state']); return window.__relay.state; },
					async enable(meta) {
						window.__relay.calls.push(['enable', meta]);
						if (${JSON.stringify(failCode)}) throw Object.assign(new Error('x'), { code: ${JSON.stringify(failCode)} });
						window.__relay.state = 'on'; return 'on';
					},
					async disable() { window.__relay.calls.push(['disable']); window.__relay.state = 'off'; return 'off'; },
					async subscriptionId() { return window.__relay.state === 'on' ? 's_test' : null; }
				};`
		})
	);
}

const calls = (page: Page) =>
	page.evaluate(() => (window as unknown as { __relay: { calls: unknown[][] } }).__relay.calls);

test.describe('알림 설정 (FR-NT)', () => {
	test('화면 규약: 홈으로 올라가고 h1 은 알림', async ({ page }) => {
		await fakeRelay(page);
		await page.goto(NOTIFY);
		await expect(page.locator('h1')).toHaveText('알림');
		await expect(page.locator('[data-up-link="/"]')).toBeVisible();
	});

	test('켜면 meta 를 실어 enable 하고, 끄면 disable 한다', async ({ page }) => {
		await fakeRelay(page);
		await page.goto(NOTIFY);
		await expect(page.locator('[data-push-status]')).toHaveText('상태: 꺼짐');
		await page.locator('[data-push-on]').click();
		await expect(page.locator('[data-push-status]')).toHaveText('상태: 켜짐');

		const enable = (await calls(page)).find((c) => c[0] === 'enable')!;
		const meta = enable[1] as { v: number; tz: string; daily: string; facts: object };
		expect(meta.v).toBe(1);
		expect(meta.daily).toBe('21:00');
		expect(meta.tz).toBeTruthy();
		expect(meta.facts).toEqual({});

		await page.locator('[data-push-off]').click();
		await expect(page.locator('[data-push-status]')).toHaveText('상태: 꺼짐');
		expect((await calls(page)).some((c) => c[0] === 'disable')).toBe(true);
	});

	test('켜진 채 시각을 바꾸면 곧바로 다시 보낸다 (FR-NT-7)', async ({ page }) => {
		await fakeRelay(page);
		await page.goto(NOTIFY);
		await page.locator('[data-push-on]').click();
		await expect(page.locator('[data-push-status]')).toHaveText('상태: 켜짐');
		await page.locator('[data-push-time]').fill('07:15');
		await page.locator('[data-push-time]').dispatchEvent('change');
		await expect
			.poll(async () => (await calls(page)).filter((c) => c[0] === 'enable').map((c) => (c[1] as { daily: string }).daily))
			.toEqual(['21:00', '07:15']);
		expect(await page.evaluate(() => localStorage.getItem('push.daily'))).toBe('07:15');
	});

	test('실패는 같은 자리에 사실 문구로 (FR-NT-5)', async ({ page }) => {
		await fakeRelay(page, 'off', 'origin-not-allowed');
		await page.goto(NOTIFY);
		await expect(page.locator('[data-push-error]')).toBeHidden();
		await page.locator('[data-push-on]').click();
		await expect(page.locator('[data-push-error]')).toHaveText('알림 서버에 이 앱이 등록되어 있지 않습니다');
	});

	test('권한이 거부된 기기는 켤 수 없다', async ({ page }) => {
		await fakeRelay(page, 'denied');
		await page.goto(NOTIFY);
		await expect(page.locator('[data-push-status]')).toHaveText('상태: 권한 거부됨');
		await expect(page.locator('[data-push-on]')).toBeDisabled();
	});

	test('릴레이에 닿지 않으면 꺼짐으로 두고 그렇게 적는다', async ({ page }) => {
		await page.route('**/client.js', (r) => r.abort());
		await page.goto(NOTIFY);
		await expect(page.locator('[data-push-error]')).toHaveText('알림 서버에 닿지 않았습니다');
	});

	test('켜 두었던 기기가 릴레이에서 꺼져 있으면 짐작을 지운다', async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem('push.sentMeta', '{"v":1}'));
		await fakeRelay(page, 'off');
		await page.goto(NOTIFY);
		await expect(page.locator('[data-push-status]')).toHaveText('상태: 꺼짐');
		await expect.poll(() => page.evaluate(() => localStorage.getItem('push.sentMeta'))).toBeNull();
	});

	test('켠 적 없는 기기는 다른 화면에서 릴레이에 닿지 않는다 (FR-MT-5)', async ({ page }) => {
		let hit = false;
		await page.route('**/client.js', (r) => {
			hit = true;
			return r.abort();
		});
		await page.goto('/3x3/bld/3style/corner/quiz');
		await expect(page.locator('h1')).toHaveText('퀴즈');
		await page.waitForTimeout(500);
		expect(hit).toBe(false);
	});

	test('터치 타깃 44px @viewport', async ({ page }) => {
		await fakeRelay(page);
		await page.goto(NOTIFY);
		for (const sel of ['[data-push-on]', '[data-push-off]', '[data-push-time]']) {
			const b = await page.locator(sel).boundingBox();
			expect(b!.height, sel).toBeGreaterThanOrEqual(40);
		}
		for (const sel of ['[data-push-on]', '[data-push-off]']) {
			const b = await page.locator(sel).boundingBox();
			expect(b!.height, sel).toBeGreaterThanOrEqual(44);
		}
	});
});

test.describe('퀴즈를 채점하면 meta 의 lastQuiz 가 바뀐다 (FR-MT-3·4)', () => {
	test('켜 둔 기기는 그날 첫 채점에 한 번 다시 보낸다', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('ui.quizInput', 'direct');
			// 앱이 마지막으로 보낸 meta (lastQuiz 없음)
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			localStorage.setItem('push.sentMeta', JSON.stringify({ v: 1, tz, daily: '21:00', facts: {} }));
		});
		await fakeRelay(page, 'on');
		await page.goto('/3x3/bld/3style/corner/quiz');
		await expect(page.locator('[data-case]')).toBeVisible();

		for (let i = 0; i < 2; i++) {
			await page.locator('[data-move="R"]').click();
			await page.locator('[data-grade]').click();
			await page.locator('[data-next]').click();
		}
		await expect
			.poll(async () => (await calls(page)).filter((c) => c[0] === 'enable').length)
			.toBe(1);
		const meta = (await calls(page)).find((c) => c[0] === 'enable')![1] as { facts: { lastQuiz: string } };
		expect(meta.facts.lastQuiz).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
