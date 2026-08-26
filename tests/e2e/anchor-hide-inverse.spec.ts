/**
 * 기준 상세 "역공식 숨김".
 *
 * 역쌍 `XY`/`YX` 는 항상 같은 기준에 속하고 한쪽은 기준을 거꾸로 돌린다. 정방향만
 * 훑으며 외울 때 목록이 두 배로 길어 보이는 것을 줄이는 토글이다.
 *
 * 기준 이름을 박지 않는다. 데이터에서 역방향 케이스가 가장 많은 기준을 고른다 —
 * 필요한 것은 "역이 충분히 섞인 목록" 이지 특정 기준이 아니다.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const parsed = data as unknown as {
	cases: Record<string, { setup: { anchor: string; usesInverse?: boolean } }>;
};
const byAnchor = (anchor: string) =>
	Object.entries(parsed.cases).filter(([, c]) => c.setup.anchor === anchor);

const anchors = [...new Set(Object.values(parsed.cases).map((c) => c.setup.anchor))].filter(
	(a) => a !== '(직접)'
);
const CODE = anchors
	.map((a) => ({ a, inv: byAnchor(a).filter(([, c]) => c.setup.usesInverse).length }))
	.sort((x, y) => y.inv - x.inv)[0].a;

const rows = byAnchor(CODE);
const inverseCodes = rows.filter(([, c]) => c.setup.usesInverse).map(([k]) => k);
const forwardCodes = rows.filter(([, c]) => !c.setup.usesInverse).map(([k]) => k);

const visibleRows = (page: Page) => page.locator('[data-case-row]:visible');

test.describe('역공식 숨김', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(`/3x3/bld/3style/corner/algs/${CODE}`);
		await page.waitForSelector('[data-case-row]');
	});

	test('끄면 역방향 케이스도 보인다 (기본값)', async ({ page }) => {
		await expect(visibleRows(page)).toHaveCount(rows.length);
		await expect(page.locator(`[data-case-row="${inverseCodes[0]}"]`)).toBeVisible();
	});

	test('켜면 "역" 배지가 붙은 줄만 사라진다', async ({ page }) => {
		await page.locator('[data-inverse-input]').check();

		await expect(visibleRows(page)).toHaveCount(forwardCodes.length);
		await expect(page.locator(`[data-case-row="${inverseCodes[0]}"]`)).toBeHidden();
		await expect(page.locator(`[data-case-row="${forwardCodes[0]}"]`)).toBeVisible();
		// 화면에 남은 줄에는 "역" 배지가 하나도 없어야 한다
		await expect(page.locator('[data-anchor-inverse]:visible')).toHaveCount(0);
	});

	test('진도 분모는 숨겨도 전체를 유지한다 (FR-MC-16)', async ({ page }) => {
		const before = await page.locator('[data-progress]').innerText();
		await page.locator('[data-inverse-input]').check();
		expect(await page.locator('[data-progress]').innerText()).toBe(before);
		expect(before).toContain(`/${rows.length}`);
	});

	test('상태가 다시 열어도 남는다', async ({ page }) => {
		await page.locator('[data-inverse-input]').check();
		await page.reload();
		// 숨김이 켜진 채로 열리면 알파벳 첫 줄이 가려져 있을 수 있다.
		// `[data-case-row]` 를 기다리면 첫 매치의 가시성을 기다려 그대로 멈춘다.
		await page.waitForSelector('[data-case-row]:visible');
		await expect(page.locator('[data-inverse-input]')).toBeChecked();
		await expect(visibleRows(page)).toHaveCount(forwardCodes.length);
	});

	test('"기준 없음" 그룹에는 토글이 없다', async ({ page }) => {
		// 현재 데이터에는 기준 없는 케이스가 0건이라 이 페이지 자체가 없다.
		// 데이터가 바뀌어 생기면 역방향 개념이 없으므로 토글도 없어야 한다.
		const res = await page.goto('/3x3/bld/3style/corner/algs/direct');
		if (res && res.status() === 200 && (await page.locator('[data-case-row]').count()) > 0) {
			await expect(page.locator('[data-inverse-toggle]')).toHaveCount(0);
		}
	});
});
