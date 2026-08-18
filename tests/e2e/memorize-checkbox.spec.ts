/**
 * Phase 2 — 암기 체크박스 E2E (FR-MC-3, 4, 5; NFR-MC-2, 4; AD-7).
 *
 * 기준 이름·케이스 코드를 코드에 박지 않는다. 전부 데이터에서 읽는다
 * (lookup.spec.ts:1-15 방식). v2→v3 에서 기준이 10→6 개로 바뀐 전례가 있고
 * 같은 일이 또 일어나면 리터럴을 박은 테스트는 무의미하게 죽는다.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

interface CaseData {
	setup: { alg: string; anchor: string; S: string; usesInverse?: boolean };
}
const parsed = data as unknown as {
	meta: { anchorLearnOrder?: string[] };
	cases: Record<string, CaseData>;
	anchors: Record<string, { count: number; alg: string }>;
};

/** 데이터의 학습 순서 첫 기준을 대표로 쓴다. 무엇이 첫 번째든 상관없다. */
const firstAnchor = (parsed.meta.anchorLearnOrder ?? Object.keys(parsed.anchors))[0];

/** 그 기준에 속한 케이스들. 셋업 유무는 상관없이 첫 번째와 두 번째를 쓴다. */
function anchoredCases(anchor: string): string[] {
	return Object.keys(parsed.cases)
		.filter((k) => parsed.cases[k].setup.anchor === anchor)
		.sort();
}

/** localStorage 의 memorize.checked 를 읽어 파싱. 하이드레이션과 $effect 저장이 끝난 뒤여야 한다. */
async function readChecked(page: Page): Promise<{ setup: string[]; direct: string[] }> {
	const raw = await page.evaluate(() => localStorage.getItem('memorize.checked'));
	if (!raw) return { setup: [], direct: [] };
	const parsed = JSON.parse(raw);
	return { setup: parsed.checked.setup ?? [], direct: parsed.checked.direct ?? [] };
}

/** ui.mode 를 localStorage 에 초기화한 채로 페이지를 연다. addInitScript 는 최초 goto 이전에. */
async function withMode(page: Page, mode: 'setup' | 'direct'): Promise<void> {
	await page.addInitScript((m) => {
		localStorage.setItem('ui.mode', m);
	}, mode);
}

/** 하이드레이션 완료를 커서 위치로 확인한다 (lookup.spec.ts 의 검증 방식과 동일). */
async function lookupReady(page: Page): Promise<void> {
	await expect(page.getByLabel('케이스 코드')).toBeFocused();
}

