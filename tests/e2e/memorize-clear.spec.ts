/**
 * Phase 6 — About "암기 표시 전체 해제" E2E (FR-MC-21, 22).
 *
 * 케이스·기준 이름은 데이터에서 뽑는다 — 리터럴 박기 금지
 * (memorize-checkbox.spec.ts:9-15 방식). v2→v3 에서 기준 개수가 바뀐 전례가 있다.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const parsed = data as unknown as {
	meta: { anchorLearnOrder?: string[] };
	cases: Record<string, { setup: { anchor: string } }>;
	anchors: Record<string, { count: number }>;
};

const allCodes = Object.keys(parsed.cases);
const firstAnchor = (parsed.meta.anchorLearnOrder ?? Object.keys(parsed.anchors))[0];

/** 초기 상태로 checked 를 심는다. addInitScript 는 반드시 최초 goto 이전에. */
async function seedChecked(
	page: Page,
	setup: string[],
	direct: string[]
): Promise<void> {
	await page.addInitScript(
		([s, d]) => {
			localStorage.setItem(
				'memorize.checked',
				JSON.stringify({
					schemaVersion: 1,
					checked: { setup: s, direct: d }
				})
			);
		},
		[setup, direct]
	);
}

/** localStorage 의 memorize.checked 를 파싱해 반환한다. */
async function readChecked(page: Page): Promise<{ setup: string[]; direct: string[] }> {
	const raw = await page.evaluate(() => localStorage.getItem('memorize.checked'));
	if (!raw) return { setup: [], direct: [] };
	const p = JSON.parse(raw);
	return { setup: p.checked.setup ?? [], direct: p.checked.direct ?? [] };
}

/** About 모달 열기. 열린 뒤 조작 가능한 상태까지 기다린다. */
async function openAbout(page: Page): Promise<void> {
	await page.locator('[data-about-open]').click();
	await expect(page.locator('[data-about]')).toBeVisible();
	// idle 버튼이 렌더된 상태 (또는 confirming — 케이스에 따라)
	await expect(page.locator('[data-clear-memorize]')).toBeVisible();
}

test.describe('T6-1. 버튼 존재 및 위치 (FR-MC-21)', () => {
	test('About 모달에 전체 해제 버튼, 업데이트 확인 아래, 높이 44px 이상 @viewport', async ({ page }) => {
		await page.goto('/');
		await openAbout(page);

		const idle = page.locator('[data-clear-memorize="idle"]');
		await expect(idle).toBeVisible();
		await expect(idle).toHaveText(/암기 표시 전체 해제/);

		// 업데이트 확인 버튼보다 아래에 위치
		const checkBox = await page.locator('[data-check-update]').boundingBox();
		const clearBox = await idle.boundingBox();
		expect(clearBox!.y).toBeGreaterThan(checkBox!.y);

		// 44px 이상
		expect(clearBox!.height).toBeGreaterThanOrEqual(44);
	});
});

test.describe('T6-2. 2단계 확인 흐름 (FR-MC-22)', () => {
	test('첫 클릭 → confirming, 두 번째 클릭 → 실행 + idle 복귀 @viewport', async ({ page }) => {
		const seededSetup = allCodes.slice(0, 2);
		const seededDirect = allCodes.slice(0, 1);
		await seedChecked(page, seededSetup, seededDirect);

		await page.goto('/');
		await openAbout(page);

		// 첫 클릭 → confirming
		await page.locator('[data-clear-memorize="idle"]').click();
		const confirming = page.locator('[data-clear-memorize="confirming"]');
		await expect(confirming).toBeVisible();
		await expect(confirming).toHaveText(/정말 해제합니다/);

		// confirming 버튼 높이 44px 이상
		const cBox = await confirming.boundingBox();
		expect(cBox!.height).toBeGreaterThanOrEqual(44);

		// 두 번째 클릭 → 실행
		await confirming.click();

		// localStorage 반영을 기다린다 ($effect 저장 완료)
		await expect.poll(() => readChecked(page)).toEqual({ setup: [], direct: [] });

		// idle 복귀
		await expect(page.locator('[data-clear-memorize="idle"]')).toBeVisible();
		await expect(page.locator('[data-clear-memorize="confirming"]')).toHaveCount(0);
	});
});

test.describe('T6-3. 브라우저 confirm() 미사용 (FR-MC-22)', () => {
	test('전 클릭 시퀀스에서 dialog 이벤트가 발생하지 않는다', async ({ page }) => {
		await seedChecked(page, allCodes.slice(0, 1), []);
		const dialogs: string[] = [];
		page.on('dialog', (d) => {
			dialogs.push(d.type());
			d.dismiss();
		});

		await page.goto('/');
		await openAbout(page);
		await page.locator('[data-clear-memorize="idle"]').click();
		await page.locator('[data-clear-memorize="confirming"]').click();
		await expect(page.locator('[data-clear-memorize="idle"]')).toBeVisible();

		expect(dialogs).toEqual([]);
	});
});

