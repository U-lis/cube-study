/**
 * Phase 3 — 진도 표시 E2E (FR-MC-10, 11, 12; NFR-MC-5; AD-4).
 *
 * 기준 이름·케이스 코드를 코드에 박지 않는다. 전부 데이터에서 읽는다
 * (memorize-checkbox.spec.ts:9-15 방식과 동일). v2→v3 에서 기준이 10→6 개로
 * 바뀐 전례가 있고 같은 일이 또 일어나면 리터럴을 박은 테스트는 무의미하게 죽는다.
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

/** 데이터의 학습 순서 첫 기준 — 무엇이 첫 번째든 상관없다. */
const firstAnchor = (parsed.meta.anchorLearnOrder ?? Object.keys(parsed.anchors))[0];

function anchoredCases(anchor: string): string[] {
	return Object.keys(parsed.cases)
		.filter((k) => parsed.cases[k].setup.anchor === anchor)
		.sort();
}

/** memorize.checked 를 읽어 파싱. 하이드레이션과 $effect 저장이 끝난 뒤여야 한다. */
async function readChecked(page: Page): Promise<{ setup: string[]; direct: string[] }> {
	const raw = await page.evaluate(() => localStorage.getItem('memorize.checked'));
	if (!raw) return { setup: [], direct: [] };
	const p = JSON.parse(raw);
	return { setup: p.checked.setup ?? [], direct: p.checked.direct ?? [] };
}

/**
 * 초기 상태로 특정 기준의 setup 체크 목록을 미리 심는다. addInitScript 는
 * goto 이전에 등록해야 초기 로드 시점 localStorage 에 값이 있다.
 */
async function seedSetup(page: Page, codes: string[]): Promise<void> {
	await page.addInitScript((seed) => {
		localStorage.setItem(
			'memorize.checked',
			JSON.stringify({ schemaVersion: 1, checked: { setup: seed, direct: [] } })
		);
	}, codes);
}

/** 하이드레이션 이후 진도 요소가 실제 값을 반영할 시간을 준다. */
async function progressReady(page: Page): Promise<void> {
	// 상세 화면: <p class="count">에 data-progress 자식 존재
	await expect(page.locator('[data-progress]').first()).toBeVisible();
}

test.describe('기준 상세 진도 표시 (FR-MC-10)', () => {
	test('T3-1. 초기값 0/{전체} — 진도바·퍼센트·문구 없음 (FR-MC-10, NFR-MC-5)', async ({
		page
	}) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		await page.goto(`/anchors/${firstAnchor}`);
		await progressReady(page);

		// 표시 형식: {checked}/{total}
		const progress = page.locator('[data-progress]').first();
		await expect(progress).toContainText(`0/${codes.length}`);

		// 진도바·퍼센트 요소 미존재
		const bodyText = await page.locator('body').textContent();
		expect(bodyText).not.toMatch(/%/);

		// 축하·동기 문구 미존재
		expect(bodyText).not.toMatch(/남았어요|다 외웠어요|완료|축하/);
	});

	test('T3-2. 체크 반영 → 새로고침 복원 (FR-MC-10, 12)', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 2, `${firstAnchor} 케이스 2개 미만`);
		const [c1, c2] = codes;

		await page.goto(`/anchors/${firstAnchor}`);
		await progressReady(page);
		const progress = page.locator('[data-progress]').first();

		// 체크 1개 → 1/N
		await page.locator(`[data-memorize-setup="${c1}"] [data-memorize-input]`).click();
		await expect(progress).toContainText(`1/${codes.length}`);

		// 체크 1개 더 → 2/N
		await page.locator(`[data-memorize-setup="${c2}"] [data-memorize-input]`).click();
		await expect(progress).toContainText(`2/${codes.length}`);

		// 해제 → 1/N
		await page.locator(`[data-memorize-setup="${c1}"] [data-memorize-input]`).click();
		await expect(progress).toContainText(`1/${codes.length}`);

		// 저장 완료 확인 후 새로고침 → 유지
		await expect.poll(() => readChecked(page).then((s) => s.setup)).toContain(c2);
		await page.reload();
		await progressReady(page);
		await expect(page.locator('[data-progress]').first()).toContainText(`1/${codes.length}`);
	});

	test('T3-3. direct 체크는 setup 진도에 영향 없음 (FR-MC-1, 10)', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 2, `${firstAnchor} 케이스 2개 미만`);
		const [c1, c2] = codes;

		// setup 은 비운 상태로 direct 만 미리 심는다
		await page.addInitScript((codes) => {
			localStorage.setItem(
				'memorize.checked',
				JSON.stringify({
					schemaVersion: 1,
					checked: { setup: [], direct: codes }
				})
			);
		}, [c1, c2]);

		await page.goto(`/anchors/${firstAnchor}`);
		await progressReady(page);
		// direct 체크가 있어도 setup 진도는 0
		await expect(page.locator('[data-progress]').first()).toContainText(`0/${codes.length}`);
	});
});

