/**
 * OP 코너 — 조회 (#18, PHASE_3_TEST).
 *
 * 표의 22행과 Y 행이 맨 위에 있음, 암기 체크 지속성, 원리 설명 접힘을 본다.
 * 데이터 자체의 올바름은 유닛(`tests/unit/op-domain.test.ts`)에서 보고 여기는
 * 화면만 본다.
 */
import { test, expect } from '@playwright/test';

const PATH = '/3x3/bld/op/corner/lookup';

test.describe('OP 조회 (#18)', () => {
	test('표에 22행이 있다', async ({ page }) => {
		await page.goto(PATH);
		await expect(page.locator('[data-op-lookup] tbody tr')).toHaveCount(22);
	});

	test('Y 행이 표 맨 위에 있다', async ({ page }) => {
		await page.goto(PATH);
		const first = page.locator('[data-op-lookup] tbody tr').first();
		await expect(first).toHaveAttribute('data-row-id', 'y');
		await expect(first.locator('[data-letter]')).toHaveText('Y');
	});

	test('암기 체크박스가 리로드 후에도 유지된다', async ({ page }) => {
		await page.goto(PATH);
		const box = page.locator('[data-op-lookup] [data-memorize-input][data-row="b"]');
		await box.check();
		await expect(box).toBeChecked();
		await page.reload();
		await expect(page.locator('[data-op-lookup] [data-memorize-input][data-row="b"]')).toBeChecked();
	});

	test('암기 체크박스의 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto(PATH);
		const label = page.locator('[data-op-lookup] tbody tr').first().locator('.check label');
		const b = (await label.boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		expect(b.width).toBeGreaterThanOrEqual(44);
	});

	test('원리 설명은 기본 접혀 있다', async ({ page }) => {
		await page.goto(PATH);
		const details = page.locator('[data-principle]');
		await expect(details).not.toHaveAttribute('open', '');
		await expect(details.locator('summary')).toHaveText('원리');
	});

	test('원리 설명을 열면 항목이 보인다', async ({ page }) => {
		await page.goto(PATH);
		await page.locator('[data-principle] summary').click();
		const items = page.locator('[data-principle] ul li');
		const count = await items.count();
		expect(count).toBeGreaterThan(0);
	});
});