test.describe('CaseView 체크박스 (FR-MC-3(a))', () => {
	test('T2-1. setup 모드에서 체크·저장·복원·재클릭 (FR-MC-3(a), 5)', async ({ page }) => {
		const code = Object.keys(parsed.cases)[0];
		await withMode(page, 'setup');
		await page.goto('/');
		await lookupReady(page);
		await page.getByLabel('케이스 코드').fill(code);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);

		// 1. 라벨이 "setup 암기"
		await expect(page.locator('[data-memorize-label]')).toHaveText('setup 암기');

		// 2. 초기 상태 unchecked
		const box = page.locator('section.case [data-memorize-input]');
		await expect(box).not.toBeChecked();

		// 3. 클릭 → localStorage.setup 배열에 code 존재
		await box.click();
		await expect(box).toBeChecked();
		await expect
			.poll(() => readChecked(page).then((c) => c.setup))
			.toContain(code);

		// 4. 새로고침 후 checked 유지
		await page.reload();
		await lookupReady(page);
		await page.getByLabel('케이스 코드').fill(code);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);
		await expect(page.locator('section.case [data-memorize-input]')).toBeChecked();

		// 5. 재클릭으로 해제
		await page.locator('section.case [data-memorize-input]').click();
		await expect(page.locator('section.case [data-memorize-input]')).not.toBeChecked();
		await expect
			.poll(() => readChecked(page).then((c) => c.setup))
			.not.toContain(code);
	});

	test('T2-2. mode 전환 시 체크 상태·라벨이 각 표기 기준으로 갈아탄다 (FR-MC-3(a), 1)', async ({
		page
	}) => {
		const code = Object.keys(parsed.cases)[0];
		await withMode(page, 'setup');
		await page.goto('/');
		await lookupReady(page);
		await page.getByLabel('케이스 코드').fill(code);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);

		// step 1: setup 에서 체크
		const box = page.locator('section.case [data-memorize-input]');
		await box.click();
		await expect
			.poll(() => readChecked(page).then((c) => c.setup))
			.toContain(code);

		// step 2: direct 로 전환 → 라벨이 "optimized 암기"
		await page.locator('[data-toggle="mode"] [data-option="direct"]').click();
		await expect(page.locator('[data-memorize-label]')).toHaveText('optimized 암기');

		// step 3: 전환 직후 unchecked (direct 이력 없음)
		await expect(page.locator('section.case [data-memorize-input]')).not.toBeChecked();

		// step 4: direct 에서 체크 → direct 배열에만 추가, setup 유지
		await page.locator('section.case [data-memorize-input]').click();
		await expect(page.locator('section.case [data-memorize-input]')).toBeChecked();
		await expect.poll(() => readChecked(page)).toEqual({ setup: [code], direct: [code] });

		// step 5: setup 으로 복귀 → checked (step 1 상태 복원)
		await page.locator('[data-toggle="mode"] [data-option="setup"]').click();
		await expect(page.locator('[data-memorize-label]')).toHaveText('setup 암기');
		await expect(page.locator('section.case [data-memorize-input]')).toBeChecked();
	});
});

test.describe('기준 상세 체크박스 (FR-MC-3(b))', () => {
	test('T2-3. setup 고정 — mode 무관하게 checked.setup 만 변경 (FR-MC-3(b), 5)', async ({
		page
	}) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);
		const target = codes[0];

		// 초기 상태: 페이지 열기 전에 localStorage 는 비어 있다 (addInitScript 없음)
		await page.goto(`/anchors/${firstAnchor}`);
		const rowBox = page.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`);

		// step 1: 각 <li> 에 체크박스가 있다 — 데이터의 anchor.count 만큼
		await expect(page.locator('[data-case-row]')).toHaveCount(codes.length);
		await expect(page.locator('[data-memorize-setup]')).toHaveCount(codes.length);
		await expect(rowBox).not.toBeChecked();

		// step 2: 클릭 → checked.setup 에 target 추가
		await rowBox.click();
		await expect(rowBox).toBeChecked();
		await expect
			.poll(() => readChecked(page).then((c) => c.setup))
			.toContain(target);

		// step 3: settings.mode 를 direct 로 바꿔도 이 화면 체크는 setup 배열을 반영한다
		await page.evaluate(() => localStorage.setItem('ui.mode', 'direct'));
		await page.reload();
		await expect(
			page.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`)
		).toBeChecked();

		// step 4: 이 화면에서 다른 케이스 클릭 → checked.direct 가 아닌 checked.setup 만 갱신
		test.skip(codes.length < 2, `${firstAnchor} 에 케이스가 2개 미만이다`);
		const second = codes[1];
		await page.locator(`[data-memorize-setup="${second}"] [data-memorize-input]`).click();
		await expect
			.poll(() => readChecked(page))
			.toEqual({ setup: [second, target].sort(), direct: [] });

		// step 5: 새로고침 후에도 유지
		await page.reload();
		await expect(
			page.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`)
		).toBeChecked();
		await expect(
			page.locator(`[data-memorize-setup="${second}"] [data-memorize-input]`)
		).toBeChecked();
	});
});

test.describe('이벤트 독립 (AD-7)', () => {
	test('T2-4. 체크박스 클릭은 링크 이동을 부르지 않는다', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);
		const target = codes[0];

		await page.goto(`/anchors/${firstAnchor}`);
		const urlBefore = page.url();

		// 체크박스 클릭 → 상태 반영을 기다린 뒤 URL 이 그대로인지 확인.
		const box = page.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`);
		await box.click();
		await expect(box).toBeChecked();
		expect(page.url()).toBe(urlBefore);
	});

	test('T2-4b. <a> 클릭은 이동하고 localStorage 를 바꾸지 않는다', async ({ page }) => {
		const codes = anchoredCases(firstAnchor);
		test.skip(codes.length < 1, `${firstAnchor} 에 케이스가 없다`);
		const target = codes[0];

		await page.goto(`/anchors/${firstAnchor}`);
		// 이 시점의 checked 스냅샷 (하이드레이션 + $effect 저장이 끝날 시간을 준다)
		await expect(page.locator(`[data-memorize-setup="${target}"] [data-memorize-input]`))
			.not.toBeChecked();
		const before = await readChecked(page);

		// <a> 링크 클릭 → 조회 화면으로 이동. 도착까지 기다린 뒤 확인
		await page.locator(`a[href="/?c=${target}&from=${firstAnchor}"]`).click();
		await page.waitForURL(new RegExp(`\\?c=${target}(&|$)`));
		await expect(page.locator('section.case')).toHaveAttribute('data-case', target);

		// localStorage 는 그대로
		expect(await readChecked(page)).toEqual(before);
	});
});

