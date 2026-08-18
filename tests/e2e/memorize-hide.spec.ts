/**
 * Phase 4 — "외운거 안보기" 토글 E2E (FR-MC-13~17; NFR-MC-2; AD-4).
 *
 * 기준·케이스 코드는 데이터에서 읽는다. 하드코딩 금지 (memorize-checkbox.spec.ts:9-15 방식).
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

interface CaseData {
	setup: { anchor: string };
}
const parsed = data as unknown as {
	meta: { anchorLearnOrder?: string[] };
	cases: Record<string, CaseData>;
	anchors: Record<string, { count: number }>;
};

const firstAnchor = (parsed.meta.anchorLearnOrder ?? Object.keys(parsed.anchors))[0];

function anchoredCases(anchor: string): string[] {
	return Object.keys(parsed.cases)
		.filter((k) => parsed.cases[k].setup.anchor === anchor)
		.sort();
}

/**
 * 초기 상태로 setup 체크 목록을 심는다. addInitScript 는 최초 goto 이전에.
 * 초기 로드 시점 memorize.svelte.ts 가 이 값을 그대로 읽어 setupChecked 에 넣는다.
 */
async function seedSetup(page: Page, codes: string[]): Promise<void> {
	await page.addInitScript((seed) => {
		localStorage.setItem(
			'memorize.checked',
			JSON.stringify({ schemaVersion: 1, checked: { setup: seed, direct: [] } })
		);
	}, codes);
}

/** hideMemorized 토글을 미리 켠 상태로 열고 싶을 때. */
async function seedHide(page: Page, on: boolean): Promise<void> {
	await page.addInitScript((v) => {
		localStorage.setItem('anchor.hideMemorized', v);
	}, on ? 'true' : 'false');
}

async function pageReady(page: Page): Promise<void> {
	// 토글이 렌더된 뒤 조작
	await expect(page.locator('[data-hide-toggle]')).toBeVisible();
}

/** <li> 의 computed display 값. hidden 이면 'none'. */
async function displayOf(page: Page, code: string): Promise<string> {
	return page.locator(`[data-case-row="${code}"]`).evaluate((el) => {
		return getComputedStyle(el).display;
	});
}

/**
 * 여러 code 의 computed display 를 한 번의 evaluate 로 뽑는다.
 * 164 개(GC 기준) 를 개별로 조회하면 모바일에서 30초 timeout 을 넘긴다.
 */
async function displayMap(
	page: Page,
	codes: string[]
): Promise<Record<string, string>> {
	return page.evaluate((codes) => {
		const out: Record<string, string> = {};
		for (const c of codes) {
			const el = document.querySelector(`[data-case-row="${c}"]`);
			out[c] = el ? getComputedStyle(el).display : 'MISSING';
		}
		return out;
	}, codes);
}

test.describe('기본 상태 (FR-MC-14)', () => {
	test('T4-1. localStorage 없음 → 토글 OFF·전체 표시·안내 없음', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		await page.goto(`/anchors/${firstAnchor}`);
		await pageReady(page);

		// 토글은 OFF
		await expect(page.locator('[data-hide-input]')).not.toBeChecked();

		// 모든 case-row 가 표시된다 (배치로 조회)
		const map = await displayMap(page, codes);
		for (const code of codes) {
			expect(map[code], `${code} 이 hidden 상태`).not.toBe('none');
		}

		// 안내 문구 없음
		await expect(page.locator('[data-all-memorized]')).toHaveCount(0);
	});
});

test.describe('체크 + 토글 ON (FR-MC-13, 17)', () => {
	test('T4-2. 체크된 <li> 는 display:none, DOM 개수·ul top 은 불변 @viewport', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 2, `${firstAnchor} 케이스 2개 미만`);
		const target = codes[0];

		await seedSetup(page, [target]);
		await page.goto(`/anchors/${firstAnchor}`);
		await pageReady(page);

		// 토글 OFF 상태에서 li 개수·ul top 기록
		const liCountBefore = await page.locator('[data-case-row]').count();
		const ul = page.locator('ul').first();
		const ulTopBefore = (await ul.boundingBox())!.y;

		// 토글 ON
		await page.locator('[data-hide-input]').click();
		await expect(page.locator('[data-hide-input]')).toBeChecked();
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('anchor.hideMemorized')))
			.toBe('true');

		// 대상 li 는 display:none
		expect(await displayOf(page, target)).toBe('none');
		// 다른 li 는 여전히 표시
		expect(await displayOf(page, codes[1])).not.toBe('none');

		// DOM 개수 동일 — {#if} 로 제거되지 않았음을 확인 (AD-4)
		const liCountAfter = await page.locator('[data-case-row]').count();
		expect(liCountAfter).toBe(liCountBefore);

		// ul 의 top 은 토글 전과 동일 — 위 요소들이 밀리지 않는다 (FR-MC-17)
		const ulTopAfter = (await ul.boundingBox())!.y;
		expect(ulTopAfter).toBe(ulTopBefore);

		// 토글 OFF → 다시 표시
		await page.locator('[data-hide-input]').click();
		await expect(page.locator('[data-hide-input]')).not.toBeChecked();
		expect(await displayOf(page, target)).not.toBe('none');
	});
});

