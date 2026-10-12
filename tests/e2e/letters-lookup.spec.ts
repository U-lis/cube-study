/**
 * 스티커 문자 — 외우기 (#19, PHASE_3_TEST).
 *
 * 캔버스 픽셀을 세지 않는다. `Cube3D` 의 시험 훅(`data-labels` · `data-colored`)으로
 * 무엇을 칠하고 무엇을 찍었는지 본다 (GLOBAL AD-LT-14).
 */
import { test, expect } from '@playwright/test';

const PATH = '/3x3/bld/letters/lookup';
const canvas = 'canvas[data-cube3d]';

test.describe('외우기 화면 (#19)', () => {
	test('기준 방향을 글자로 적는다', async ({ page }) => {
		await page.goto(PATH);
		await expect(page.locator('[data-reference]')).toHaveText('기준: 위 흰색 · 앞 초록');
	});

	test('고른 종류의 24칸에 문자를 찍는다', async ({ page }) => {
		await page.goto(PATH);
		await page.locator('[data-toggle="letters-kind"] [data-option="corner"]').click();
		await expect(page.locator(canvas)).toHaveAttribute('data-labels', '24');
		await page.locator('[data-toggle="letters-kind"] [data-option="edge"]').click();
		await expect(page.locator(canvas)).toHaveAttribute('data-labels', '24');
	});

	test('다른 조각 회색이면 센터와 고른 종류만 색이다', async ({ page }) => {
		await page.goto(PATH);
		await page.locator('[data-toggle="letters-others"] [data-option="gray"]').click();
		await expect(page.locator(canvas)).toHaveAttribute('data-colored', '30');
		await page.locator('[data-toggle="letters-others"] [data-option="color"]').click();
		await expect(page.locator(canvas)).toHaveAttribute('data-colored', '54');
	});

	test('원위치 버튼은 44px 이상이고 눌러도 오류가 없다 @viewport', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(PATH);
		const reset = page.locator('[data-reset]');
		expect((await reset.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		const box = (await page.locator(canvas).boundingBox())!;
		// 한참 돌린 다음 원위치
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2, { steps: 8 });
		await page.mouse.up();
		await reset.click();
		expect(errors).toEqual([]);
	});

	test('설정이 새로고침 뒤에도 남는다', async ({ page }) => {
		await page.goto(PATH);
		await page.locator('[data-toggle="letters-kind"] [data-option="edge"]').click();
		await page.locator('[data-toggle="letters-others"] [data-option="color"]').click();
		await page.reload();
		await expect(page.locator('[data-toggle="letters-kind"]')).toHaveAttribute('data-value', 'edge');
		await expect(page.locator('[data-toggle="letters-others"]')).toHaveAttribute('data-value', 'color');
	});
});