test.describe('터치 대상 크기 (FR-MC-4)', () => {
	test('T2-5. 체크박스 라벨 높이 44px 이상 @viewport', async ({ page }) => {
		const code = Object.keys(parsed.cases)[0];
		await page.goto(`/?c=${code}`);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);

		// CaseView 의 체크박스 라벨
		const caseViewBox = page.locator('section.case .memorize');
		const cvRect = await caseViewBox.boundingBox();
		expect(cvRect).not.toBeNull();
		expect(cvRect!.height).toBeGreaterThanOrEqual(44);

		// 기준 상세 화면의 행 체크박스 라벨
		await page.goto(`/anchors/${firstAnchor}`);
		const rowBox = page.locator('[data-memorize-setup]').first();
		const rRect = await rowBox.boundingBox();
		expect(rRect).not.toBeNull();
		expect(rRect!.height).toBeGreaterThanOrEqual(44);
	});
});

test.describe('레이아웃 안정성 (NFR-MC-2)', () => {
	test('T2-6a. CaseView 체크박스 토글 전후 .main 의 top 이 동일하다 @viewport', async ({ page }) => {
		const code = Object.keys(parsed.cases)[0];
		await page.goto(`/?c=${code}`);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);

		const main = page.locator('section.case .main');
		const before = await main.boundingBox();
		await page.locator('section.case [data-memorize-input]').click();
		await expect(page.locator('section.case [data-memorize-input]')).toBeChecked();
		const after = await main.boundingBox();
		expect(after!.y).toBe(before!.y);
	});

	test('T2-6b. 기준 상세 <ul> 높이가 토글 전후 동일하다 @viewport', async ({ page }) => {
		await page.goto(`/anchors/${firstAnchor}`);
		const ul = page.locator('ul').first();
		const before = await ul.boundingBox();
		await page.locator('[data-memorize-setup]').first().locator('[data-memorize-input]').click();
		const after = await ul.boundingBox();
		expect(after!.height).toBe(before!.height);
	});
});

test.describe('프리렌더 (AD-4)', () => {
	test('T2-7. 콘솔에 하이드레이션 경고가 없다', async ({ page }) => {
		const warnings: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'warning' || msg.type() === 'error') {
				const text = msg.text();
				if (/hydrat/i.test(text)) warnings.push(text);
			}
		});
		// 체크박스가 있는 화면 두 개를 순회
		const code = Object.keys(parsed.cases)[0];
		await page.goto(`/?c=${code}`);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);
		await page.goto(`/anchors/${firstAnchor}`);
		await expect(page.locator('[data-memorize-setup]').first()).toBeVisible();
		expect(warnings).toEqual([]);
	});
});
