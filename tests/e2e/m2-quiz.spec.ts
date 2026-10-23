/**
 * M2 엣지 — 퀴즈 (#17, PHASE_2_TEST).
 *
 * `pickNext` 가 Math.random 을 쓰므로 문제를 못 박으려면 pool 을 좁힌다.
 * `m2.checked` 에 하나만 심고 `memorizedOnly=true` 를 켜면 그 하나가 나온다 —
 * 데이터 리터럴을 테스트에 적지 않는다 (memorize-checkbox.spec.ts 방식).
 */
import { test, expect, type Page } from '@playwright/test';
import dataJson from '../../src/lib/data/edge-DF-m2.json' with { type: 'json' };

const PATH = '/3x3/bld/m2/edge/quiz';
const LOOKUP = '/3x3/bld/m2/edge/lookup';

const ds = dataJson as {
	rows: { id: string; letter: string; alg: string; order: 'odd' | 'even' | null }[];
	parity: { id: string; alg: string };
};
/** 테스트에 쓰는 두 행. `a` 는 M2 하나로 끝나는 짧은 공식이라 입력이 간단하다. */
const A = ds.rows.find((r) => r.id === 'a')!;
const B = ds.rows.find((r) => r.id === 'b')!;

/** 지정한 id 하나만 pool 에 두도록 memorizedOnly 를 켠다. 최초 goto 이전에만. */
async function seedOne(page: Page, id: string): Promise<void> {
	await page.addInitScript((only) => {
		localStorage.setItem(
			'm2.checked',
			JSON.stringify({ schemaVersion: 1, checked: [only] })
		);
		localStorage.setItem('m2.quiz.memorizedOnly', 'true');
	}, id);
}

/** 공식 문자열을 자판 버튼 클릭 시퀀스로 친다. */
async function enter(page: Page, alg: string): Promise<void> {
	for (const token of alg.split(/\s+/).filter(Boolean)) {
		await page.locator(`[data-move="${token}"]`).click();
	}
}

test.describe('M2 퀴즈 (#17)', () => {
	test('자판에 M, l, r 키가 있다', async ({ page }) => {
		await page.goto(PATH);
		for (const token of ['M', "M'", 'M2', 'l', "l'", 'r', "r'"]) {
			await expect(page.locator(`[data-move="${token}"]`), token).toBeVisible();
		}
	});

	test('면 18개 키는 그대로 있다', async ({ page }) => {
		await page.goto(PATH);
		for (const face of ['U', 'L', 'F', 'R', 'B', 'D']) {
			for (const sfx of ['', "'", '2']) {
				await expect(page.locator(`[data-move="${face + sfx}"]`), face + sfx).toBeVisible();
			}
		}
	});

	test('문제가 뜨면 data-stage 가 active 다', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'active');
	});

	test('정답 공식 입력 → data-result ok, 문구 정답', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-id]')).toHaveAttribute('data-target-id', A.id);

		await enter(page, A.alg);
		await page.locator('[data-grade]').click();

		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		const verdict = page.locator('[data-verdict]');
		await expect(verdict).toHaveAttribute('data-kind', 'correct');
		await expect(verdict).toHaveAttribute('data-result', 'ok');
		await expect(verdict).toHaveText('정답');
	});

	test('다른 행의 공식 입력 → data-kind other', async ({ page }) => {
		// A 가 문제인데 B 의 공식을 치면 other (B 라벨) 가 나온다.
		await seedOne(page, A.id);
		await page.goto(PATH);
		await expect(page.locator('[data-target-id]')).toHaveAttribute('data-target-id', A.id);

		await enter(page, B.alg);
		await page.locator('[data-grade]').click();

		const verdict = page.locator('[data-verdict]');
		await expect(verdict).toHaveAttribute('data-kind', 'other');
		await expect(verdict).toHaveAttribute('data-result', 'bad');
		await expect(verdict).toContainText(B.letter.toUpperCase());
		await expect(verdict).toContainText('의 공식입니다');
	});

	test('빈 입력에서는 제출 버튼이 꺼져 있다', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		await expect(page.locator('[data-grade]')).toBeDisabled();
		await page.locator('[data-move="R"]').click();
		await expect(page.locator('[data-grade]')).toBeEnabled();
	});

	test('어느 행과도 다른 공식은 wrong 이다', async ({ page }) => {
		// 자판 안의 토큰만으로는 invalid-move 를 유발할 수 없다. 그 분기는 유닛이 본다.
		// 여기는 자판으로 만들 수 있는 세 분기(correct·other·wrong) 중 wrong 을 본다.
		await seedOne(page, A.id);
		await page.goto(PATH);
		// R U R' U' 는 어느 행과도 다르다 (D-8 과 같은 분기).
		await enter(page, "R U R' U'");
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'wrong');
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-result', 'bad');
	});

	test('암기한 것만 출제 켜고 아무것도 체크 없으면 빈 풀 안내', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('m2.quiz.memorizedOnly', 'true');
			localStorage.setItem('m2.checked', JSON.stringify({ schemaVersion: 1, checked: [] }));
		});
		await page.goto(PATH);
		await expect(page.locator('[data-empty-pool]')).toHaveText('암기 표시한 공식이 없습니다');
		// 전체로 자동 전환하지 않는다 — 문제가 뜨지 않아야 한다.
		await expect(page.locator('[data-target-id]')).toHaveCount(0);
	});

	test('active 단계에서는 결과 공식이 보이지 않는다', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		await expect(page.locator('[data-answer]')).toHaveCount(0);
	});

	test('result 단계에서 결과 공식이 뜨고 조회 화면 링크가 있다', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		await enter(page, A.alg);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-answer]')).toBeVisible();
		await expect(page.locator('[data-goto-lookup]')).toHaveAttribute('href', LOOKUP);
	});

	test('다음 문제 버튼을 누르면 다시 active 로 돌아간다', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		await enter(page, A.alg);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'active');
	});

	test('진행 버튼이 화면 최하단에 있다 @viewport', async ({ page }) => {
		await seedOne(page, A.id);
		await page.goto(PATH);
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		// 문제 → 입력칸 → 자판 → 진행 버튼. 버튼이 그중 무엇보다도 위에 서지 않는다.
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-target-id]'));
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-move="R"]'));
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-move="M"]'));
	});

	test('자판의 추가 줄 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto(PATH);
		for (const token of ['M', 'l', 'r']) {
			const b = (await page.locator(`[data-move="${token}"]`).boundingBox())!;
			expect(b.height, token).toBeGreaterThanOrEqual(44);
		}
	});
});
