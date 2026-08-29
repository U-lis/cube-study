import { test, expect } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const cases = (
	data as unknown as {
		cases: Record<
			string,
			{
				direct: { A: string; B: string; S: string };
				setup: { alg: string; anchor: string; S: string; usesInverse?: boolean };
			}
		>;
	}
).cases;
const setupOf = (code: string) => cases[code].setup;
const directOf = (code: string) => cases[code].direct;

/**
 * NFR-4 / NFR-5 — 표기 렌더 무결성.
 * 화면에 보이는 것이 아니라 "복사했을 때 무엇이 나오는가"를 검증한다.
 */
test.describe('알고리즘 표기', () => {
	test('무브 사이 공백이 텍스트에 실제로 존재한다', async ({ page }) => {
		await page.goto('/3x3/bld/3style/corner/lookup?c=LB');
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click(); // compact 로
		const text = await page.locator('.main .alg').innerText();
		expect(text).toBe(setupOf('LB').alg);
	});

	test('프라임이 ASCII U+0027 이다', async ({ page }) => {
		await page.goto('/3x3/bld/3style/corner/lookup?c=LB');
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
		const text = await page.locator('.main .alg').innerText();
		expect(text).toContain("'");
		expect(text).not.toMatch(/[‘’ʼ]/);
		const idx = text.indexOf("'");
		expect(text.charCodeAt(idx)).toBe(39);
	});

	test('setup strict 는 [S : anchor] 형태', async ({ page }) => {
		const s = setupOf('CI');
		await page.goto('/3x3/bld/3style/corner/lookup?c=CI');
		expect(await page.locator('.main .alg').innerText()).toBe(
			`[ ${s.S} : ${s.anchor}${s.usesInverse ? "'" : ''} ]`
		);
	});

	test('direct strict 는 [S : [A , B]] 형태', async ({ page }) => {
		await page.goto('/3x3/bld/3style/corner/lookup?c=CI');
		await page.locator('[data-toggle="mode"] [data-option="direct"]').click();
		await expect(page.locator('[data-toggle="mode"]')).toHaveAttribute('data-value', 'direct');
		// 기대값을 박아두지 않는다 — 0.3.1 의 L 표기 교정 때 이 줄만 홀로 틀렸다.
		const d = directOf('CI');
		expect(await page.locator('.main .alg').innerText()).toBe(
			`[ ${d.S} : [ ${d.A} , ${d.B} ] ]`
		);
	});

	test('무브가 중간에서 줄바꿈되지 않는다 @viewport', async ({ page }) => {
		// 가장 긴 실행형을 좁은 화면에 놓는다. strict/setup 은 무브 파트가 셋업뿐이라
		// 길이가 안 나오므로 compact 로 본다.
		const longest = Object.keys(cases).reduce((a, b) =>
			setupOf(a).alg.length >= setupOf(b).alg.length ? a : b
		);
		await page.setViewportSize({ width: 320, height: 700 });
		await page.goto(`/3x3/bld/3style/corner/lookup?c=${longest}`);
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
		const spans = page.locator('.main .alg .mv');
		await expect(spans.first()).toBeVisible();
		expect(await spans.count()).toBeGreaterThan(8);

		// 한 번에 측정한다. 개별 boundingBox 호출은 렌더 타이밍에 민감해 flaky 해진다.
		const info = await spans.evaluateAll((els) =>
			els.map((e) => ({
				h: e.getBoundingClientRect().height,
				ws: getComputedStyle(e).whiteSpace
			}))
		);
		// 모든 토큰이 nowrap 이고 높이가 동일해야 한다 (= 각자 한 줄 안에 있다)
		expect(info.every((x) => x.ws === 'nowrap')).toBe(true);
		const heights = info.map((x) => x.h);
		expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
	});

	test('여러 케이스에서 공백 구분이 유지된다', async ({ page }) => {
		for (const code of ['TU', 'SC', 'NG', 'CU', 'FS']) {
			await page.goto(`/3x3/bld/3style/corner/lookup?c=${code}`);
			await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
			const text = await page.locator('.main .alg').innerText();
			// 무브가 2개 이상이면 공백이 있어야 한다
			const tokens = text.trim().split(/\s+/);
			if (tokens.length > 1) expect(text).toMatch(/\s/);
			// 토큰은 구두점 / 무브 / 기준공식 이름(2글자) 중 하나여야 한다
			for (const t of tokens) expect(t).toMatch(/^[[\],:\]]$|^[ULFRBDMES]['2]?$|^[A-X]{2}$/);
		}
	});
});
