import { test, expect } from '@playwright/test';
import pkg from '../../package.json' with { type: 'json' };
import type { Page } from '@playwright/test';

/** 정보는 서랍 안에 있다 (#42). */
async function openAbout(page: Page) {
	await page.locator('[data-drawer-open]').click();
	await page.locator('[data-about-open]').click();
}

test.describe('앱 정보 (About)', () => {
	test('정보 버튼을 누르면 모달이 열린다', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-about]')).not.toBeVisible();
		await openAbout(page);
		await expect(page.locator('[data-about]')).toBeVisible();
		// 서랍은 닫히고 정보 모달만 남는다
		await expect(page.locator('[data-drawer]')).not.toBeVisible();
	});

	test('앱 이름·제작자·버전·커밋이 표시된다', async ({ page }) => {
		await page.goto('/');
		await openAbout(page);
		await expect(page.locator('[data-info="이름"]')).toHaveText('CubeStudy');
		await expect(page.locator('[data-info="제작자"]')).toHaveText('ulismoon');
		await expect(page.locator('[data-info="버전"]')).toHaveText(pkg.version);
		await expect(page.locator('[data-info="커밋"]')).toHaveText(/^[0-9a-f]{8}$|^unknown$/);
	});

	test('표시 버전이 package.json 과 어긋나지 않는다', async ({ page }) => {
		// 버전의 정본은 package.json 하나다. 하드코딩이 생기면 여기서 걸린다.
		await page.goto('/');
		await openAbout(page);
		const shown = await page.locator('[data-info="버전"]').innerText();
		expect(shown).toBe(pkg.version);
	});

	test('닫기 버튼과 ESC 로 닫힌다', async ({ page }) => {
		await page.goto('/');
		await openAbout(page);
		await page.locator('[data-about-close]').click();
		await expect(page.locator('[data-about]')).not.toBeVisible();

		await openAbout(page);
		await expect(page.locator('[data-about]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-about]')).not.toBeVisible();
	});

	test('모든 페이지에서 접근 가능하다', async ({ page }) => {
		for (const path of ['/', '/3x3/bld/3style/corner/algs', '/3x3/bld/3style/corner/quiz', '/settings/notify']) {
			await page.goto(path);
			await page.locator('[data-drawer-open]').click();
			await expect(page.locator('[data-about-open]'), path).toBeVisible();
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
		await openAbout(page);
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
	/**
	 * 테마는 서랍 안의 한 줄이다 (#42). 이름("테마")과 지금 값이 같은 줄에 글자로 선다 —
	 * 0.6.0 까지 바의 버튼은 '시스템' 글자만으로는 테마 버튼인 줄 몰라 아이콘이 상태를 맡았다.
	 */
	test('테마 줄이 이름과 지금 값을 글자로 보여주고 누르면 순환한다', async ({ page }) => {
		await page.goto('/');
		await page.locator('[data-drawer-open]').click();
		const toggle = page.locator('[data-theme-toggle]');
		const value = page.locator('[data-drawer-value="테마"]');

		await expect(toggle).toContainText('테마');
		await expect(toggle).toHaveAttribute('data-theme', 'system');
		await expect(value).toHaveText('시스템');

		await toggle.click();
		await expect(toggle).toHaveAttribute('data-theme', 'light');
		await expect(value).toHaveText('라이트');

		await toggle.click();
		await expect(value).toHaveText('다크');
		// 누른 뒤에도 서랍은 열려 있다 — 결과를 그 자리에서 본다
		await expect(page.locator('[data-drawer]')).toBeVisible();
		await expect(toggle).toHaveAttribute('aria-label', /테마 전환/);
	});

	test('상단 바에는 메뉴와 화면 켜기만 있다 (#42)', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.bar [data-drawer-open]')).toBeVisible();
		await expect(page.locator('.bar [data-theme-toggle]')).toHaveCount(0);
		await expect(page.locator('.bar [data-about-open]')).toHaveCount(0);
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
