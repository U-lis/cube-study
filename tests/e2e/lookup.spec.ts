import { test, expect } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

interface CaseData {
	setup: { alg: string; anchor: string; S: string; usesInverse?: boolean };
}
const parsed = data as unknown as {
	meta: { anchorLearnOrder?: string[] };
	cases: Record<string, CaseData>;
	anchors: Record<string, { count: number }>;
};
/** 기준 이름·개수·순서는 전부 데이터에서 읽는다. */
const anchorNames = parsed.meta.anchorLearnOrder ?? Object.keys(parsed.anchors);
const refLabel = (c: CaseData) =>
	c.setup.usesInverse ? `${c.setup.anchor}'` : c.setup.anchor;
/** 조건에 맞는 케이스 코드. 데이터가 바뀌어도 테스트가 의미를 유지하게 한다. */
const findCase = (f: (c: CaseData) => boolean) =>
	Object.keys(parsed.cases).find((k) => f(parsed.cases[k]));

const input = (p: import('@playwright/test').Page) => p.getByLabel('케이스 코드');
const result = (p: import('@playwright/test').Page) => p.locator('section.case');

test.describe('조회', () => {
	test('셋업 없는 케이스는 setup+strict 에서 기준공식 이름만 나온다', async ({ page }) => {
		const code = findCase((c) => c.setup.S === '')!;
		const c = parsed.cases[code];
		await page.goto('/');
		await input(page).fill(code);
		await expect(result(page)).toHaveAttribute('data-case', code);
		await expect(page.locator(`[data-anchor="${c.setup.anchor}"]`)).toBeVisible();
		await expect(page.locator('.main .alg')).toHaveText(refLabel(c));
	});

	test('compact 로 전환하면 실제 무브 열이 나온다', async ({ page }) => {
		await page.goto('/?c=LB');
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
		await expect(page.locator('.main .alg')).toHaveText(parsed.cases['LB'].setup.alg);
	});

	test('소문자 입력도 조회된다', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('lb');
		await expect(result(page)).toHaveAttribute('data-case', 'LB');
	});

	test('딥링크 /?c=TU', async ({ page }) => {
		await page.goto('/?c=TU');
		await expect(result(page)).toHaveAttribute('data-case', 'TU');
	});

	test('역 케이스 링크가 이동한다', async ({ page }) => {
		await page.goto('/?c=LB');
		await page.locator('[data-inverse="BL"]').click();
		await expect(result(page)).toHaveAttribute('data-case', 'BL');
	});

	test('기준 없는 케이스는 setup 에서 기준공식 없음 배지', async ({ page }) => {
		// v3 에는 해당 케이스가 없다. 데이터가 다시 담으면 이 검증이 살아난다.
		const code = findCase((c) => c.setup.anchor === '(직접)');
		test.skip(!code, '기준 없는 케이스가 데이터에 없다');
		await page.goto(`/?c=${code}`);
		await expect(page.locator('[data-badge="direct-anchor"]')).toBeVisible();
	});

	test('역방향 케이스는 이름에 프라임이 붙고 뒤집은 무브열을 보여준다', async ({ page }) => {
		const code = findCase((c) => c.setup.usesInverse === true)!;
		const c = parsed.cases[code];
		await page.goto(`/?c=${code}`);
		await expect(page.locator(`[data-anchor="${c.setup.anchor}"]`)).toHaveText(refLabel(c));
		await expect(page.locator('[data-inverse-note]')).toContainText(c.setup.anchor);
	});
});

