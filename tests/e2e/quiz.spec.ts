import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

interface CaseData {
	direct: { alg: string };
	setup: { alg: string; anchor: string; S: string; usesInverse?: boolean };
}
const parsed = data as unknown as {
	meta: { anchorLearnOrder?: string[] };
	cases: Record<string, CaseData>;
	anchors: Record<string, { alg: string }>;
};
const cases = parsed.cases;
/** 기준 이름·개수는 전부 데이터에서 읽는다. 테스트에 박아두지 않는다. */
const anchorNames = parsed.meta.anchorLearnOrder ?? Object.keys(parsed.anchors);
/** 화면 버튼 라벨과 같은 규칙: 역방향이면 프라임을 붙인다. */
const refLabel = (name: string, inverse: boolean) => (inverse ? `${name}'` : name);
const caseRefLabel = (code: string) =>
	refLabel(cases[code].setup.anchor, cases[code].setup.usesInverse === true);

/** 키패드로 알고리즘을 입력한다. */
async function type(page: Page, alg: string) {
	for (const mv of alg.trim().split(/\s+/)) {
		await page.locator(`[data-move="${mv}"]`).click();
	}
}

async function currentCase(page: Page): Promise<string> {
	const h = page.locator('h1[data-case]');
	await expect(h).toBeVisible();
	return (await h.getAttribute('data-case'))!;
}

/** 입력 방식 전환. 기본값은 direct 다. */
async function setInput(page: Page, mode: 'direct' | 'setup') {
	await page.locator(`[data-toggle="quiz-input"] [data-option="${mode}"]`).click();
	await expect(page.locator('[data-toggle="quiz-input"]')).toHaveAttribute('data-value', mode);
}

/** 기준을 쓰는 케이스가 나올 때까지 다시 뽑는다. (직접) 케이스는 setup 으로 못 푼다. */
async function anchoredCase(page: Page): Promise<string> {
	for (let i = 0; i < 30; i++) {
		const code = await currentCase(page);
		if (cases[code].setup.anchor !== '(직접)') return code;
		await page.reload();
	}
	throw new Error('기준 케이스가 뽑히지 않았다');
}

test.describe('퀴즈 출제 (FR-16)', () => {
	test('케이스 코드와 타깃 2개가 표시된다', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		expect(code).toMatch(/^[A-X]{2}$/);
		await expect(page.locator('.targets span')).toHaveCount(2);
	});

	test('판정 전에는 정답이 DOM 에 없다', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		const html = await page.content();
		expect(html).not.toContain(cases[code].direct.alg);
		expect(html).not.toContain(cases[code].setup.alg);
		await expect(page.locator('.answer')).toHaveCount(0);
	});

	test('다음 문제를 누르면 다른 케이스가 나온다', async ({ page }) => {
		await page.goto('/quiz');
		const first = await currentCase(page);
		await type(page, "R U R' U'");
		await page.locator('[data-action="submit"]').click();
		await page.locator('[data-action="next"]').click();
		expect(await currentCase(page)).not.toBe(first);
	});
});

