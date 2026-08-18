/**
 * 0.4.1 — 출제 분포와 판정 시인성.
 *
 * 색값 자체는 검사하지 않는다. 토큰이 바뀔 때마다 테스트를 고치게 되고, 그러면
 * 테스트가 디자인을 잠근다. 대신 "정답과 오답이 서로 다르게, 그리고 판정 전과도
 * 다르게 칠해지는가" 만 본다 — 그것이 이 기능의 요구다.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const parsed = data as unknown as {
	cases: Record<string, { direct: { alg: string }; inverse: string }>;
};
const cases = parsed.cases;

async function type(page: Page, alg: string) {
	for (const mv of alg.trim().split(/\s+/)) await page.locator(`[data-move="${mv}"]`).click();
}
async function currentCase(page: Page): Promise<string> {
	const h = page.locator('h1[data-case]');
	await expect(h).toBeVisible();
	return (await h.getAttribute('data-case'))!;
}
const bg = (page: Page) =>
	page.locator('.entry').evaluate((el) => getComputedStyle(el).backgroundColor);

/**
 * 퀴즈를 열고 색 전환을 끈다.
 *
 * `.entry` 의 배경색에 120ms 전환이 걸려 있어서, data-result 가 바뀐 직후에 읽으면
 * 전환 중간값이 잡힌다 — CI 에서 오답 색이 정답 색과 같게 읽혀 실제로 깨졌다.
 * 여기서 확인할 것은 전환 과정이 아니라 도착한 색이다.
 *
 * `test.use({ reducedMotion: 'reduce' })` 로도 되어야 할 것 같지만 이 환경에서는
 * `matchMedia('(prefers-reduced-motion: reduce)')` 가 false 로 나온다. 에뮬레이션에
 * 기대지 않고 스타일로 직접 끈다. 앱의 prefers-reduced-motion 처리는 그대로 둔다.
 */
async function openQuiz(page: Page) {
	await page.goto('/quiz');
	await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
}

test.describe('판정 시인성', () => {

	test('판정 전 입력창에는 결과 표시가 없다', async ({ page }) => {
		await openQuiz(page);
		await currentCase(page);
		await expect(page.locator('.entry')).toHaveAttribute('data-result', '');
	});

	test('정답이면 입력창이 ok 로 칠해진다', async ({ page }) => {
		await openQuiz(page);
		const code = await currentCase(page);
		const before = await bg(page);
		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict="correct"]')).toBeVisible();
		await expect(page.locator('.entry')).toHaveAttribute('data-result', 'ok');
		expect(await bg(page)).not.toBe(before);
	});

	test('오답이면 입력창이 bad 로 칠해지고 정답과 다른 색이다', async ({ page }) => {
		await openQuiz(page);
		const code = await currentCase(page);

		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-result', 'ok');
		const okBg = await bg(page);

		// 다음 문제에서 확실한 오답(sexy move)을 넣는다
		await page.locator('[data-action="next"]').click();
		const beforeBg = await bg(page);
		await type(page, "R U R' U'");
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-result', 'bad');
		const badBg = await bg(page);

		expect(badBg).not.toBe(okBg);
		expect(badBg).not.toBe(beforeBg);
	});

	test('다음 문제로 넘어가면 색이 판정 전으로 돌아간다', async ({ page }) => {
		await openQuiz(page);
		const code = await currentCase(page);
		const before = await bg(page);
		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-result', 'ok');
		await page.locator('[data-action="next"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-result', '');
		expect(await bg(page)).toBe(before);
	});

	test('설명 줄의 자리와 문구는 그대로다', async ({ page }) => {
		await openQuiz(page);
		const code = await currentCase(page);
		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('.verdict')).toHaveText('정답');
	});
});

test.describe('출제 분포 (최근 20개 제외)', () => {
	test('연속 40문항 동안 최근 20개 안에서 같은 케이스가 다시 나오지 않는다', async ({
		page
	}) => {
		test.slow();
		await page.goto('/quiz');
		const drawn: string[] = [];
		for (let i = 0; i < 40; i++) {
			const code = await currentCase(page);
			expect(drawn.slice(-20)).not.toContain(code);
			drawn.push(code);
			// 판정 없이 넘기려면 아무 입력이나 넣고 제출해야 한다
			await type(page, 'R');
			await page.locator('[data-action="submit"]').click();
			await page.locator('[data-action="next"]').click();
		}
		// 21칸 이상 떨어진 재출현은 막지 않는다 — 그것까지 막으면 남은 후보를 역산할 수
		// 있게 된다. 여기서 세는 것은 40개가 실제로 뽑혔다는 것뿐이다.
		expect(drawn).toHaveLength(40);
		expect(new Set(drawn).size).toBeGreaterThanOrEqual(21);
	});

	test('역케이스도 최근 20개 안에서는 다시 안 나온다', async ({ page }) => {
		test.slow();
		await page.goto('/quiz');
		const drawn: string[] = [];
		for (let i = 0; i < 40; i++) {
			const code = await currentCase(page);
			// 코드가 달라도 역케이스는 답이 서로의 뒤집기라 사실상 같은 문제다
			expect(drawn.slice(-20).map((c) => cases[c].inverse)).not.toContain(code);
			drawn.push(code);
			await type(page, 'R');
			await page.locator('[data-action="submit"]').click();
			await page.locator('[data-action="next"]').click();
		}
	});
});
