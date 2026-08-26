import { test, expect } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const meta = (data as unknown as { meta: { anchorLearnOrder?: string[] } }).meta;
const anchors = (data as unknown as { anchors: Record<string, unknown> }).anchors;
/** 기준 상세 페이지 하나. 이름을 박아두면 데이터 교체 때 404 를 밟는다. */
const anAnchorPath = `/3x3/bld/3style/corner/algs/${(meta.anchorLearnOrder ?? Object.keys(anchors))[0]}`;

test.describe('PWA (FR-20, NFR-8)', () => {
	test('manifest 가 유효하다', async ({ request }) => {
		const res = await request.get('/manifest.webmanifest');
		expect(res.ok()).toBe(true);
		const m = await res.json();
		// 홈 화면 라벨은 short_name 이다. 정보 모달의 앱 이름과 같아야 한다.
		expect(m.name).toBe('CubeStudy');
		expect(m.short_name).toBe('CubeStudy');
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

	/**
	 * manifest 파일이 있어도 HTML 이 가리키지 않으면 브라우저는 읽지 않는다.
	 * SvelteKit 이 app.html 을 제어해 vite-pwa 가 이 링크를 주입하지 못하므로
	 * +layout.svelte 가 직접 넣는다. 빠지면 설치가 통째로 불가능해진다.
	 */
	test('모든 페이지가 manifest 를 링크한다', async ({ page }) => {
		for (const path of ['/', '/3x3/bld/3style/corner/quiz', '/3x3/bld/3style/corner/algs', anAnchorPath]) {
			await page.goto(path);
			const href = await page
				.locator('link[rel="manifest"]')
				.first()
				.getAttribute('href', { timeout: 5000 });
			expect(href, `manifest 링크 없음: ${path}`).toBe('/manifest.webmanifest');
		}
	});

	test('설치 조건을 만족한다', async ({ page, request }) => {
		await page.goto('/3x3/bld/3style/corner/lookup');
		const href = await page.locator('link[rel="manifest"]').first().getAttribute('href');
		const m = await (await request.get(href!)).json();

		// 크롬 설치 조건: name, start_url, display, 192/512 아이콘, 그리고 fetch 를
		// 처리하는 서비스워커. 하나라도 빠지면 설치 프롬프트가 뜨지 않는다.
		expect(m.name || m.short_name).toBeTruthy();
		expect(m.start_url).toBeTruthy();
		expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(m.display);
		for (const size of ['192x192', '512x512']) {
			const icon = m.icons.find(
				(i: { sizes: string; purpose?: string }) =>
					i.sizes === size && (i.purpose ?? 'any').split(' ').includes('any')
			);
			expect(icon, `${size} any 아이콘 없음`).toBeTruthy();
			expect((await request.get(icon.src)).ok()).toBe(true);
		}

		await page.waitForFunction(
			async () => !!(await navigator.serviceWorker?.getRegistration())?.active,
			undefined,
			{ timeout: 30_000 }
		);
	});

	test('외부 도메인 요청이 없다', async ({ page }) => {
		const external: string[] = [];
		page.on('request', (r) => {
			const u = new URL(r.url());
			if (u.host !== 'localhost:4174') external.push(r.url());
		});
		await page.goto('/3x3/bld/3style/corner/lookup');
		await page.getByLabel('케이스 코드').fill('LB');
		await expect(page.locator('section.case')).toBeVisible();
		await page.goto('/3x3/bld/3style/corner/algs');
		await page.goto('/3x3/bld/3style/corner/quiz');
		expect(external).toEqual([]);
	});

	test('하위 경로로 첫 진입해도 서비스워커가 등록된다', async ({ page }) => {
		const failed: string[] = [];
		page.on('requestfailed', (r) => failed.push(r.url()));
		page.on('response', (r) => {
			if (r.status() === 404) failed.push(`404 ${r.url()}`);
		});
		await page.goto('/3x3/bld/3style/corner/algs');
		await page.waitForFunction(
			async () => !!(await navigator.serviceWorker?.getRegistration())?.active,
			undefined,
			{ timeout: 30_000 }
		);
		expect(failed.filter((u) => u.includes('sw.js'))).toEqual([]);
	});

	test('오프라인에서 조회·브라우저·퀴즈가 동작한다', async ({ page, context }) => {
		await page.goto('/3x3/bld/3style/corner/lookup');
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

		await page.goto('/3x3/bld/3style/corner/algs');
		await expect(page.locator(`[data-anchor="${anAnchorPath.split('/').pop()}"]`)).toBeVisible();

		await page.goto('/3x3/bld/3style/corner/quiz');
		await expect(page.locator('[data-case]')).toBeVisible();
		await page.locator('[data-move="R"]').click();
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict]')).toBeVisible();

		await context.setOffline(false);
	});
});

test.describe('테마 (FR-21)', () => {
	test('시스템 다크 설정을 따른다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/3x3/bld/3style/corner/lookup');
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg).toBe('rgb(17, 17, 19)');
	});

	test('시스템 라이트 설정을 따른다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('/3x3/bld/3style/corner/lookup');
		const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		expect(bg).toBe('rgb(255, 255, 255)');
	});

	test('수동 선택이 시스템 설정을 이기고 새로고침 후에도 유지된다', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.goto('/3x3/bld/3style/corner/lookup');
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
		await page.goto('/3x3/bld/3style/corner/lookup');
		await page.locator('[data-theme-toggle]').click(); // light 고정
		await page.reload();
		// 문서 파싱 직후 data-theme 이 이미 붙어 있어야 한다
		const attr = await page.evaluate(() => document.documentElement.dataset.theme);
		expect(attr).toBe('light');
	});

	test('양 테마에서 insert/interchange 색이 배경과 충분히 대비된다', async ({ page }) => {
		for (const scheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto('/3x3/bld/3style/corner/lookup?c=CI');
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
	test('모바일에서 가로 스크롤이 없다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		for (const path of ['/', '/3x3/bld/3style/corner/lookup?c=CU', '/3x3/bld/3style/corner/algs', anAnchorPath, '/3x3/bld/3style/corner/quiz']) {
			await page.goto(path);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > document.documentElement.clientWidth
			);
			expect(overflow, `가로 스크롤 발생: ${path}`).toBe(false);
		}
	});

	test('스크롤해도 입력 필드가 화면 상단에 남는다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/3x3/bld/3style/corner/lookup?c=CU'); // 내용이 긴 케이스
		const input = page.getByLabel('케이스 코드');
		// 데이터셋이 붙어 결과 카드가 서야 문서가 스크롤될 길이가 된다.
		await expect(page.locator('section.case')).toBeVisible();

		/*
		 * `mouse.wheel` 이 아니라 `scrollTo` 로 민다. 휠은 이 환경에서 문서를 안 움직일
		 * 때가 있고, 그러면 **스크롤을 안 한 채로 "상단에 있다" 를 확인** 하게 된다 —
		 * 통과하든 실패하든 sticky 와 무관한 답이다. 그래서 실제로 밀렸는지를 먼저 못
		 * 박는다.
		 */
		await page.evaluate(() => window.scrollTo(0, 2000));
		await page.waitForTimeout(200);
		const scrolled = await page.evaluate(() => window.scrollY);
		expect(scrolled, '문서가 안 밀리면 sticky 를 잴 수 없다').toBeGreaterThan(0);

		const box = (await input.boundingBox())!;
		// 되돌아가기 링크(FR-NAV-7)는 함께 밀려 올라가고 입력만 붙어 남는다.
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(24);
		await expect(input).toBeInViewport();
	});

	test('모바일에서 무브 버튼 18개가 모두 보인다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/3x3/bld/3style/corner/quiz');
		const btns = page.locator('[data-move]');
		await expect(btns).toHaveCount(18);
		for (let i = 0; i < 18; i++) await expect(btns.nth(i)).toBeVisible();
	});

	test('데스크탑에서 최대 폭이 유지된다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/3x3/bld/3style/corner/lookup');
		const w = await page.evaluate(
			() => document.querySelector('.shell')!.getBoundingClientRect().width
		);
		expect(w).toBeLessThanOrEqual(720);
	});
});