test.describe('무브 입력 (FR-17)', () => {
	test('18개 버튼이 모두 있고 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto('/quiz');
		const btns = page.locator('[data-move]');
		await expect(btns).toHaveCount(18);
		for (let i = 0; i < 18; i++) {
			const box = await btns.nth(i).boundingBox();
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('입력한 무브가 공백으로 구분되어 표시된다', async ({ page }) => {
		await page.goto('/quiz');
		await type(page, "R U' D2");
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', "R U' D2");
		expect(await page.locator('.entry .alg').innerText()).toBe("R U' D2");
	});

	test('되돌리기와 전체 지우기', async ({ page }) => {
		await page.goto('/quiz');
		await type(page, 'R U F');
		await page.locator('[data-action="undo"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', 'R U');
		await page.locator('[data-action="clear"]').click();
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', '');
	});

	test('빈 상태에서는 되돌리기·제출이 비활성', async ({ page }) => {
		await page.goto('/quiz');
		await expect(page.locator('[data-action="undo"]')).toBeDisabled();
		await expect(page.locator('[data-action="clear"]')).toBeDisabled();
		await expect(page.locator('[data-action="submit"]')).toBeDisabled();
	});
});

test.describe('판정 (FR-18)', () => {
	test('정답 입력 시 correct 와 정답 공개', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict="correct"]')).toHaveText('정답');
		await expect(page.locator('.answer')).toBeVisible();
	});

	test('setup 알고리즘도 정답 처리', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		await type(page, cases[code].setup.alg);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict="correct"]')).toBeVisible();
	});

	test('sexy move 는 3-cycle 이 아니라는 오답', async ({ page }) => {
		await page.goto('/quiz');
		await type(page, "R U R' U'");
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict="wrong"]')).toContainText('3-cycle이 아닙니다');
	});

	test('엣지를 건드리면 부분 정답', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		// Ua-perm 은 코너 무영향 + 엣지 3-cycle 이고 R/U 만 쓰므로 18버튼으로 입력된다.
		// 정답 알고리즘 앞에 붙이면 코너는 정답, 엣지만 오염된다.
		const UA_PERM = "R U' R U R U R U' R' U' R2";
		await type(page, `${UA_PERM} ${cases[code].direct.alg}`);
		await page.locator('[data-action="submit"]').click();
		await expect(page.locator('[data-verdict="edge-dirty"]')).toContainText(
			'코너는 맞지만 엣지를 건드립니다'
		);
		await expect(page.locator('[data-verdict="edge-dirty"]')).toContainText('UF');
	});

	test('조회 화면 링크가 해당 케이스로 이동한다', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		await page.locator(`[data-goto="${code}"]`).click();
		await expect(page.locator('section.case')).toHaveAttribute('data-case', code);
	});
});

test.describe('NFR-9 톤', () => {
	test('정답 시 축하·격려 문구가 없다', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		await type(page, cases[code].direct.alg);
		await page.locator('[data-action="submit"]').click();
		const body = await page.locator('body').innerText();
		expect(body).not.toMatch(/축하|훌륭|잘했|대단|힘내|다시 도전/);
		expect(await page.locator('[data-verdict]').innerText()).toBe('정답');
	});

	test('연속 정답 카운터·배지가 없다', async ({ page }) => {
		await page.goto('/quiz');
		const body = await page.locator('body').innerText();
		expect(body).not.toMatch(/연속|스트릭|점수|정답률|%/);
	});
});

