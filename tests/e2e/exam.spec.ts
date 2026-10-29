/**
 * 시험 (SPEC FR-EX, 사용자 결정 2026-10-29).
 *
 * 매일 퀴즈와 평행한 흐름이다. 다른 점은 셋이다 — 날짜가 없고, 기록이 쌓이며,
 * 결과 뒤에 `다시 시작` 하나로 idle 로 돌아간다. 데이터셋을 직접 읽어 코드를
 * 뽑는다 — `daily.spec.ts` 와 같은 패턴.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

interface CaseData {
	direct: { alg: string };
	setup: { anchor: string; S: string; usesInverse?: boolean };
	inverse: string;
}
const cases = (data as unknown as { cases: Record<string, CaseData> }).cases;
const allCodes = Object.keys(cases);

const EXAM = '/3x3/bld/3style/corner/exam';

async function seed(page: Page, items: Record<string, string>) {
	await page.addInitScript((kv) => {
		if (sessionStorage.getItem('__seeded')) return;
		sessionStorage.setItem('__seeded', '1');
		for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
	}, items);
}

const checked = (direct: string[], setup: string[] = []) =>
	JSON.stringify({ schemaVersion: 1, checked: { setup, direct } });

async function type(page: Page, alg: string) {
	for (const mv of alg.trim().split(/\s+/)) await page.locator(`[data-move="${mv}"]`).click();
}

async function caseNow(page: Page): Promise<string> {
	const el = page.locator('[data-case]');
	await expect(el).toBeVisible();
	return (await el.getAttribute('data-case'))!;
}

/** 시작하고 문제를 처음부터 끝까지 읽는다. 끝나면 마지막 문항에 서 있다. */
async function walk(page: Page): Promise<string[]> {
	const seen = [await caseNow(page)];
	while (await page.locator('[data-next]').isVisible()) {
		await page.locator('[data-next]').click();
		seen.push(await caseNow(page));
	}
	return seen;
}

const stage = (page: Page) => page.locator('[data-stage]');

test.describe('시험 (FR-EX)', () => {
	test('시작 전에는 설정과 시작 버튼만 선다', async ({ page }) => {
		await page.goto(EXAM);
		await expect(page.locator('h1')).toHaveText('시험');
		await expect(stage(page)).toHaveAttribute('data-stage', 'idle');
		await expect(page.locator('[data-start]')).toBeVisible();
		await expect(page.locator('[data-case]')).toHaveCount(0);
		await expect(page.locator('[data-grade]')).not.toBeVisible();
		await expect(page.locator('[data-restart]')).not.toBeVisible();
	});

	test('문항 수 선택기는 5 ~ 50 범위다', async ({ page }) => {
		await page.goto(EXAM);
		const sel = page.locator('[data-exam-size]');
		await expect(sel).toBeVisible();
		await expect(sel).toHaveValue('10');
		const opts = sel.locator('option');
		await expect(opts).toHaveCount(10);
		await expect(opts.first()).toHaveAttribute('value', '5');
		await expect(opts.last()).toHaveAttribute('value', '50');
	});

	test('시작하면 active 로 가고 설정 줄을 접고 잠근다', async ({ page }) => {
		await seed(page, { 'exam.size': '5' });
		await page.goto(EXAM);
		const toggle = page.locator('[data-toggle="exam-input"]');
		await expect(toggle).toBeVisible();
		await page.locator('[data-start]').click();
		await expect(stage(page)).toHaveAttribute('data-stage', 'active');
		await expect(toggle).not.toBeVisible();
		await expect(toggle.locator('[data-option="setup"]')).toBeDisabled();
		await expect(page.locator('[data-exam-size]')).not.toBeVisible();
		await expect(page.locator('[data-exam-size]')).toBeDisabled();
	});

	test('나갔다 돌아오면 첫 unanswered 문항부터 이어 시작한다', async ({ page }) => {
		await seed(page, { 'exam.size': '5' });
		await page.goto(EXAM);
		await page.locator('[data-start]').click();
		const first = await caseNow(page);
		await type(page, 'R U');
		await page.reload();
		await expect(stage(page)).toHaveAttribute('data-stage', 'active');
		// 답 없는 첫 문항은 2 / 5
		await expect(page.locator('[data-pos]')).toContainText('2 / 5');
		await page.locator('[data-prev]').click();
		expect(await caseNow(page)).toBe(first);
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', 'R U');
	});

	test('전부 풀고 채점하면 결과가 N문제 중 M개 로 뜬다 (백분율 없음)', async ({ page }) => {
		await seed(page, { 'exam.size': '5' });
		await page.goto(EXAM);
		await page.locator('[data-start]').click();
		const first = await caseNow(page);
		await type(page, cases[first].direct.alg);
		await page.locator('[data-next]').click();
		await type(page, 'R');
		await walk(page);
		await page.locator('[data-grade]').click();

		await expect(stage(page)).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-summary]')).toHaveText('5문제 중 1개 정답');
		await expect(page.locator('[data-summary]')).not.toContainText('%');
		const rows = page.locator('[data-result-case]');
		await expect(rows).toHaveCount(5);
		await expect(page.locator('[data-restart]')).toBeVisible();
	});

	test('결과를 낸 뒤 기록이 idle 목록에 나타난다', async ({ page }) => {
		await seed(page, { 'exam.size': '5' });
		await page.goto(EXAM);
		await page.locator('[data-start]').click();
		const first = await caseNow(page);
		await type(page, cases[first].direct.alg);
		await walk(page);
		await page.locator('[data-grade]').click();
		await page.locator('[data-restart]').click();

		await expect(stage(page)).toHaveAttribute('data-stage', 'idle');
		const record = page.locator('[data-record]').first();
		await expect(record).toBeVisible();
		await expect(record).toContainText('5문제 중 1개');
		await expect(record).toContainText('direct');
	});

	test('기록은 저장된 스냅샷을 그대로 보인다 — 재채점하지 않는다 (AD-13)', async ({ page }) => {
		// `correct` 가 저장과 다른 숫자여도 저장된 값을 그린다. 데이터 비교를 돌리지 않는다.
		const stored = JSON.stringify({
			schemaVersion: 1,
			records: [
				{
					at: 1700000000000,
					date: '2026-10-29',
					mode: 'direct',
					cases: ['AB', 'CD'],
					answers: [
						{ moves: [], ref: null },
						{ moves: [], ref: null }
					],
					correct: 42
				}
			]
		});
		await seed(page, { 'exam.records': stored });
		await page.goto(EXAM);
		const row = page.locator('[data-record]').first();
		await expect(row).toContainText('2문제 중 42개');
		await expect(row).toContainText('2026-10-29');
	});

	test('기록이 없으면 안내가 선다', async ({ page }) => {
		await page.goto(EXAM);
		await expect(page.locator('[data-records-empty]')).toHaveText('기록이 없습니다');
	});

	test('진행 버튼이 본문 최하단에 선다 @viewport', async ({ page }) => {
		await page.goto(EXAM);
		await page.locator('[data-start]').click();
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		expect(await y('[data-next]')).toBeGreaterThan(await y('[data-case]'));
		expect(await y('[data-next]')).toBeGreaterThan(await y('[data-move="R"]'));
		const box = (await page.locator('[data-next]').boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
	});
});
