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
		for (const path of ['/', '/3x3/bld/3style/corner/algs', '/3x3/bld/3style/corner/quiz']) {
			await page.goto(path);
			await expect(page.locator('[data-about-open]')).toBeVisible();
		}
	});
});

test.describe('업데이트', () => {
	test('정보 모달에서 업데이트를 직접 확인할 수 있다', async ({ page }) => {
		await page.goto('/');
		await page.waitForFunction(
			async () => !!(await navigator.serviceWorker?.getRegistration())?.active,
			undefined,
			{ timeout: 30_000 }
		);
		await page.locator('[data-about-open]').click();
		await page.locator('[data-check-update]').click();
		// 이미 최신이므로 새로고침은 일어나지 않고 결과 문구만 뜬다
		await expect(page.locator('[data-update-message]')).toHaveText('최신 버전입니다');
	});

	test('평소에는 업데이트 토스트가 없다', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-toast]')).toHaveCount(0);
	});
});

test.describe('상단 바 토글', () => {
	/** '시스템' 이라는 글자만 있으면 테마 버튼인 줄 모르고 시스템 정보로 읽힌다. */
	test('테마 버튼이 상태에 따라 다른 아이콘을 보여준다', async ({ page }) => {
		await page.goto('/');
		const toggle = page.locator('[data-theme-toggle]');

		const iconFor = async () => (await toggle.locator('svg').innerHTML()).trim();
		await expect(toggle).toHaveAttribute('data-theme', 'system');
		const system = await iconFor();

		await toggle.click();
		await expect(toggle).toHaveAttribute('data-theme', 'light');
		const light = await iconFor();

		await toggle.click();
		await expect(toggle).toHaveAttribute('data-theme', 'dark');
		const dark = await iconFor();

		expect(new Set([system, light, dark]).size).toBe(3);
		await expect(toggle).toHaveAttribute('aria-label', /테마 전환/);
	});

	test('화면 꺼짐 방지를 켜고 끌 수 있고 상태가 유지된다', async ({ page }) => {
		// 지원하지 않는 브라우저에서는 버튼 자체를 두지 않는다
		await page.goto('/');
		const supported = await page.evaluate(() => 'wakeLock' in navigator);
		test.skip(!supported, 'Screen Wake Lock 미지원');

		const btn = page.locator('[data-wake-lock]');
		await expect(btn).toHaveAttribute('aria-pressed', 'false');

		await btn.click();
		await expect(btn).toHaveAttribute('aria-pressed', 'true');

		await page.reload();
		await expect(page.locator('[data-wake-lock]')).toHaveAttribute('aria-pressed', 'true');

		await page.locator('[data-wake-lock]').click();
		await expect(page.locator('[data-wake-lock]')).toHaveAttribute('aria-pressed', 'false');
	});
});