test.describe('기준공식 목록 진도 표시 (FR-MC-11)', () => {
	test('T3-4. 초기값 각 카드 0/{전체} — 항목 숨김·재분류 없음', async ({ page }) => {
		await page.goto('/anchors');
		await progressReady(page);

		// 데이터의 anchors 전부가 카드로 나타나야 한다 (숨김·필터 없음)
		const anchorNames = Object.keys(parsed.anchors);
		for (const name of anchorNames) {
			const card = page.locator(`[data-anchor="${name}"] [data-progress]`);
			await expect(card).toBeVisible();
			await expect(card).toContainText(`0/${parsed.anchors[name].count}`);
		}
	});

	test('T3-5. 체크 후 카드 진도 갱신 → 새로고침 유지 (FR-MC-11)', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);
		const target = codes[0];
		const total = parsed.anchors[firstAnchor].count;

		// 상세 화면에서 체크
		await page.goto(`/anchors/${firstAnchor}`);
		await progressReady(page);
		await page.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`).click();
		await expect.poll(() => readChecked(page).then((s) => s.setup)).toContain(target);

		// 목록으로 이동 → 해당 카드 진도가 1/N
		await page.goto('/anchors');
		await progressReady(page);
		await expect(page.locator(`[data-anchor="${firstAnchor}"] [data-progress]`)).toContainText(
			`1/${total}`
		);

		// 새로고침 후에도 유지
		await page.reload();
		await progressReady(page);
		await expect(page.locator(`[data-anchor="${firstAnchor}"] [data-progress]`)).toContainText(
			`1/${total}`
		);
	});
});

test.describe('레이아웃 안정성 (T3-6, AD-4, NFR-MC-2)', () => {
	test('T3-6a. 상세: 체크 전후 진도 컨테이너 폭·리스트 top 유지', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		await page.goto(`/anchors/${firstAnchor}`);
		await progressReady(page);

		const progress = page.locator('[data-progress]').first();
		const firstLi = page.locator('ul > li').first();
		const wBefore = (await progress.boundingBox())!.width;
		const topBefore = (await firstLi.boundingBox())!.y;

		// 체크 → 값이 0→1 로 바뀌지만 min-width + tabular-nums 로 폭이 유지되어야 한다
		await page.locator(`[data-memorize-setup="${codes[0]}"] [data-memorize-input]`).click();
		await expect(progress).toContainText(`1/${codes.length}`);

		const wAfter = (await progress.boundingBox())!.width;
		const topAfter = (await firstLi.boundingBox())!.y;
		expect(wAfter).toBe(wBefore);
		expect(topAfter).toBe(topBefore);
	});

	test('T3-6b. 목록: 카드 진도 폭이 값 변화 후에도 동일', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);

		await page.goto('/anchors');
		await progressReady(page);

		const card = page.locator(`[data-anchor="${firstAnchor}"] [data-progress]`);
		const wBefore = (await card.boundingBox())!.width;

		// localStorage 에 체크를 심고 리로드 → 값이 바뀌어도 폭 유지 여부 확인
		await seedSetup(page, [codes[0]]);
		await page.reload();
		await progressReady(page);
		await expect(card).toContainText(`1/${parsed.anchors[firstAnchor].count}`);
		const wAfter = (await card.boundingBox())!.width;
		expect(wAfter).toBe(wBefore);
	});
});

test.describe('SSR 산출물 검증 (AD-4)', () => {
	test('T3-7. 초기 HTML 에 이미 0/{전체} 가 박혀 있어 하이드레이션 전 렌더가 유효', async ({
		page,
		context
	}) => {
		// 라우트 요청 응답을 가로채 raw HTML 을 읽는다. JS 실행 전 상태이므로
		// 하이드레이션에 의한 값 갱신이 없다.
		const anchorNames = Object.keys(parsed.anchors);
		let listHtml = '';
		await context.route('**/anchors', async (route) => {
			const res = await route.fetch();
			listHtml = await res.text();
			await route.fulfill({ response: res });
		});
		await page.goto('/anchors');
		expect(listHtml).toContain('data-progress');
		for (const name of anchorNames) {
			// data-anchor 카드 안에 `0/{count}` 텍스트가 있어야 한다
			const rx = new RegExp(
				`data-anchor="${name}"[\\s\\S]{0,2000}?>0</span>/${parsed.anchors[name].count}`
			);
			expect(listHtml).toMatch(rx);
		}
	});
});