test.describe('sticky 결과 (FR-4)', () => {
	test('한 글자 지워도 결과가 사라지지 않고 흐려진다', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('LB');
		await expect(result(page)).toBeVisible();
		const before = await result(page).boundingBox();

		await input(page).fill('L');
		await expect(result(page)).toBeVisible();
		await expect(result(page)).toHaveClass(/stale/);
		await expect(result(page)).toHaveAttribute('data-case', 'LB');

		const after = await result(page).boundingBox();
		expect(after!.y).toBe(before!.y); // 레이아웃 점프 없음
	});

	test('한 글자 상태에서 후보 18개', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('L');
		await expect(page.locator('.candidates')).toHaveAttribute('data-count', '18');
	});

	test('새 2글자가 완성되면 결과가 교체되고 stale 이 풀린다', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('LB');
		await input(page).fill('L');
		await input(page).fill('LC');
		await expect(result(page)).toHaveAttribute('data-case', 'LC');
		await expect(result(page)).not.toHaveClass(/stale/);
	});

	/** 다 지우는 것은 "그만 보겠다"는 뜻이라 sticky 예외다 (한 글자만 남으면 stale). */
	test('키보드로 두 글자를 다 지우면 결과가 사라진다', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('LB');
		await expect(result(page)).toBeVisible();

		await input(page).fill('L');
		await expect(result(page)).toHaveClass(/stale/); // 한 글자는 아직 남는다

		await input(page).fill('');
		await expect(result(page)).toHaveCount(0);
		await expect(page.locator('.hint')).toBeVisible();
	});

	test('X 를 눌러도 결과가 사라진다', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('LB');
		await expect(result(page)).toBeVisible();

		await page.locator('[data-action="clear"]').click();
		await expect(result(page)).toHaveCount(0);
		await expect(input(page)).toHaveValue('');
		await expect(page.locator('.hint')).toBeVisible();
	});

	test('치운 뒤 다시 입력하면 결과가 돌아온다', async ({ page }) => {
		await page.goto('/?c=LB');
		await page.locator('[data-action="clear"]').click();
		await expect(result(page)).toHaveCount(0);
		await input(page).fill('TU');
		await expect(result(page)).toHaveAttribute('data-case', 'TU');
		await expect(result(page)).not.toHaveClass(/stale/);
	});

	test('조회 페이지에 들어오면 입력에 커서가 있다', async ({ page }) => {
		await page.goto('/');
		await expect(input(page)).toBeFocused();
		// 키보드 없이 바로 타이핑되는지까지 확인한다
		await page.keyboard.type('LB');
		await expect(result(page)).toHaveAttribute('data-case', 'LB');
	});

	test('다른 화면을 거쳐 돌아와도 커서가 잡힌다', async ({ page }) => {
		await page.goto('/quiz');
		await page.locator('nav a[href="/"]').click();
		await expect(input(page)).toBeFocused();
	});

	test('딥링크로 들어와도 커서가 잡힌다', async ({ page }) => {
		await page.goto('/?c=LB');
		await expect(result(page)).toHaveAttribute('data-case', 'LB');
		await expect(input(page)).toBeFocused();
	});

	test('값이 없으면 X 가 보이지 않는다', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-action="clear"]')).toHaveCount(0);
		await input(page).fill('L');
		await expect(page.locator('[data-action="clear"]')).toBeVisible();
	});
});

test.describe('무효 입력 (FR-5)', () => {
	test('AB 는 버퍼 사유', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('AB');
		await expect(page.locator('[data-reason="buffer"]')).toContainText('버퍼(UBL)');
	});

	test('BN 은 동일 큐비 사유', async ({ page }) => {
		await page.goto('/');
		await input(page).fill('BN');
		await expect(page.locator('[data-reason="same-cubie"]')).toContainText('UBR');
	});

	test('무효 입력에도 직전 결과가 남는다', async ({ page }) => {
		await page.goto('/?c=LB');
		await expect(result(page)).toBeVisible();
		await input(page).fill('BN');
		await expect(result(page)).toHaveAttribute('data-case', 'LB');
		await expect(result(page)).toHaveClass(/stale/);
	});

	test('Speffz 밖 문자는 입력되지 않고 aria-invalid 가 켜진다', async ({ page }) => {
		await page.goto('/');
		await input(page).pressSequentially('Y');
		await expect(input(page)).toHaveValue('');
		await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
	});

	test('숫자도 걸러진다', async ({ page }) => {
		await page.goto('/');
		await input(page).pressSequentially('L1B');
		await expect(input(page)).toHaveValue('LB');
	});
});