/**
 * 뒤로가기는 설치된 앱에서만 가로챈다.
 *
 * Playwright 는 standalone 으로 띄울 수 없으므로 matchMedia 를 갈아끼워 흉내낸다.
 * 앱이 보는 신호가 그것뿐이라 이 정도면 실제 경로를 그대로 지난다.
 */
const asStandalone = (page: import('@playwright/test').Page) =>
	page.addInitScript(() => {
		const orig = window.matchMedia.bind(window);
		window.matchMedia = ((q: string) =>
			q.includes('display-mode: standalone')
				? ({
						matches: true,
						media: q,
						onchange: null,
						addEventListener() {},
						removeEventListener() {},
						addListener() {},
						removeListener() {},
						dispatchEvent: () => false
					} as MediaQueryList)
				: orig(q)) as typeof window.matchMedia;
	});

/** 가드가 켜질 때까지 기다린다. */
const armed = (page: import('@playwright/test').Page) =>
	page.locator('[data-back-guard="true"]').waitFor({ timeout: 10_000 });

/**
 * 감시 항목이 실제로 심어질 때까지 기다린다. 가드가 켜진 것만으로는 부족하다 —
 * 심기가 실패했는데 뒤로가면 예고 없이 사이트를 떠난다.
 */
const planted = async (page: import('@playwright/test').Page) => {
	await armed(page);
	await page.locator('[data-back-planted="true"]').waitFor({ timeout: 10_000 });
};