test.describe('setup 입력 방식', () => {
	test('입력 방식 토글이 있고 기본은 direct', async ({ page }) => {
		await page.goto('/quiz');
		await expect(page.locator('[data-toggle="quiz-input"]')).toHaveAttribute('data-value', 'direct');
		await expect(page.locator('[data-action="submit"]')).toBeVisible();
		await expect(page.locator('[data-anchor-pick]')).toHaveCount(0);
	});

	test('setup 으로 바꾸면 기준 버튼이 제출 버튼을 대신한다 @viewport', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		// 기준마다 정·역 두 칸이다. 개수는 데이터가 정한다.
		const expected = anchorNames.length * 2;
		const btns = page.locator('[data-anchor-pick]');
		await expect(btns).toHaveCount(expected);
		await expect(page.locator('[data-action="submit"]')).toHaveCount(0);
		// 셋업 무브 입력이 필요하므로 18버튼 키패드는 그대로 남는다
		await expect(page.locator('[data-move]')).toHaveCount(18);
		for (let i = 0; i < expected; i++) {
			const box = await btns.nth(i).boundingBox();
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('기준마다 정방향·역방향 버튼이 데이터 순서대로 있다', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		const labels = await page.locator('[data-anchor-pick]').evaluateAll((els) =>
			els.map((e) => e.getAttribute('data-anchor-pick'))
		);
		expect(labels).toEqual(anchorNames.flatMap((n) => [n, `${n}'`]));
	});

	test('판정 전 DOM 에 기준 알고리즘이 없다 (버튼은 이름만)', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		const html = await page.content();
		for (const [name, a] of Object.entries(parsed.anchors)) {
			await expect(page.locator(`[data-anchor-pick="${name}"]`)).toHaveText(name);
			expect(html).not.toContain(a.alg);
		}
	});

	test('셋업 입력 후 기준을 고르면 제출 없이 바로 판정된다', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		const code = await anchoredCase(page);
		const { S } = cases[code].setup;
		if (S) await type(page, S);
		await page.locator(`[data-anchor-pick="${caseRefLabel(code)}"]`).click();
		await expect(page.locator('[data-verdict="correct"]')).toHaveText('정답');
		await expect(page.locator('.answer')).toBeVisible();
	});

	test('입력창에 셋업과 기준이 함께, 기준만 다른 색으로 표시된다', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		const code = await anchoredCase(page);
		const { S } = cases[code].setup;
		const label = caseRefLabel(code);
		if (S) await type(page, S);
		await page.locator(`[data-anchor-pick="${label}"]`).click();

		const entry = page.locator('.entry');
		await expect(entry).toHaveAttribute('data-alg', S);
		await expect(entry).toHaveAttribute('data-picked', label);
		expect(await entry.locator('.alg').innerText()).toBe(S ? `${S} ${label}` : label);

		const anchorTok = entry.locator('.alg .anchor');
		await expect(anchorTok).toHaveText(label);
		if (S) {
			const mvColor = await entry
				.locator('.alg .mv')
				.first()
				.evaluate((el) => getComputedStyle(el).color);
			const anColor = await anchorTok.evaluate((el) => getComputedStyle(el).color);
			expect(anColor).not.toBe(mvColor);
		}
	});

	test('틀린 기준을 고르면 정답이 아니다', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		const code = await anchoredCase(page);
		const wrong = anchorNames.find((n) => n !== cases[code].setup.anchor)!;
		await page.locator(`[data-anchor-pick="${wrong}"]`).click();
		await expect(page.locator('[data-verdict]')).toBeVisible();
		await expect(page.locator('[data-verdict="correct"]')).toHaveCount(0);
	});

	/** 방향이 틀리면 다른 케이스를 푸는 알고리즘이 된다. 관대하게 채점하지 않는다. */
	test('맞는 기준이라도 방향이 반대면 정답이 아니다', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		const code = await anchoredCase(page);
		const { S, anchor, usesInverse } = cases[code].setup;
		if (S) await type(page, S);
		await page.locator(`[data-anchor-pick="${refLabel(anchor, !usesInverse)}"]`).click();
		await expect(page.locator('[data-verdict]')).toBeVisible();
		await expect(page.locator('[data-verdict="correct"]')).toHaveCount(0);
	});

	test('입력 방식을 바꾸면 문제는 그대로, 입력만 비워진다', async ({ page }) => {
		await page.goto('/quiz');
		const code = await currentCase(page);
		await type(page, 'R U');
		await setInput(page, 'setup');
		expect(await currentCase(page)).toBe(code);
		await expect(page.locator('.entry')).toHaveAttribute('data-alg', '');
		await expect(page.locator('.entry')).toHaveAttribute('data-picked', '');
	});

	test('선택한 입력 방식이 새로고침 후에도 유지된다', async ({ page }) => {
		await page.goto('/quiz');
		await setInput(page, 'setup');
		await page.reload();
		await expect(page.locator('[data-toggle="quiz-input"]')).toHaveAttribute('data-value', 'setup');
		await expect(page.locator('[data-anchor-pick]')).toHaveCount(anchorNames.length * 2);
	});
});
