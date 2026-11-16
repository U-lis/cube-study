/**
 * OP 코너 — 퀴즈 (#18, PHASE_3_TEST).
 *
 * `pickNext` 가 Math.random 을 쓰므로 문제를 못 박으려면 pool 을 좁힌다.
 * `op.checked` 에 하나만 심고 `memorizedOnly=true` 를 켜면 그 하나가 나온다 —
 * M2 퀴즈 테스트와 같은 패턴.
 */
import { test, expect, type Page } from '@playwright/test';
import dataJson from '../../src/lib/data/corner-UBL-op.json' with { type: 'json' };

const PATH = '/3x3/bld/op/corner/quiz';
const LOOKUP = '/3x3/bld/op/corner/lookup';

const ds = dataJson as {
	meta: { yPerm: string; swapPiece: string };
	rows: { id: string; letter: string; setup: string; isYRow?: boolean }[];
};
/** 테스트에 쓰는 세 행. */
const Y = ds.rows.find((r) => r.isYRow === true)!;
/** P 행 — setup 이 비고 isYRow 가 없다. 정답이 `[Y]` 단독. */
const P = ds.rows.find((r) => r.setup === '' && !r.isYRow)!;
/** 일반 행 하나. L 은 setup 이 `D` 하나라 입력이 간단하다. */
const L = ds.rows.find((r) => r.id === 'l')!;

/** 공식 문자열. setup 이 있으면 `setup [Y] setup'`, 없으면 `[Y]`. */
function algFor(row: { setup: string; isYRow?: boolean }): string {
	if (row.isYRow) return ds.meta.yPerm;
	if (row.setup === '') return '[Y]';
	// L 은 setup `D` → 역 `D'`.
	return `${row.setup} [Y] ${invertSimple(row.setup)}`;
}

/** 테스트에서 쓰는 간이 역 — 데이터의 setup 은 모두 단일 토큰이거나 두 토큰이다. */
function invertSimple(setup: string): string {
	const toks = setup.split(/\s+/).filter(Boolean);
	const inv = toks.map((t) => {
		if (t.endsWith('2')) return t;
		if (t.endsWith("'")) return t.slice(0, -1);
		return t + "'";
	});
	return inv.reverse().join(' ');
}

/** 지정한 id 하나만 pool 에 두도록 memorizedOnly 를 켠다. 최초 goto 이전에만. */
async function seedOne(page: Page, id: string): Promise<void> {
	await page.addInitScript((only) => {
		localStorage.setItem(
			'op.checked',
			JSON.stringify({ schemaVersion: 1, checked: [only] })
		);
		localStorage.setItem('op.quiz.memorizedOnly', 'true');
	}, id);
}

/** 공식 문자열을 자판 버튼 클릭 시퀀스로 친다. `[Y]` 는 자판의 단일 토큰. */
async function enter(page: Page, alg: string): Promise<void> {
	for (const token of alg.split(/\s+/).filter(Boolean)) {
		await page.locator(`[data-move="${token}"]`).click();
	}
}

