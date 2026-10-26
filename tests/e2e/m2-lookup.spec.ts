/**
 * M2 엣지 — 조회 (#17, PHASE_2_TEST).
 *
 * 표의 27행과 암기 체크의 지속성, 그리고 원리 설명 접힘을 본다. 데이터 자체의
 * 올바름은 유닛(`tests/unit/m2-domain.test.ts`)에서 보고 여기는 화면만 본다.
 */
import { test, expect } from '@playwright/test';

const PATH = '/3x3/bld/m2/edge/lookup';

test.describe('M2 조회 (#17)', () => {
	test('표에 27행이 있다', async ({ page }) => {
		await page.goto(PATH);
		await expect(page.locator('[data-m2-lookup] tbody tr')).toHaveCount(27);
	});

	test('마지막 줄은 패리티다', async ({ page }) => {
		await page.goto(PATH);
		const last = page.locator('[data-m2-lookup] tbody tr').last();
		await expect(last).toHaveAttribute('data-order', 'parity');
		await expect(last.locator('[data-order-text]')).toHaveText('패리티');
	});

	test('M 슬라이스 짝수 번째 행이 홀수 번째와 자리를 가지고 서 있다', async ({ page }) => {
		await page.goto(PATH);
		// c (홀수 번째) 와 c2 (짝수 번째) 가 각각 자기 자리에 있다.
		await expect(page.locator('[data-m2-lookup] [data-row-id="c"] [data-order-text]')).toHaveText('홀수 번째');
		await expect(page.locator('[data-m2-lookup] [data-row-id="c2"] [data-order-text]')).toHaveText('짝수 번째');
	});

	test('A·Q 는 순번 문구가 비어 있다 (짝이 버퍼라 순번과 무관하다)', async ({ page }) => {
		// 데이터가 null 로 둔 줄은 코드도 null 로 둔다 — M 슬라이스 공식이 아니므로
		// 짝수/홀수 라벨이 없다 (SPEC FR-M2-D-5, AD-9).
		await page.goto(PATH);
		await expect(page.locator('[data-m2-lookup] [data-row-id="a"] [data-order-text]')).toHaveText('');
		await expect(page.locator('[data-m2-lookup] [data-row-id="q"] [data-order-text]')).toHaveText('');
	});

	test('암기 체크박스가 리로드 후에도 유지된다', async ({ page }) => {
		await page.goto(PATH);
		const box = page.locator('[data-m2-lookup] [data-memorize-input][data-row="c2"]');
		await box.check();
		await expect(box).toBeChecked();
		await page.reload();
		await expect(page.locator('[data-m2-lookup] [data-memorize-input][data-row="c2"]')).toBeChecked();
	});

	test('암기 체크박스의 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto(PATH);
		const label = page.locator('[data-m2-lookup] tbody tr').first().locator('.check label');
		const b = (await label.boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		expect(b.width).toBeGreaterThanOrEqual(44);
	});

	test('원리 설명은 기본 접혀 있다', async ({ page }) => {
		await page.goto(PATH);
		const details = page.locator('[data-principle]');
		await expect(details).not.toHaveAttribute('open', '');
		// summary 는 보이지만 본문은 접혀 있다.
		await expect(details.locator('summary')).toHaveText('원리');
	});

	test('원리 설명을 열면 7개 항목이 나온다', async ({ page }) => {
		await page.goto(PATH);
		await page.locator('[data-principle] summary').click();
		await expect(page.locator('[data-principle] ul li')).toHaveCount(7);
	});
});