test.describe('토글 (FR-9, FR-10)', () => {
	test('strict 는 괄호, compact 는 평문', async ({ page }) => {
		await page.goto('/?c=CI');
		const alg = page.locator('.main .alg');
		await expect(alg).toContainText('[');
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
		await expect(alg).not.toContainText('[');
	});

	test('sameAlg 배지는 compact 에서만', async ({ page }) => {
		const code = Object.keys(parsed.cases).find(
			(k) => (parsed.cases[k] as unknown as { sameAlg: boolean }).sameAlg
		)!;
		await page.goto(`/?c=${code}`);
		await expect(page.locator('[data-badge="same-alg"]')).toHaveCount(0);
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
		await expect(page.locator('[data-badge="same-alg"]')).toBeVisible();
	});

	test('direct/setup 토글', async ({ page }) => {
		const anchor = parsed.cases['CI'].setup.anchor;
		await page.goto('/?c=CI');
		await expect(page.locator(`[data-anchor="${anchor}"]`)).toBeVisible();
		await page.locator('[data-toggle="mode"] [data-option="direct"]').click();
		await expect(page.locator(`[data-anchor="${anchor}"]`)).toHaveCount(0);
		await expect(page.getByText('인서트 (A)')).toBeVisible();
		// 되돌아오기
		await page.locator('[data-toggle="mode"] [data-option="setup"]').click();
		await expect(page.locator(`[data-anchor="${anchor}"]`)).toBeVisible();
	});

	test('두 선택지가 항상 보이고 활성 상태가 표시된다', async ({ page }) => {
		await page.goto('/?c=LB');
		for (const [name, on, off] of [
			['mode', 'setup', 'direct'],
			['notation', 'strict', 'compact']
		] as const) {
			const seg = page.locator(`[data-toggle="${name}"]`);
			await expect(seg.locator(`[data-option="${on}"]`)).toBeVisible();
			await expect(seg.locator(`[data-option="${off}"]`)).toBeVisible();
			await expect(seg.locator(`[data-option="${on}"]`)).toHaveAttribute('aria-pressed', 'true');
			await expect(seg.locator(`[data-option="${off}"]`)).toHaveAttribute('aria-pressed', 'false');
		}
	});

	test('토글 라벨이 의도한 용어로 표시된다', async ({ page }) => {
		await page.goto('/?c=LB');
		const mode = page.locator('[data-toggle="mode"]');
		await expect(mode.locator('[data-option="setup"]')).toHaveText('setup');
		await expect(mode.locator('[data-option="direct"]')).toHaveText('optimized');

		const notation = page.locator('[data-toggle="notation"]');
		await expect(notation.locator('[data-option="strict"]')).toHaveText('structural');
		await expect(notation.locator('[data-option="compact"]')).toHaveText('compact');
	});

	test('라벨이 세그먼트 폭을 넘치지 않는다', async ({ page }) => {
		await page.goto('/?c=LB');
		const over = await page.evaluate(() =>
			[...document.querySelectorAll('.seg button')].some((b) => b.scrollWidth > b.clientWidth)
		);
		expect(over).toBe(false);
	});

	test('각 토글에 설명이 항상 보인다 (hover 없이도)', async ({ page }) => {
		await page.goto('/?c=LB');
		await expect(page.locator('[data-hint="mode"]')).toHaveText('기준공식 + 셋업');
		await expect(page.locator('[data-hint="notation"]')).toHaveText('구조 · 상쇄 전');
		await page.locator('[data-toggle="notation"] [data-option="compact"]').click();
		await expect(page.locator('[data-hint="notation"]')).toHaveText('실행 · 상쇄 후');
	});
});

test.describe('기준공식 브라우저 (FR-11, FR-12)', () => {
	test('기준 목록이 데이터의 학습 순서대로 나온다', async ({ page }) => {
		await page.goto('/anchors');
		await expect(page.locator('[data-anchor]')).toHaveCount(anchorNames.length);
		const counts = await page.locator('[data-count]').allTextContents();
		expect(counts.slice(0, anchorNames.length)).toEqual(
			anchorNames.map((n) => String(parsed.anchors[n].count))
		);
		// 학습 순서는 담당 케이스 많은 순이어야 한다
		const nums = anchorNames.map((n) => parsed.anchors[n].count);
		expect([...nums].sort((a, b) => b - a)).toEqual(nums);
	});

	test('백분율 표기가 없다 (NFR-9)', async ({ page }) => {
		await page.goto('/anchors');
		await expect(page.locator('body')).not.toContainText('%');
	});

	test('기준 클릭 시 담당 케이스 수만큼 나온다', async ({ page }) => {
		const first = anchorNames[0];
		await page.goto('/anchors');
		await page.locator(`[data-anchor="${first}"]`).click();
		await expect(page.locator('[data-count]')).toHaveAttribute(
			'data-count',
			String(parsed.anchors[first].count)
		);
	});

	test('케이스 클릭 시 조회로 이동', async ({ page }) => {
		await page.goto(`/anchors/${anchorNames[0]}`);
		await page.locator('a[href^="/?c="]').first().click();
		await expect(page.locator('section.case')).toBeVisible();
	});
});