test.describe('OP 퀴즈 (#18)', () => {
	test('자판에 [Y] 키가 있다', async ({ page }) => {
		await page.goto(PATH);
		await expect(page.locator('[data-move="\\[Y\\]"]')).toBeVisible();
	});

	test('문제가 뜨면 data-stage 가 active 다', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'active');
	});

	test('Y 행 문제에서 [Y] 키가 비활성화된다', async ({ page }) => {
		await seedOne(page, Y.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-id]')).toHaveAttribute('data-target-id', Y.id);
		await expect(page.locator('[data-move="\\[Y\\]"]')).toBeDisabled();
	});

	test('P 행 문제에서 [Y] 키가 활성화된다', async ({ page }) => {
		// P 행의 정답이 [Y] 단독이라 잠그면 입력할 수 없다 (AD-6).
		await seedOne(page, P.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-id]')).toHaveAttribute('data-target-id', P.id);
		await expect(page.locator('[data-move="\\[Y\\]"]')).toBeEnabled();
	});

	test('정답 공식 입력 → data-result ok, 문구 정답', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-id]')).toHaveAttribute('data-target-id', L.id);

		await enter(page, algFor(L));
		await page.locator('[data-grade]').click();

		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		const verdict = page.locator('[data-verdict]');
		await expect(verdict).toHaveAttribute('data-kind', 'correct');
		await expect(verdict).toHaveAttribute('data-result', 'ok');
		await expect(verdict).toHaveText('정답');
	});

	test('P 행 — [Y] 단독 입력 → 정답', async ({ page }) => {
		await seedOne(page, P.id);
		await page.goto(PATH);
		await page.locator('[data-move="\\[Y\\]"]').click();
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-result', 'ok');
	});

	test('다른 행의 공식 입력 → data-kind other', async ({ page }) => {
		// L 이 문제인데 다른 setup 의 공식을 치면 other 가 나온다.
		await seedOne(page, L.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-id]')).toHaveAttribute('data-target-id', L.id);

		// B 행: setup `R D'` → `R D' [Y] D R'`.
		const B = ds.rows.find((r) => r.id === 'b')!;
		await enter(page, algFor(B));
		await page.locator('[data-grade]').click();

		const verdict = page.locator('[data-verdict]');
		await expect(verdict).toHaveAttribute('data-kind', 'other');
		await expect(verdict).toHaveAttribute('data-result', 'bad');
		await expect(verdict).toContainText(B.letter);
	});

	test('빈 입력에서는 제출 버튼이 꺼져 있다', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		await expect(page.locator('[data-grade]')).toBeDisabled();
		await page.locator('[data-move="R"]').click();
		await expect(page.locator('[data-grade]')).toBeEnabled();
	});

	test('어느 행과도 다른 공식은 bad 다', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		// 한 수만 치면 어느 행과도 다르다 (wrong 또는 other). bad 가 떠야 한다.
		await enter(page, 'R');
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-result', 'bad');
	});

	test('암기한 것만 출제 켜고 아무것도 체크 없으면 빈 풀 안내', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('op.quiz.memorizedOnly', 'true');
			localStorage.setItem('op.checked', JSON.stringify({ schemaVersion: 1, checked: [] }));
		});
		await page.goto(PATH);
		await expect(page.locator('[data-empty-pool]')).toHaveText('암기 표시한 공식이 없습니다');
	});

	test('빈 풀에서 전체로 자동 전환하지 않는다', async ({ page }) => {
		// 전체로 넘어갔다면 문제가 뜬다. 안내만 뜨고 문제는 뜨지 않아야 한다.
		await page.addInitScript(() => {
			localStorage.setItem('op.quiz.memorizedOnly', 'true');
			localStorage.setItem('op.checked', JSON.stringify({ schemaVersion: 1, checked: [] }));
		});
		await page.goto(PATH);
		await expect(page.locator('[data-empty-pool]')).toBeVisible();
		await expect(page.locator('[data-target-id]')).toHaveCount(0);
	});

	test('active 단계에서는 결과 공식이 보이지 않는다', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		await expect(page.locator('[data-answer]')).toHaveCount(0);
	});

	test('result 단계에서 결과 공식이 뜨고 조회 화면 링크가 있다', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		await enter(page, algFor(L));
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-answer]')).toBeVisible();
		await expect(page.locator('[data-goto-lookup]')).toHaveAttribute('href', LOOKUP);
	});

	test('다음 문제 버튼을 누르면 다시 active 로 돌아간다', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		await enter(page, algFor(L));
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'active');
	});

	test('Y 행 문제에서 자리 문구는 Y-perm 이다', async ({ page }) => {
		await seedOne(page, Y.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-place]')).toHaveText('Y-perm');
	});

	test('진행 버튼이 화면 최하단에 있다 @viewport', async ({ page }) => {
		await seedOne(page, L.id);
		await page.goto(PATH);
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-target-id]'));
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-move="R"]'));
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-move="\\[Y\\]"]'));
	});

	test('자판의 [Y] 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto(PATH);
		const b = (await page.locator('[data-move="\\[Y\\]"]').boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
	});
});