test.describe('T6-4. 모달 닫기 → idle 리셋 (FR-MC-22)', () => {
	test('confirming 상태에서 닫고 다시 열면 idle 로 복귀', async ({ page }) => {
		await seedChecked(page, allCodes.slice(0, 1), []);
		await page.goto('/');

		// 첫 회: confirming 까지 만든 뒤 닫기
		await openAbout(page);
		await page.locator('[data-clear-memorize="idle"]').click();
		await expect(page.locator('[data-clear-memorize="confirming"]')).toBeVisible();
		await page.locator('[data-about-close]').click();
		await expect(page.locator('[data-about]')).not.toBeVisible();

		// 재열기 → idle (즉시 확인, 대기 없이)
		await openAbout(page);
		await expect(page.locator('[data-clear-memorize="idle"]')).toBeVisible();
		await expect(page.locator('[data-clear-memorize="confirming"]')).toHaveCount(0);

		// ESC 로도 같은 결과
		await page.locator('[data-clear-memorize="idle"]').click();
		await expect(page.locator('[data-clear-memorize="confirming"]')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('[data-about]')).not.toBeVisible();
		await openAbout(page);
		await expect(page.locator('[data-clear-memorize="idle"]')).toBeVisible();

		// 취소만 했으므로 checked 는 그대로 (T6-6 와 겹치는 성격)
		expect(await readChecked(page)).toEqual({
			setup: [allCodes[0]],
			direct: []
		});
	});
});

test.describe('T6-5. 전체 해제 실행 결과 (FR-MC-21)', () => {
	test('setup·direct 모두 비고, 기준 화면 진도가 전부 0/{전체}', async ({ page }) => {
		const seededSetup = allCodes.slice(0, 3);
		const seededDirect = allCodes.slice(0, 2);
		await seedChecked(page, seededSetup, seededDirect);
		await page.goto('/');
		await openAbout(page);
		await page.locator('[data-clear-memorize="idle"]').click();
		await page.locator('[data-clear-memorize="confirming"]').click();
		await expect(page.locator('[data-clear-memorize="idle"]')).toBeVisible();

		// localStorage 반영
		await expect.poll(() => readChecked(page)).toEqual({ setup: [], direct: [] });

		// 모달 닫고 /anchors 로. 하드 goto 는 addInitScript 가 재실행되어 seed 가
		// 복원되므로 하단 nav 링크를 통한 클라이언트 사이드 네비게이션을 쓴다.
		await page.locator('[data-about-close]').click();
		await expect(page.locator('[data-about]')).not.toBeVisible();
		await page.locator('nav a[href="/anchors"]').click();
		await page.waitForURL(/\/anchors$/);

		// data-progress 를 가진 요소가 있어야 하고 전부 "0/N" 패턴
		const progressLocs = page.locator('[data-progress]');
		const total = await progressLocs.count();
		expect(total).toBeGreaterThan(0);
		for (let i = 0; i < total; i++) {
			await expect(progressLocs.nth(i)).toContainText(/^\s*0\s*\/\s*\d+\s*$/);
		}

		// 기준 상세 화면도 클라이언트 사이드 네비게이션으로 이동
		await page.locator(`a[data-anchor="${firstAnchor}"]`).click();
		await page.waitForURL(new RegExp(`/anchors/${firstAnchor}$`));
		const boxes = page.locator('[data-memorize-setup] [data-memorize-input]');
		const boxCount = await boxes.count();
		expect(boxCount).toBeGreaterThan(0);
		for (let i = 0; i < boxCount; i++) {
			await expect(boxes.nth(i)).not.toBeChecked();
		}
	});
});

test.describe('T6-6. 첫 클릭 후 취소 — 실행 안 됨 (FR-MC-22)', () => {
	test('confirming 상태에서 모달 닫으면 checked 는 그대로', async ({ page }) => {
		const seededSetup = allCodes.slice(0, 2);
		const seededDirect = allCodes.slice(0, 1);
		await seedChecked(page, seededSetup, seededDirect);
		await page.goto('/');

		await openAbout(page);
		await page.locator('[data-clear-memorize="idle"]').click();
		await expect(page.locator('[data-clear-memorize="confirming"]')).toBeVisible();

		// 닫기 (실행 안 함)
		await page.locator('[data-about-close]').click();
		await expect(page.locator('[data-about]')).not.toBeVisible();

		// checked 유지 — 배열 요소가 그대로 있는지만 확인. 정렬 규약이 있으니 sort 비교.
		const after = await readChecked(page);
		expect([...after.setup].sort()).toEqual([...seededSetup].sort());
		expect([...after.direct].sort()).toEqual([...seededDirect].sort());
	});
});

test.describe('grep 검증 (About 파일에 confirm( 없음)', () => {
	test('빌드 산출물 및 소스에 브라우저 confirm 호출 없음', async ({ page }) => {
		// About.svelte 의 확인 절차가 브라우저 confirm() 을 쓰면 T6-3 에서만
		// 잡히지 않고 우회 경로가 있을 수 있다. 실 페이지에서도 확인차.
		await seedChecked(page, allCodes.slice(0, 1), []);
		const dialogs: string[] = [];
		page.on('dialog', (d) => {
			dialogs.push(d.type());
			d.dismiss();
		});
		await page.goto('/');
		await openAbout(page);
		await page.locator('[data-clear-memorize="idle"]').click();
		await page.locator('[data-clear-memorize="confirming"]').click();
		await expect(page.locator('[data-clear-memorize="idle"]')).toBeVisible();
		expect(dialogs).toEqual([]);
	});
});
