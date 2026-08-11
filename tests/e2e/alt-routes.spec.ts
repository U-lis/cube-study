/**
 * 조회 카드의 "아는 기준으로" 블록 (0.4.0).
 *
 * 배정된 기준을 아직 안 배웠을 때만 뜬다. 배운 기준은 그 기준의 자기 케이스
 * 2개(`isAnchorCase`)를 setup 암기 체크했는지로 판정한다 — 별도 상태가 없다.
 *
 * 기준·케이스 이름을 박지 않는다. 조건에 맞는 것을 데이터에서 고른다.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };
import alt from '../../src/lib/data/corner-UBL-alternatives.json' with { type: 'json' };

const parsed = data as unknown as {
	anchors: Record<string, unknown>;
	cases: Record<
		string,
		{ case: string; setup: { anchor: string; isAnchorCase?: boolean; moves: number } }
	>;
};
const alts = alt as unknown as { cases: Record<string, Record<string, { moves: number }>> };

const anchorNames = Object.keys(parsed.anchors);
const ownCases = (name: string) =>
	Object.values(parsed.cases)
		.filter((c) => c.setup.isAnchorCase && c.setup.anchor === name)
		.map((c) => c.case);

/** 배울 기준 하나와, 그 기준에 배정되지 않은 케이스 하나 */
const LEARNED = anchorNames[0];
const FOREIGN = Object.values(parsed.cases).find(
	(c) => c.setup.anchor !== LEARNED && !c.setup.isAnchorCase && alts.cases[c.case]?.[LEARNED]
)!;

async function seedSetup(page: Page, codes: string[]): Promise<void> {
	await page.addInitScript((seed) => {
		localStorage.setItem(
			'memorize.checked',
			JSON.stringify({ schemaVersion: 1, checked: { setup: seed, direct: [] } })
		);
	}, codes);
}

const block = (page: Page) => page.locator('[data-alt-block]');

test.describe('아는 기준으로', () => {
	test('아무것도 안 배웠으면 블록이 없다 (기본 상태)', async ({ page }) => {
		await page.goto(`/?c=${FOREIGN.case}`);
		await expect(page.locator(`[data-case="${FOREIGN.case}"]`)).toBeVisible();
		await expect(block(page)).toHaveCount(0);
	});

	test('기준 하나를 배우면 그 기준 경로가 뜬다', async ({ page }) => {
		await seedSetup(page, ownCases(LEARNED));
		await page.goto(`/?c=${FOREIGN.case}`);

		await expect(block(page)).toBeVisible();
		await expect(page.locator(`[data-alt-route="${LEARNED}"]`)).toBeVisible();
		// 배정된 기준 자신은 목록에 없다 — 위 블록이 이미 답으로 보여주고 있다
		await expect(page.locator(`[data-alt-route="${FOREIGN.setup.anchor}"]`)).toHaveCount(0);
	});

	test('자기 케이스를 하나만 체크하면 아직 안 뜬다', async ({ page }) => {
		await seedSetup(page, [ownCases(LEARNED)[0]]);
		await page.goto(`/?c=${FOREIGN.case}`);
		await expect(block(page)).toHaveCount(0);
	});

	test('배정된 기준을 배우면 블록이 사라진다', async ({ page }) => {
		await seedSetup(page, [...ownCases(LEARNED), ...ownCases(FOREIGN.setup.anchor)]);
		await page.goto(`/?c=${FOREIGN.case}`);
		await expect(page.locator(`[data-case="${FOREIGN.case}"]`)).toBeVisible();
		await expect(block(page)).toHaveCount(0);
	});

	test('무브 수와 증가분을 함께 적는다', async ({ page }) => {
		await seedSetup(page, ownCases(LEARNED));
		await page.goto(`/?c=${FOREIGN.case}`);

		const row = page.locator(`[data-alt-route="${LEARNED}"]`);
		const want = alts.cases[FOREIGN.case][LEARNED].moves;
		await expect(row).toContainText(`${want}수`);
		const diff = want - FOREIGN.setup.moves;
		await expect(row).toContainText(diff > 0 ? `+${diff}` : diff === 0 ? '±0' : String(diff));
	});

	test('optimized 표기에서는 뜨지 않는다', async ({ page }) => {
		await seedSetup(page, ownCases(LEARNED));
		await page.goto(`/?c=${FOREIGN.case}`);
		await expect(block(page)).toBeVisible();

		await page.locator('[data-toggle="mode"] [data-option="direct"]').click();
		await expect(block(page)).toHaveCount(0);
	});
});
