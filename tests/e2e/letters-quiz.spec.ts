/**
 * 스티커 문자 — 퀴즈 (#19, PHASE_4_TEST).
 *
 * 문제 큐비는 `data-cubie` 시험 훅으로 읽는다. 정답 문자는 Speffz 표에서 계산한다 —
 * 앱과 같은 함수를 부르지 않고 표를 리터럴로 적는다 (검사가 앱과 같이 틀리지 않게).
 */
import { test, expect, type Page } from '@playwright/test';

const PATH = '/3x3/bld/letters/quiz';
const canvas = 'canvas[data-cube3d]';

/** Speffz 큐비 → 문자. 코너 대문자, 엣지 소문자 (`speffz.ts` 와 대조할 것). */
const ANSWER: Record<string, string[]> = {
	UBL: ['A', 'E', 'R'], UBR: ['B', 'Q', 'N'], UFR: ['C', 'M', 'J'], UFL: ['D', 'I', 'F'],
	DFL: ['U', 'G', 'L'], DFR: ['V', 'K', 'P'], DBR: ['W', 'O', 'T'], DBL: ['X', 'S', 'H'],
	UB: ['a', 'q'], UR: ['b', 'm'], UF: ['c', 'i'], UL: ['d', 'e'],
	FR: ['j', 'p'], FL: ['l', 'f'], BR: ['t', 'n'], BL: ['r', 'h'],
	DF: ['u', 'k'], DR: ['v', 'o'], DB: ['w', 's'], DL: ['x', 'g']
};

async function current(page: Page): Promise<string> {
	const section = page.locator('section[data-cubie]');
	await expect(section).toHaveAttribute('data-cubie', /.+/);
	return (await section.getAttribute('data-cubie'))!;
}

async function enter(page: Page, letters: string[]) {
	for (const l of letters) await page.locator(`[data-pad="letters"] [data-letter="${l}"]`).click();
}

async function pick(page: Page, toggle: string, option: string) {
	await page.locator(`[data-toggle="${toggle}"] [data-option="${option}"]`).click();
}

test.describe('스티커 문자 퀴즈 (#19)', () => {
	test('들어오면 active 이고 채점 버튼이 잠겨 있다', async ({ page }) => {
		await page.goto(PATH);
		await expect(page.locator('section[data-stage]')).toHaveAttribute('data-stage', 'active');
		await expect(page.locator('[data-grade]')).toBeDisabled();
	});

	test('코너는 3개를 다 넣어야 채점할 수 있다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'corner');
		const answer = ANSWER[await current(page)];
		await enter(page, answer.slice(0, 2));
		await expect(page.locator('[data-grade]')).toBeDisabled();
		await enter(page, answer.slice(2));
		await expect(page.locator('[data-grade]')).toBeEnabled();
	});

	test('정답을 거꾸로 넣어도 정답이다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'corner');
		await enter(page, [...ANSWER[await current(page)]].reverse());
		await page.locator('[data-grade]').click();
		const v = page.locator('[data-verdict]');
		await expect(v).toHaveAttribute('data-kind', 'correct');
		await expect(v).toHaveAttribute('data-result', 'ok');
	});

	test('오답이면 정답 문자를 보여준다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'edge');
		const cubie = await current(page);
		const wrong = Object.keys(ANSWER).find((c) => c.length === 2 && c !== cubie)!;
		await enter(page, ANSWER[wrong]);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'wrong');
		await expect(page.locator('[data-answer]')).toHaveAttribute('data-answer', ANSWER[cubie].join(''));
	});

	test('판정 뒤에는 다음 문제만 보이고 누르면 입력이 비워진다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'edge');
		await enter(page, ANSWER[await current(page)]);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-grade]')).toHaveCount(0);
		await page.locator('[data-next]').click();
		await expect(page.locator('section[data-stage]')).toHaveAttribute('data-stage', 'active');
		await expect(page.locator('[data-entry]')).toHaveAttribute('data-entry', '');
	});

	test('다른 큐비 회색: 센터와 문제 큐비만 색이다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'corner');
		await pick(page, 'letters-quiz-others', 'gray');
		await current(page);
		await expect(page.locator(canvas)).toHaveAttribute('data-colored', '9');
		await pick(page, 'letters-quiz-kind', 'edge');
		await current(page);
		await expect(page.locator(canvas)).toHaveAttribute('data-colored', '8');
	});

	test('다른 큐비 색: 54칸이 다 색이고 문제 큐비는 테두리로 표시한다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'corner');
		await pick(page, 'letters-quiz-others', 'color');
		await current(page);
		await expect(page.locator(canvas)).toHaveAttribute('data-colored', '54');
		await expect(page.locator(canvas)).toHaveAttribute('data-marked', '3');
	});

	test('퀴즈에는 글자가 어디에도 없다', async ({ page }) => {
		await page.goto(PATH);
		for (const others of ['gray', 'color']) {
			await pick(page, 'letters-quiz-others', others);
			await current(page);
			await expect(page.locator(canvas)).toHaveAttribute('data-labels', '0');
		}
	});

	test('섞인 큐브에서도 칠한 칸 수가 같다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'corner');
		await pick(page, 'letters-quiz-others', 'gray');
		await pick(page, 'letters-quiz-stage', 'scrambled');
		await current(page);
		await expect(page.locator(canvas)).toHaveAttribute('data-colored', '9');
		await expect(page.locator(canvas)).toHaveAttribute('data-marked', '3');
	});

	test('숨은 조각 안내가 서 있고 원위치 버튼은 없다', async ({ page }) => {
		await page.goto(PATH);
		await expect(page.locator('[data-hidden-hint]')).toBeVisible();
		await expect(page.locator('[data-reset]')).toHaveCount(0);
	});

	test('엣지 패드는 소문자다', async ({ page }) => {
		await page.goto(PATH);
		await pick(page, 'letters-quiz-kind', 'edge');
		await expect(page.locator('[data-pad="letters"] [data-letter="a"]')).toBeVisible();
		await expect(page.locator('[data-pad="letters"] [data-letter="A"]')).toHaveCount(0);
	});

	test('채점 버튼이 본문 최하단에 선다 @viewport', async ({ page }) => {
		await page.goto(PATH);
		await current(page);
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		expect(await y('[data-grade]')).toBeGreaterThan(await y(canvas));
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-pad="letters"]'));
	});
});
