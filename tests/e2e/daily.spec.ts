/**
 * 매일 퀴즈 (SPEC FR-DQ, 사용자 결정 2026-10-19).
 *
 * 케이스 코드·기준 이름을 코드에 박지 않는다. 데이터에서 뽑아 쓴다 (memorize-quiz.spec.ts 와 같다).
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

const DAILY = '/3x3/bld/3style/corner/daily';

/** 역쌍이 없는 코드 n 개. 출제가 역쌍을 피하므로 검사가 그 규칙에 걸리지 않게 한다. */
function distinctCodes(n: number): string[] {
	const out: string[] = [];
	for (const c of allCodes) {
		if (out.length === n) break;
		if (!out.includes(cases[c].inverse)) out.push(c);
	}
	return out;
}

async function seed(page: Page, items: Record<string, string>) {
	await page.addInitScript((kv) => {
		// 새로고침 뒤에도 다시 심으면 화면이 쓴 값을 덮는다 — 처음 한 번만
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

/** 시작하고 문제를 처음부터 끝까지 읽는다. 끝나면 마지막 문제에 서 있다. */
async function walk(page: Page): Promise<string[]> {
	const seen = [await caseNow(page)];
	while (await page.locator('[data-next]').isVisible()) {
		await page.locator('[data-next]').click();
		seen.push(await caseNow(page));
	}
	return seen;
}

const stage = (page: Page) => page.locator('[data-stage]');

test.describe('매일 퀴즈 (FR-DQ)', () => {
	test('시작 전에는 설정과 시작 버튼만 선다', async ({ page }) => {
		await page.goto(DAILY);
		await expect(page.locator('h1')).toHaveText('매일 퀴즈');
		await expect(stage(page)).toHaveAttribute('data-stage', 'idle');
		await expect(page.locator('[data-start]')).toBeVisible();
		await expect(page.locator('[data-case]')).toHaveCount(0);
		await expect(page.locator('[data-grade]')).not.toBeVisible();
		await expect(page.locator('[data-plan]').first()).toContainText('10문제');
	});

	test('문제 수만큼 내고 외운 것만으로 채운다', async ({ page }) => {
		const mem = distinctCodes(8);
		await seed(page, { 'daily.size': '5', 'memorize.checked': checked(mem) });
		await page.goto(DAILY);
		await expect(page.locator('[data-plan]').first()).toContainText('암기 표시한 공식에서 5개');
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-pos]')).toContainText('1 / 5');
		const seen = await walk(page);
		expect(seen).toHaveLength(5);
		expect(new Set(seen).size).toBe(5);
		for (const c of seen) expect(mem).toContain(c);
	});

	test('외운 것이 모자라면 전부 내고 나머지를 채운다', async ({ page }) => {
		const mem = distinctCodes(2);
		await seed(page, { 'daily.size': '6', 'memorize.checked': checked(mem) });
		await page.goto(DAILY);
		await expect(page.locator('[data-plan]').first()).toContainText('나머지 4개는 무작위');
		await page.locator('[data-start]').click();
		const seen = await walk(page);
		expect(seen).toHaveLength(6);
		for (const c of mem) expect(seen).toContain(c);
	});

	test('채점 전에는 앞뒤로 오가며 답을 고칠 수 있다', async ({ page }) => {
		await seed(page, { 'daily.size': '5' });
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-prev]')).toBeDisabled();
		await type(page, 'R U');
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-pos]')).toContainText('2 / 5');
		await page.locator('[data-prev]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', 'R U');
		await page.locator('[data-action="undo"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', 'R');
		await expect(page.locator('[data-pos]')).toContainText('입력한 답 1개');
	});

	test('마지막 문제에서만 채점이 서고, 그때 다음은 접힌다', async ({ page }) => {
		await seed(page, { 'daily.size': '5' });
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-grade]')).not.toBeVisible();
		await walk(page);
		await expect(page.locator('[data-grade]')).toBeVisible();
		await expect(page.locator('[data-next]')).not.toBeVisible();
	});

	test('판이 도는 동안 입력 방식을 접고 잠근다', async ({ page }) => {
		await page.goto(DAILY);
		const toggle = page.locator('[data-toggle="daily-input"]');
		await expect(toggle).toBeVisible();
		await page.locator('[data-start]').click();
		await expect(toggle).not.toBeVisible();
		await expect(toggle.locator('[data-option="setup"]')).toBeDisabled();
	});

	test('채점 전에는 정답이 DOM 에 없다', async ({ page }) => {
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		const code = await caseNow(page);
		const html = await page.content();
		expect(html).not.toContain(cases[code].direct.alg);
		await expect(page.locator('[data-verdict]')).toHaveCount(0);
	});

	test('한 번에 채점하고 문제마다 판정을 낸다', async ({ page }) => {
		await seed(page, { 'daily.size': '5' });
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		const first = await caseNow(page);
		await type(page, cases[first].direct.alg);
		await page.locator('[data-next]').click();
		await type(page, 'R');
		await walk(page);
		await page.locator('[data-grade]').click();

		await expect(stage(page)).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-summary]')).toHaveText('5문제 중 1개 정답');
		const rows = page.locator('[data-result-case]');
		await expect(rows).toHaveCount(5);
		await expect(rows.first()).toHaveAttribute('data-result-case', first);
		await expect(rows.first().locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		await expect(rows.nth(1).locator('[data-verdict]')).toHaveAttribute('data-result', 'bad');
		await expect(page.locator('[data-verdict][data-kind="blank"]')).toHaveCount(3);
		// 결과 단계에는 문제·자판이 접히고 누를 진행 버튼이 없다
		await expect(page.locator('[data-case]')).not.toBeVisible();
		await expect(page.locator('[data-move="R"]')).not.toBeVisible();
		for (const b of ['[data-start]', '[data-prev]', '[data-next]', '[data-grade]']) {
			await expect(page.locator(b)).not.toBeVisible();
		}
	});

	test('setup 판은 기준을 고른 것이 답이다', async ({ page }) => {
		const code = allCodes.find((c) => cases[c].setup.anchor !== '(직접)')!;
		await seed(page, {
			'daily.size': '5',
			'ui.quizInput': 'setup',
			'memorize.checked': checked([], distinctCodes(4).concat(code))
		});
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		const seen = [await caseNow(page)];
		while (seen.at(-1) !== code) {
			await page.locator('[data-next]').click();
			seen.push(await caseNow(page));
		}
		const c = cases[code];
		if (c.setup.S) await type(page, c.setup.S);
		const label = c.setup.usesInverse ? `${c.setup.anchor}'` : c.setup.anchor;
		await page.locator(`[data-anchor-pick="${label}"]`).click();
		await expect(page.locator('.entry')).toHaveAttribute('data-picked', label);
		await walk(page);
		await page.locator('[data-grade]').click();
		await expect(
			page.locator(`[data-result-case="${code}"] [data-verdict]`)
		).toHaveAttribute('data-kind', 'correct');
	});

	test('풀다 나갔다 오면 답이 그대로다', async ({ page }) => {
		await seed(page, { 'daily.size': '5' });
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		const first = await caseNow(page);
		await type(page, 'R U');
		await page.reload();
		await expect(stage(page)).toHaveAttribute('data-stage', 'active');
		// 답이 없는 첫 문제부터 연다
		await expect(page.locator('[data-pos]')).toContainText('2 / 5');
		await page.locator('[data-prev]').click();
		expect(await caseNow(page)).toBe(first);
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', 'R U');
	});

	test('같은 날 다시 열면 그날 결과를 보여준다', async ({ page }) => {
		await seed(page, { 'daily.size': '5' });
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		await walk(page);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-summary]')).toHaveText('5문제 중 0개 정답');
		await page.reload();
		await expect(stage(page)).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-result-case]')).toHaveCount(5);
	});

	test('지난 날짜의 판은 버리고 새로 시작한다', async ({ page }) => {
		const old = {
			v: 1,
			date: '2000-01-01',
			mode: 'direct',
			cases: ['AB'],
			answers: [{ moves: [], ref: null }],
			graded: true
		};
		await seed(page, { 'daily.session': JSON.stringify(old) });
		await page.goto(DAILY);
		await expect(stage(page)).toHaveAttribute('data-stage', 'idle');
	});

	test('시작 버튼이 하단 탭에 가리지 않는다 @viewport', async ({ page }) => {
		await page.goto(DAILY);
		const start = page.locator('[data-start]');
		await expect(start).toBeVisible();
		const covered = await start.evaluate((el) => {
			const r = el.getBoundingClientRect();
			const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
			return !(hit && el.contains(hit));
		});
		expect(covered).toBe(false);
	});

	test('진행 버튼이 본문 최하단에 선다 @viewport', async ({ page }) => {
		await page.goto(DAILY);
		await page.locator('[data-start]').click();
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		expect(await y('[data-next]')).toBeGreaterThan(await y('[data-case]'));
		expect(await y('[data-next]')).toBeGreaterThan(await y('[data-move="R"]'));
		const box = (await page.locator('[data-next]').boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
	});
});

test.describe('문제 수 설정 (FR-DQ-1)', () => {
	test('알림 설정에서 5 ~ 20 을 고르고 기기에 남긴다', async ({ page }) => {
		await page.route('**/client.js', (route) =>
			route.fulfill({
				contentType: 'text/javascript',
				body: `window.PushRelay = { async state() { return 'off'; } };`
			})
		);
		await page.goto('/settings/notify');
		const sel = page.locator('[data-daily-size]');
		await expect(sel).toHaveValue('10');
		await expect(sel.locator('option')).toHaveCount(16);
		await sel.selectOption('15');
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('daily.size')))
			.toBe('15');
		await page.goto(DAILY);
		await expect(page.locator('[data-plan]').first()).toContainText('15문제');
	});
});
