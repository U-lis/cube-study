/**
 * 알림이 연 퀴즈 — `?c=` 가 첫 문제다 (#33 · #35 A안, 0.7.0 SPEC FR-QC).
 */
import { test, expect } from '@playwright/test';

const QUIZ = '/3x3/bld/3style/corner/quiz';

test.describe('퀴즈 ?c= (FR-QC)', () => {
	test('그 케이스가 첫 문제다', async ({ page }) => {
		await page.goto(`${QUIZ}?c=KG`);
		await expect(page.locator('[data-case]')).toHaveAttribute('data-case', 'KG');
	});

	test('암기한 것만 출제가 켜져 있고 범위 밖이어도 첫 문제는 그 케이스다 (FR-QC-2)', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('ui.quizInput', 'direct');
			localStorage.setItem('quiz.memorizedOnly', 'true');
			localStorage.setItem(
				'memorize.checked',
				JSON.stringify({ schemaVersion: 1, checked: { setup: [], direct: ['GK'] } })
			);
		});
		await page.goto(`${QUIZ}?c=KG`);
		await expect(page.locator('[data-case]')).toHaveAttribute('data-case', 'KG');

		// 다음 문제부터는 범위(GK 하나)를 따른다
		await page.locator('[data-move="R"]').click();
		await page.locator('[data-grade]').click();
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-case]')).toHaveAttribute('data-case', 'GK');
	});

	test('데이터에 없는 코드는 무시하고 평소대로 낸다 (FR-QC-3)', async ({ page }) => {
		await page.goto(`${QUIZ}?c=ZZ`);
		await expect(page.locator('[data-case]')).toBeVisible();
		await expect(page.locator('[data-case]')).not.toHaveAttribute('data-case', 'ZZ');
	});

	test('서비스워커가 잡은 뒤에도 ?c= 주소가 퀴즈를 연다 — 홈으로 떨어지지 않는다', async ({ page }) => {
		// 0.5.0 사고(ignoreURLParametersMatching)가 injectManifest 로 옮긴 뒤에도 막혀 있는가.
		// SW 는 두 번째 이동에서 제어를 잡는다 — 같은 주소를 두 번 연다.
		await page.goto(`${QUIZ}?c=KG`);
		await page.waitForFunction(
			async () => !!(await navigator.serviceWorker?.getRegistration())?.active,
			undefined,
			{ timeout: 30_000 }
		);
		await page.goto(`${QUIZ}?c=OK`);
		await expect(page.locator('h1')).toHaveText('퀴즈');
		await expect(page.locator('[data-case]')).toHaveAttribute('data-case', 'OK');
	});
});
