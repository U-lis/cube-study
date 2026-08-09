import { test, expect } from '@playwright/test';

/**
 * 기준 상세의 머리(기준공식·진도·토글·열 머리글)를 상단에 고정한다.
 *
 * 이 화면은 기준을 보며 셋업을 익히는 화면이다. 목록을 훑는 동안 기준이
 * 화면 밖으로 나가면 각 줄의 셋업이 무엇에 붙는 셋업인지 알 수 없어
 * 매번 위로 올라가 확인하게 된다.
 */
test.describe('기준 상세 고정 머리', () => {
	test('한참 스크롤해도 기준공식이 화면 위에 남는다', async ({ page }) => {
		await page.goto('/anchors/IV');
		await page.waitForSelector('[data-case-row]');

		await page.mouse.wheel(0, 1200);
		// 스크롤이 실제로 먹었는지부터 확인한다 — 안 먹으면 아래 단언이 공짜로 통과한다
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

		const head = page.locator('[data-anchor-head]');
		const box = await head.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.y).toBeCloseTo(0, 0);

		// 기준공식 무브열이 실제로 보이는지. 상자만 붙어 있고 내용이 비면 의미가 없다
		await expect(page.locator('[data-anchor-head] .anchor')).toBeInViewport();
	});

	test('고정 머리가 아래쪽 줄의 체크박스와 링크를 가리지 않는다', async ({ page }) => {
		await page.goto('/anchors/IV');
		const rows = page.locator('[data-case-row]');
		const n = await rows.count();
		expect(n).toBeGreaterThan(10);

		// 고정 머리 밑을 지나야 닿는 위치. 가려지면 클릭이 가로채여 타임아웃난다
		const box = rows.nth(n - 1).locator('[data-memorize-input]');
		await box.click({ timeout: 5000 });
		await expect(box).toBeChecked();

		const last = rows.nth(n - 1);
		const code = await last.locator('.code').innerText();
		await last.locator('a').click({ timeout: 5000 });
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);
	});

	test('낮은 화면에서는 고정하지 않는다', async ({ page }) => {
		// 가로 방향 폰. 머리가 280px 남짓이라 고정하면 목록이 서너 줄만 남는다
		await page.setViewportSize({ width: 740, height: 420 });
		await page.goto('/anchors/IV');
		await page.waitForSelector('[data-case-row]');

		await page.mouse.wheel(0, 1200);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

		const box = await page.locator('[data-anchor-head]').boundingBox();
		// 고정이 아니므로 함께 밀려 올라가 화면 위로 사라진다
		expect(box!.y).toBeLessThan(0);
	});
});
