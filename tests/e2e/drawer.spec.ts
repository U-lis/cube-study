/**
 * 서랍 메뉴 (#42, 0.7.0 SPEC FR-DR).
 */
import { test, expect } from '@playwright/test';

const QUIZ = '/3x3/bld/3style/corner/quiz';
const CORNER = '/3x3/bld/3style/corner';
const LETTERS = '/3x3/bld/letters';
const M2_EDGE = '/3x3/bld/m2/edge';
const OP_CORNER = '/3x3/bld/op/corner';

test.describe('서랍 (FR-DR)', () => {
	test('메뉴 버튼으로 열고 닫기 버튼 · ESC 로 닫는다', async ({ page }) => {
		await page.goto('/');
		const drawer = page.locator('[data-drawer]');
		await expect(drawer).not.toBeVisible();
		await page.locator('[data-drawer-open]').click();
		await expect(drawer).toBeVisible();
		await page.locator('[data-drawer-close]').click();
		await expect(drawer).not.toBeVisible();

		await page.locator('[data-drawer-open]').click();
		await page.keyboard.press('Escape');
		await expect(drawer).not.toBeVisible();
	});

	test('지금 화면이 든 묶음만 펼쳐진 채로 열린다 (FR-DR-5)', async ({ page }) => {
		await page.goto(QUIZ);
		await page.locator('[data-drawer-open]').click();
		await expect(page.locator(`[data-drawer-group="${CORNER}"]`)).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator(`[data-drawer-group="${LETTERS}"]`)).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator(`[data-drawer-panel="${CORNER}"]`)).toBeVisible();
		await expect(page.locator(`[data-drawer-panel="${LETTERS}"]`)).toBeHidden();
	});

	test('접힌 묶음의 항목도 DOM 에 있다 — 접기는 CSS 다 (FR-DR-11)', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator(`[data-drawer-link="${LETTERS}/quiz"]`)).toHaveCount(1);
		await expect(page.locator(`[data-drawer-link="${CORNER}/algs"]`)).toHaveCount(1);
		await expect(page.locator(`[data-drawer-link="${M2_EDGE}/lookup"]`)).toHaveCount(1);
	});

	test('M2 엣지 묶음이 서랍에 있고 조회·퀴즈 둘을 담는다 (#17)', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		await expect(page.locator(`[data-drawer-group="${M2_EDGE}"]`)).toBeVisible();
		await page.locator(`[data-drawer-group="${M2_EDGE}"]`).click();
		await expect(page.locator(`[data-drawer-link="${M2_EDGE}/lookup"]`)).toHaveText('조회');
		await expect(page.locator(`[data-drawer-link="${M2_EDGE}/quiz"]`)).toHaveText('퀴즈');
	});

	test('OP 코너 묶음이 서랍에 있고 조회·퀴즈 둘을 담는다 (#18)', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		await expect(page.locator(`[data-drawer-group="${OP_CORNER}"]`)).toBeVisible();
		await page.locator(`[data-drawer-group="${OP_CORNER}"]`).click();
		await expect(page.locator(`[data-drawer-link="${OP_CORNER}/lookup"]`)).toHaveText('조회');
		await expect(page.locator(`[data-drawer-link="${OP_CORNER}/quiz"]`)).toHaveText('퀴즈');
	});

	test('묶음 머리를 누르면 펼치고 다시 누르면 접는다', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		const head = page.locator(`[data-drawer-group="${LETTERS}"]`);
		await expect(head).toHaveAttribute('aria-expanded', 'false');
		await head.click();
		await expect(head).toHaveAttribute('aria-expanded', 'true');
		await expect(page.locator(`[data-drawer-link="${LETTERS}/lookup"]`)).toHaveText('외우기');
		await head.click();
		await expect(page.locator(`[data-drawer-panel="${LETTERS}"]`)).toBeHidden();
	});

	test('지금 화면은 글자로도 표시된다 (FR-DR-7)', async ({ page }) => {
		await page.goto(`${CORNER}/algs/GC`);
		await page.locator('[data-drawer-open]').click();
		const cur = page.locator(`[data-drawer-link="${CORNER}/algs"]`);
		await expect(cur).toHaveAttribute('aria-current', 'page');
		await expect(cur).toContainText('지금 화면');
		await expect(page.locator('[data-drawer] [aria-current="page"]')).toHaveCount(1);
	});

	test('항목을 누르면 그 화면으로 가고 서랍이 닫힌다', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		await page.locator('[data-drawer-link="/3x3/bld/trace"]').click();
		await expect(page).toHaveURL(/\/3x3\/bld\/trace$/);
		await expect(page.locator('[data-drawer]')).not.toBeVisible();
	});

	test('설정 묶음: 알림은 설정 화면으로, 값은 꺼짐', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		await expect(page.locator('[data-drawer-value="알림"]')).toHaveText('꺼짐');
		await page.locator('[data-drawer-link="/settings/notify"]').click();
		await expect(page.locator('h1')).toHaveText('알림');
	});

	test('켜 둔 기기는 알림 값에 시각이 나온다', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('push.daily', '07:30');
			localStorage.setItem('push.sentMeta', '{"v":1}');
		});
		// 동기화가 릴레이에 닿지 않게 막는다 — 값 표시는 짐작만 본다
		await page.route('**/client.js', (r) => r.abort());
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		await expect(page.locator('[data-drawer-value="알림"]')).toHaveText('매일 07:30');
	});

	test('서랍 항목은 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto(QUIZ);
		await expect(page.locator('[data-drawer-open]')).toBeVisible();
		const open = await page.locator('[data-drawer-open]').boundingBox();
		expect(open!.height).toBeGreaterThanOrEqual(44);
		expect(open!.width).toBeGreaterThanOrEqual(44);
		await page.locator('[data-drawer-open]').click();
		const rows = page.locator('[data-drawer] .row:visible');
		const n = await rows.count();
		expect(n).toBeGreaterThan(5);
		for (let i = 0; i < n; i++) {
			const b = await rows.nth(i).boundingBox();
			expect(b!.height, await rows.nth(i).innerText()).toBeGreaterThanOrEqual(44);
		}
	});
});
