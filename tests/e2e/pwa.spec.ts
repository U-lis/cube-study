import { test, expect } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const meta = (data as unknown as { meta: { anchorLearnOrder?: string[] } }).meta;
const anchors = (data as unknown as { anchors: Record<string, unknown> }).anchors;
/** 기준 상세 페이지 하나. 이름을 박아두면 데이터 교체 때 404 를 밟는다. */
const anAnchorPath = `/anchors/${(meta.anchorLearnOrder ?? Object.keys(anchors))[0]}`;

test.describe('PWA (FR-20, NFR-8)', () => {
	test('manifest 가 유효하다', async ({ request }) => {
		const res = await request.get('/manifest.webmanifest');
		expect(res.ok()).toBe(true);
		const m = await res.json();
		expect(m.name).toBe('3-Style Corner Trainer');
		expect(m.display).toBe('standalone');
		expect(m.lang).toBe('ko');
		expect(m.icons.length).toBeGreaterThanOrEqual(3);
		expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
	});

	test('아이콘이 실제로 존재한다', async ({ request }) => {
		for (const p of ['/icon-192.png', '/icon-512.png', '/icon-maskable.png', '/icon.svg']) {
			expect((await request.get(p)).ok()).toBe(true);
		}
	});

	test('외부 도메인 요청이 없다', async ({ page }) => {
		const external: string[] = [];
		page.on('request', (r) => {
			const u = new URL(r.url());
			if (u.host !== 'localhost:4174') external.push(r.url());
		});
		await page.goto('/');
		await page.getByLabel('케이스 코드').fill('LB');
		await expect(page.locator('section.case')).toBeVisible();
		await page.goto('/anchors');
		await page.goto('/quiz');
		expect(external).toEqual([]);
	});

	test('하위 경로로 첫 진입해도 서비스워커가 등록된다', async ({ page }) => {
		const failed: string[] = [];
		page.on('requestfailed', (r) => failed.push(r.url()));
		page.on('response', (r) => {
			if (r.status() === 404) failed.push(`404 ${r.url()}`);
		});
		await page.goto('/anchors');
		await page.waitForFunction(
			async () => !!(await navigator.serviceWorker?.getRegistration())?.active,
			undefined,
			{ timeout: 30_000 }
		);
		expect(failed.filter((u) => u.includes('sw.js'))).toEqual([]);
	});

	test('오프라인에서 조회·브라우저·퀴즈가 동작한다', async ({ page, context }) => {
		await page.goto('/');
		// 첫 로드에서 controller 는 null 이다. registration 이 active 가 될 때까지 기다린 뒤
		// reload 해야 페이지가 서비스워커의 제어를 받는다.
		await page.waitForFunction(
			async () => {
				const reg = await navigator.serviceWorker?.getRegistration();
				return !!reg?.active;
			},
			undefined,
			{ timeout: 30_000 }
		);
		await page.reload();
		await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, {
			timeout: 15_000
		});
		await page.waitForTimeout(1500); // 프리캐시 완료 여유

		await context.setOffline(true);
		await page.reload();
		await expect(page.getByLabel('케이스 코드')).toBeVisible();

		await page.getByLabel('케이스 코드').fill('LB');
		await expect(page.locator('section.case')).toHaveAttribute('data-case', 'LB');

		await page.goto('/anchors');
		await expect(page.locator(`[data-anchor="${anAnchorPath.split('/').pop()}"]`)).toBeVisible();

		await page.goto('/quiz');
		await expect(page.locator('h1[data-case]')).toBeVisible();
		await page.locator('[data-move="R"]').click();
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict]')).toBeVisible();

		await context.setOffline(false);
	});
});

test.describe('테마 (FR-21)', () => {
	test('시스템 다크 설정을 따른다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg).toBe('rgb(17, 17, 19)');
	});

	test('시스템 라이트 설정을 따른다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/');
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg).toBe('rgb(255, 255, 255)');
	});

	test('수동 선택이 시스템 설정을 이기고 새로고침 후에도 유지된다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		const toggle = page.locator('[data-theme-toggle]');

		// system -> light
		await toggle.click();
		await expect(toggle).toHaveAttribute('data-theme', 'light');
		expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
			'rgb(255, 255, 255)'
		);

		await page.reload();
		await expect(toggle).toHaveAttribute('data-theme', 'light');
		expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
			'rgb(255, 255, 255)'
		);
	});

	test('FOUC 없음: 초기 렌더부터 저장된 테마가 적용된다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/');
		await page.locator('[data-theme-toggle]').click(); // light 고정
		await page.reload();
		// 문서 파싱 직후 data-theme 이 이미 붙어 있어야 한다
		const attr = await page.evaluate(() => document.documentElement.dataset.theme);
		expect(attr).toBe('light');
	});

	test('양 테마에서 insert/interchange 색이 배경과 충분히 대비된다', async ({ page }) => {
		for (const scheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto('/?c=CI');
			const seg = page.locator('[data-toggle="mode"]');
			await seg.locator('[data-option="direct"]').click();
			await expect(seg).toHaveAttribute('data-value', 'direct');
			await expect(page.locator('.main .alg .insert').first()).toBeVisible();
			await expect(page.locator('.main .alg .interchange').first()).toBeVisible();

			const ratios = await page.evaluate(() => {
				const parse = (s: string) => s.match(/\d+/g)!.map(Number).slice(0, 3);
				const lum = ([r, g, b]: number[]) => {
					const f = (c: number) => {
						const x = c / 255;
						return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
					};
					return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
				};
				const bg = lum(parse(getComputedStyle(document.body).backgroundColor));
				return ['insert', 'interchange'].map((cls) => {
					const el = document.querySelector(`.main .alg .${cls}`)!;
					const fg = lum(parse(getComputedStyle(el).color));
					const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
					return (hi + 0.05) / (lo + 0.05);
				});
			});

			for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
		}
	});
});

test.describe('반응형 (FR-22)', () => {
	test('모바일에서 가로 스크롤이 없다', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		for (const path of ['/', '/?c=CU', '/anchors', anAnchorPath, '/quiz']) {
			await page.goto(path);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			expect(overflow, `가로 스크롤 발생: ${path}`).toBe(false);
		}
	});

	test('스크롤해도 입력 필드가 화면 상단에 남는다', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/?c=CU'); // 내용이 긴 케이스
		const input = page.getByLabel('케이스 코드');

		await page.mouse.wheel(0, 1200);
		await page.waitForTimeout(300);

		const box = (await input.boundingBox())!;
		// 스크롤 후에도 뷰포트 상단 영역에 보여야 한다
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(80);
		await expect(input).toBeInViewport();
	});

	test('모바일에서 무브 버튼 18개가 모두 보인다', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/quiz');
		const btns = page.locator('[data-move]');
		await expect(btns).toHaveCount(18);
		for (let i = 0; i < 18; i++) await expect(btns.nth(i)).toBeVisible();
	});

	test('데스크탑에서 최대 폭이 유지된다', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/');
		const w = await page.evaluate(
			() => document.querySelector('.shell')!.getBoundingClientRect().width
		);
		expect(w).toBeLessThanOrEqual(720);
	});
});