test.describe('뒤로가기 (설치된 앱)', () => {
	test('탭을 옮겨도 히스토리가 쌓이지 않는다', async ({ page }) => {
		await asStandalone(page);
		await page.goto('/3x3/bld/3style/corner/lookup');
		await armed(page);
		const before = await page.evaluate(() => history.length);

		for (const label of ['기준공식', '퀴즈', '조회', '기준공식']) {
			await page.locator(`nav a:text-is("${label}")`).click();
			await expect(page.locator('nav a.on')).toHaveText(label);
		}

		expect(await page.evaluate(() => history.length)).toBe(before);
	});

	test('케이스 링크를 따라가도 히스토리가 쌓이지 않는다', async ({ page }) => {
		await asStandalone(page);
		await page.goto('/3x3/bld/3style/corner/algs');
		await armed(page);
		const before = await page.evaluate(() => history.length);

		await page.locator('[data-anchor]').first().click();
		await page.locator('a[href^="/3x3/bld/3style/corner/lookup?c="]').first().click();
		await expect(page.locator('section.case')).toBeVisible();

		expect(await page.evaluate(() => history.length)).toBe(before);
	});

	test('한 번 누르면 예고만 하고 화면이 남는다', async ({ page }) => {
		await asStandalone(page);
		await page.goto('/3x3/bld/3style/corner/quiz');
		await armed(page);
		await expect(page.locator('[data-case]')).toBeVisible();

		await page.goBack();

		await expect(page.locator('[data-toast]')).toHaveText('한 번 더 누르면 닫힙니다');
		// 이전 화면으로 이동하지 않는다 — 뒤로가기는 닫기만 뜻한다
		await expect(page.locator('[data-case]')).toBeVisible();
	});

	/**
	 * 콜드 스타트. 아무 이동 없이 누른 첫 뒤로가기에도 예고가 떠야 한다.
	 *
	 * 주의: 실기기에서 났던 실패(라우터 초기화 전이라 심기가 예외를 던지는 것)를
	 * 이 환경에서는 재현하지 못한다. 여기서는 첫 pushState 가 늘 성공한다.
	 * 이 테스트는 "심기 전에 뒤로가면 그냥 닫힌다" 는 성질만 지킨다.
	 */
	test('켠 직후 아무 이동 없이 눌러도 예고가 뜬다', async ({ page }) => {
		await asStandalone(page);
		await page.goto('/3x3/bld/3style/corner/lookup');
		await planted(page);

		await page.goBack();

		await expect(page.locator('[data-toast]')).toHaveText('한 번 더 누르면 닫힙니다');
		await expect(page.getByLabel('케이스 코드')).toBeVisible();
	});

	/**
	 * 뒤로가기로 나갔다가 안드로이드가 페이지를 메모리에서 복구하면 하이드레이션도
	 * afterNavigate 도 다시 일어나지 않는다. 감시 항목이 없는 채로 켜져 첫 뒤로가기가
	 * 예고 없이 앱을 닫았다. 화면에 돌아오는 신호로 다시 심는다.
	 */
	test('메모리에서 복구되어도 감시 항목이 다시 심어진다', async ({ page }) => {
		await asStandalone(page);
		await page.goto('/3x3/bld/3style/corner/lookup');
		await planted(page);

		// 뒤로가기로 나가는 상황: 감시 항목이 소모된다.
		// 복구 신호를 곧바로 준다 — 예고가 만료되어 저절로 다시 심어지기 전에
		// 확인해야 복구 처리가 실제로 일했는지 알 수 있다.
		await page.goBack();
		await expect(page.locator('[data-back-planted="false"]')).toBeVisible();

		await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
		await expect(page.locator('[data-back-planted="true"]')).toBeVisible({ timeout: 400 });
	});

	test('예고는 잠시 뒤 사라진다', async ({ page }) => {
		await asStandalone(page);
		await page.goto('/3x3/bld/3style/corner/lookup');
		await armed(page);
		await page.goBack();
		await expect(page.locator('[data-toast]')).toBeVisible();
		await expect(page.locator('[data-toast]')).toHaveCount(0, { timeout: 5000 });
	});
});

/** 브라우저 탭에서는 가로채지 않는다. 가두는 짓이고 닫을 앱도 아니다. */
test.describe('뒤로가기 (브라우저 탭)', () => {
	test('뒤로가기가 이전 화면으로 그대로 이동한다', async ({ page }) => {
		await page.goto('/3x3/bld/3style/corner/lookup');
		await page.locator('nav a:text-is("퀴즈")').click();
		await expect(page.locator('[data-case]')).toBeVisible();
		await page.goBack();
		await expect(page.getByLabel('케이스 코드')).toBeVisible();
		await expect(page.locator('[data-toast]')).toHaveCount(0);
	});
});