test.describe('모두 암기 안내 (FR-MC-15)', () => {
	test('T4-3. 전체를 체크 + 토글 ON → 안내 표시, 토글 OFF → 사라짐', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		// 해당 기준의 모든 케이스를 setup 체크로 심고 토글 ON 으로 연다
		await seedSetup(page, codes);
		await seedHide(page, true);
		await page.goto(`/anchors/${firstAnchor}`);
		await pageReady(page);

		// 안내 표시
		await expect(page.locator('[data-all-memorized]')).toBeVisible();
		await expect(page.locator('[data-all-memorized]')).toHaveText('모두 암기 표시되어 있습니다');

		// 전 <li> display:none (batch)
		const hiddenMap = await displayMap(page, codes);
		for (const code of codes) {
			expect(hiddenMap[code], `${code} 이 hidden 아님`).toBe('none');
		}

		// 토글 OFF → 안내 사라지고 li 재표시
		await page.locator('[data-hide-input]').click();
		await expect(page.locator('[data-all-memorized]')).toHaveCount(0);
		const shownMap = await displayMap(page, codes);
		for (const code of codes) {
			expect(shownMap[code], `${code} 이 아직 hidden`).not.toBe('none');
		}
	});
});

test.describe('토글 + 체크 해제 → 즉시 재표시 (FR-MC-13)', () => {
	test('T4-4. 숨겨진 케이스의 체크를 해제하면 그 자리에서 다시 보인다', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);
		const target = codes[0];
		const total = codes.length;

		await seedSetup(page, [target]);
		await seedHide(page, true);
		await page.goto(`/anchors/${firstAnchor}`);
		await pageReady(page);

		// 초기: 대상은 숨김, 진도는 1/N
		expect(await displayOf(page, target)).toBe('none');
		await expect(page.locator('[data-progress]').first()).toContainText(`1/${total}`);

		// display:none 인 체크박스는 hit-test 대상이 아니라 Playwright click 이
		// scroll-into-view 부터 막힌다. 실 UX 에선 조회 화면 체크박스 해제나
		// About 의 clearAll 로 도달할 수 있는 상태다. onchange 이벤트를 직접 발화한다.
		await page
			.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`)
			.evaluate((el) => {
				const input = el as HTMLInputElement;
				input.checked = false;
				input.dispatchEvent(new Event('change', { bubbles: true }));
			});

		// 즉시 재표시. reload 없이 반응성만으로.
		await expect
			.poll(() => displayOf(page, target))
			.not.toBe('none');
		await expect(page.locator('[data-progress]').first()).toContainText(`0/${total}`);
	});
});

test.describe('localStorage 저장·복원 (FR-MC-14)', () => {
	test('T4-5. 토글 상태가 anchor.hideMemorized 로 저장·복원', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		await page.goto(`/anchors/${firstAnchor}`);
		await pageReady(page);

		// ON → 저장 = "true"
		await page.locator('[data-hide-input]').click();
		await expect(page.locator('[data-hide-input]')).toBeChecked();
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('anchor.hideMemorized')))
			.toBe('true');

		// 새로고침 → ON 복원
		await page.reload();
		await pageReady(page);
		await expect(page.locator('[data-hide-input]')).toBeChecked();

		// OFF → 저장 = "false"
		await page.locator('[data-hide-input]').click();
		await expect(page.locator('[data-hide-input]')).not.toBeChecked();
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('anchor.hideMemorized')))
			.toBe('false');

		// 새로고침 → OFF 복원
		await page.reload();
		await pageReady(page);
		await expect(page.locator('[data-hide-input]')).not.toBeChecked();
	});
});

test.describe('진도 분모 불변 (FR-MC-16)', () => {
	test('T4-6. 토글 ON 이 진도 분모를 바꾸지 않는다', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 2, `${firstAnchor} 케이스 2개 미만`);
		const total = codes.length;

		await seedSetup(page, [codes[0]]);
		await page.goto(`/anchors/${firstAnchor}`);
		await pageReady(page);

		// OFF 상태: 1/total
		await expect(page.locator('[data-progress]').first()).toContainText(`1/${total}`);

		// ON 후에도 분모 total 유지 — 숨겨진 항목이 분모에서 빠지면 안 된다
		await page.locator('[data-hide-input]').click();
		await expect(page.locator('[data-progress]').first()).toContainText(`1/${total}`);

		// 추가 체크 후에도 분모 그대로
		await page.locator(`[data-memorize-setup="${codes[1]}"] [data-memorize-input]`).click();
		await expect(page.locator('[data-progress]').first()).toContainText(`2/${total}`);
	});
});

test.describe('SSR 산출물 검증 (AD-4, FR-MC-15)', () => {
	test('T4-8. 안내 문구·hidden 클래스가 SSR 에 없고 모든 <li> 존재', async ({
		page,
		context
	}) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		let html = '';
		await context.route(`**/anchors/${firstAnchor}`, async (route) => {
			const res = await route.fetch();
			html = await res.text();
			await route.fulfill({ response: res });
		});
		await page.goto(`/anchors/${firstAnchor}`);

		// SSR 에 안내 문구 없음
		expect(html).not.toContain('모두 암기 표시되어 있습니다');
		// SSR 에 hidden 클래스가 붙은 <li> 없음
		expect(html).not.toMatch(/<li[^>]*class="[^"]*hidden/);
		// 모든 케이스 <li> 가 존재 — 데이터의 전체 개수
		for (const code of codes) {
			expect(html).toContain(`data-case-row="${code}"`);
		}
	});
});
