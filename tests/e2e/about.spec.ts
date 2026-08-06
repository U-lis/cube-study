import { test, expect } from '@playwright/test';
import pkg from '../../package.json' with { type: 'json' };

test.describe('앱 정보 (About)', () => {
	test('정보 버튼을 누르면 모달이 열린다', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-about]')).not.toBeVisible();
		await page.locator('[data-about-open]').click();
		await expect(page.locator('[data-about]')).toBeVisible();
	});

	test('앱 이름·제작자·버전·커밋이 표시된다', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-about-open]').click();
		await expect(page.locator('[data-info="이름"]')).toHaveText('CubeStudy');
		await expect(page.locator('[data-info="제작자"]')).toHaveText('ulismoon');
		await expect(page.locator('[data-info="버전"]')).toHaveText(pkg.version);
		await expect(page.locator('[data-info="커밋"]')).toHaveText(/^[0-9a-f]{8}$|^unknown$/);
	});

	test('표시 버전이 package.json 과 어긋나지 않는다', async ({ page }) => {
		// 버전의 정본은 package.json 하나다. 하드코딩이 생기면 여기서 걸린다.
		await page.goto('/');
		await page.locator('[data-about-open]').click();
		const shown = await page.locator('[data-info="버전"]').innerText();
		expect(shown).toBe(pkg.version);
	});

	test('닫기 버튼과 ESC 로 닫힌다', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-about-open]').click();
		await page.locator('[data-about-close]').click();
		await expect(page.locator('[data-about]')).not.toBeVisible();

		await page.locator('[data-about-open]').click();
		await expect(page.locator('[data-about]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-about]')).not.toBeVisible();
	});

	test('모든 페이지에서 접근 가능하다', async ({ page }) => {
		for (const path of ['/', '/anchors', '/quiz']) {
			await page.goto(path);
			await expect(page.locator('[data-about-open]')).toBeVisible();
		}
	});
});
