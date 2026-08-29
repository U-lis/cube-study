/**
 * Phase 5 — 퀴즈 "암기한 것만" E2E (FR-MC-18, 19, 20).
 *
 * 케이스 코드·기준 이름을 코드에 박지 않는다. 데이터에서 뽑아 쓴다
 * (memorize-checkbox.spec.ts:9-15, memorize-hide.spec.ts:8-14 방식).
 * v2→v3 에서 기준이 10→6 개로 바뀐 전례가 있고 리터럴을 박으면 같은 사고에서
 * 테스트만 조용히 무의미해진다.
 */
import { test, expect, type Page } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

interface CaseData {
	direct: { alg: string };
	setup: { anchor: string };
}
const parsed = data as unknown as {
	cases: Record<string, CaseData>;
	anchors: Record<string, { alg: string }>;
};

const allCodes = Object.keys(parsed.cases);

/**
 * 초기 상태로 memorize.checked 를 심는다. addInitScript 는 반드시 goto 이전에.
 * 초기 로드 시 memorize.svelte.ts 가 이 값을 그대로 읽어 setupChecked ·
 * directChecked 를 채운다.
 */
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

/** quizInput 을 미리 세팅한 채 페이지를 연다. */
async function seedQuizInput(page: Page, mode: 'direct' | 'setup'): Promise<void> {
	await page.addInitScript((m) => {
		localStorage.setItem('ui.quizInput', m);
	}, mode);
}

/** memorizedOnly 를 미리 세팅한 채 페이지를 연다. */
async function seedMemorizedOnly(page: Page, on: boolean): Promise<void> {
	await page.addInitScript((v) => {
		localStorage.setItem('quiz.memorizedOnly', v);
	}, on ? 'true' : 'false');
}

/** 현재 화면의 케이스 코드. [data-case] 가 반드시 렌더된 상태여야 한다. */
async function currentCase(page: Page): Promise<string> {
	const h = page.locator('[data-case]');
	await expect(h).toBeVisible();
	return (await h.getAttribute('data-case'))!;
}

/**
 * 다음 문제로 강제 이동. 채점 후에만 "다음" 버튼이 뜨므로 어느 입력 방식이든
 * 우선 verdict 를 만든다. direct 는 무브 하나 → 제출, setup 은 첫 앵커 클릭.
 * 오답이라도 verdict 만 뜨면 "다음" 이 활성화된다.
 */
async function nextViaSubmit(page: Page): Promise<void> {
	const mode = await page
		.locator('[data-toggle="quiz-input"]')
		.getAttribute('data-value');
	if (mode === 'setup') {
		// 아무 앵커 하나 → grade 가 무조건 실행되고 verdict 가 뜬다
		await page.locator('[data-anchor-pick]').first().click();
	} else {
		await page.locator('[data-move="R"]').click();
		await page.locator('[data-grade]').click();
	}
	await page.locator('[data-next]').click();
}

/** 여러 회 출제하며 나온 케이스 코드 집합을 모은다. */
async function collectCases(page: Page, rounds: number): Promise<Set<string>> {
	const seen = new Set<string>();
	seen.add(await currentCase(page));
	for (let i = 1; i < rounds; i++) {
		await nextViaSubmit(page);
		seen.add(await currentCase(page));
	}
	return seen;
}

/** 안내가 렌더된 뒤 조작하는 편이 안전하다. */
async function toggleReady(page: Page): Promise<void> {
	await expect(page.locator('[data-memorized-only-input]')).toBeVisible();
}

test.describe('T5-1. 토글 존재 및 기본값 (FR-MC-18)', () => {
	test('localStorage 없음 → 토글 렌더, OFF, 저장·복원', async ({ page }) => {
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);
		const input = page.locator('[data-memorized-only-input]');

		// 초기: OFF
		await expect(input).not.toBeChecked();
		// 초기값 저장이 $effect 로 걸리면 "false" 가 들어가고, 아직 아무 것도 안
		// 건드렸으면 항목이 없을 수도 있다. 둘 다 허용.
		const initial = await page.evaluate(() =>
			localStorage.getItem('quiz.memorizedOnly')
		);
		expect(initial === null || initial === 'false').toBe(true);

		// ON → "true"
		await input.click();
		await expect(input).toBeChecked();
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('quiz.memorizedOnly')))
			.toBe('true');

		// 새로고침 → ON 복원
		await page.reload();
		await toggleReady(page);
		await expect(page.locator('[data-memorized-only-input]')).toBeChecked();

		// OFF → "false"
		await page.locator('[data-memorized-only-input]').click();
		await expect(page.locator('[data-memorized-only-input]')).not.toBeChecked();
		await expect
			.poll(() => page.evaluate(() => localStorage.getItem('quiz.memorizedOnly')))
			.toBe('false');
	});
});

test.describe('T5-2. 토글 OFF — 전체 출제 유지 (FR-MC-18)', () => {
	test('checked 목록이 있어도 OFF 이면 전체에서 뽑는다', async ({ page }) => {
		// 딱 한 케이스만 direct 로 체크. OFF 상태에서는 필터가 걸리면 안 된다.
		const single = allCodes[0];
		await seedChecked(page, [], [single]);
		await seedQuizInput(page, 'direct');
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);
		await expect(page.locator('[data-memorized-only-input]')).not.toBeChecked();

		// 20회 뽑아 단 한 코드로만 이뤄지는지 확인. 전체 pool 이면 사실상 다른
		// 코드가 반드시 섞인다.
		const seen = await collectCases(page, 20);
		expect(seen.size).toBeGreaterThan(1);
	});
});

test.describe('T5-3. direct 모드 토글 ON — pool 제한 (FR-MC-19)', () => {
	test('30회 출제가 모두 checked.direct 목록 안 (자기 제외 로직 안 걸리게 3개)', async ({
		page
	}) => {
		const picks = allCodes.slice(0, 3);
		await seedChecked(page, [], picks);
		await seedQuizInput(page, 'direct');
		await seedMemorizedOnly(page, true);
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);

		await expect(page.locator('[data-empty-pool]')).toHaveCount(0);
		await expect(page.locator('[data-memorized-only-input]')).toBeChecked();

		const seen = await collectCases(page, 30);
		for (const code of seen) {
			expect(picks, `${code} 은 주입 목록 밖`).toContain(code);
		}
	});
});

test.describe('T5-4. quizInput 전환 시 pool 즉시 갱신 (FR-MC-19)', () => {
	test('direct → setup → direct 를 왕복하면 pool 이 매번 새 표기의 목록으로', async ({
		page
	}) => {
		// direct·setup 각각 겹치지 않는 케이스로 심는다.
		const [dA, dB, sA, sB] = allCodes.slice(0, 4);
		await seedChecked(page, [sA, sB], [dA, dB]);
		await seedQuizInput(page, 'direct');
		await seedMemorizedOnly(page, true);

		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);

		// step 1: direct pool = [dA, dB]
		let seen = await collectCases(page, 15);
		for (const c of seen) {
			expect([dA, dB], `${c} 은 direct pool 밖`).toContain(c);
		}

		// step 2: quizInput 을 setup 으로. pool 이 [sA, sB] 로 즉시 갱신
		await page
			.locator('[data-toggle="quiz-input"] [data-option="setup"]')
			.click();
		await expect(page.locator('[data-toggle="quiz-input"]')).toHaveAttribute(
			'data-value',
			'setup'
		);
		// 즉시 새 케이스가 pool 안에서 뽑히길 기다린다 (다음 문제 클릭 없이).
		await expect
			.poll(async () => await currentCase(page))
			.not.toMatch(new RegExp(`^(${dA}|${dB})$`));

		seen = await collectCases(page, 15);
		for (const c of seen) {
			expect([sA, sB], `${c} 은 setup pool 밖`).toContain(c);
		}

		// step 3: direct 로 복귀 → pool = [dA, dB] 복원
		await page
			.locator('[data-toggle="quiz-input"] [data-option="direct"]')
			.click();
		await expect(page.locator('[data-toggle="quiz-input"]')).toHaveAttribute(
			'data-value',
			'direct'
		);
		await expect
			.poll(async () => await currentCase(page))
			.not.toMatch(new RegExp(`^(${sA}|${sB})$`));

		seen = await collectCases(page, 15);
		for (const c of seen) {
			expect([dA, dB], `${c} 은 direct pool 밖 (복귀 후)`).toContain(c);
		}
	});
});

test.describe('T5-5. 암기 케이스 0개 — 안내, fallback 없음 (FR-MC-20)', () => {
	test('토글 ON + direct 빈 목록 → 안내 표시, 케이스 UI 없음', async ({ page }) => {
		await seedChecked(page, [], []);
		await seedQuizInput(page, 'direct');
		await seedMemorizedOnly(page, true);

		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);
		await expect(page.locator('[data-memorized-only-input]')).toBeChecked();

		// 안내가 뜬다
		await expect(page.locator('[data-empty-pool]')).toBeVisible();
		await expect(page.locator('[data-empty-pool]')).toHaveText(
			'암기 표시한 공식이 없습니다'
		);

		// 케이스 UI 는 없다 (current === null)
		await expect(page.locator('[data-case]')).toHaveCount(0);
		// 채점/다음 버튼도 없다
		await expect(page.locator('[data-grade]')).toHaveCount(0);
		await expect(page.locator('[data-next]')).toHaveCount(0);
		// 키패드도 뜨지 않는다 — 입력할 곳이 없다
		await expect(page.locator('[data-move]')).toHaveCount(0);

		// 토글은 여전히 ON — 조용히 꺼지지 않는다
		await expect(page.locator('[data-memorized-only-input]')).toBeChecked();
	});

	test('빈 상태 → checked 가 채워진 채 열면 안내 없이 해당 케이스가 출제', async ({
		page
	}) => {
		// FR-MC-20 의 뒷단: 실제 사용자는 다른 화면에서 체크박스를 켜 채웠거나
		// About 로 clearAll 을 되돌린다. 여기서는 "체크가 채워진 뒤에는 어떻게
		// 되어야 하는가" 만 검증한다 — 초기 상태를 다르게 심어 그 결과를 본다.
		const target = allCodes[0];
		await seedChecked(page, [], [target]);
		await seedQuizInput(page, 'direct');
		await seedMemorizedOnly(page, true);
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);

		await expect(page.locator('[data-empty-pool]')).toHaveCount(0);
		await expect(page.locator('[data-case]')).toHaveText(target);
	});
});

test.describe('T5-6. memorizedOnly 도중 변경 → 즉시 재출제 (FR-MC-18, 19)', () => {
	test('토글 OFF 상태의 임의 케이스 → 토글 ON 시 pool 안 케이스로 갈아탄다', async ({
		page
	}) => {
		// direct 로 딱 한 개 심는다. OFF 상태에서는 다른 케이스가 나올 확률이
		// 압도적으로 높다 (전체 pool). 그 상태에서 ON 하면 즉시 그 한 케이스로.
		const only = allCodes[0];
		await seedChecked(page, [], [only]);
		await seedQuizInput(page, 'direct');
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);

		// 초기 문제가 우연히 `only` 라면 판별력이 없다. 다른 문제가 나올 때까지
		// 넘긴다 (최대 30회 안에는 반드시 다른 코드가 나온다 — 전체 pool).
		let init = await currentCase(page);
		for (let i = 0; init === only && i < 30; i++) {
			await nextViaSubmit(page);
			init = await currentCase(page);
		}
		expect(init).not.toBe(only);

		// 토글 ON → pool = [only] 로 즉시 갈아탄다
		await page.locator('[data-memorized-only-input]').click();
		await expect(page.locator('[data-memorized-only-input]')).toBeChecked();
		await expect.poll(async () => await currentCase(page)).toBe(only);

		// 여러 번 눌러도 계속 only 만 나온다
		for (let i = 0; i < 5; i++) {
			await nextViaSubmit(page);
			expect(await currentCase(page)).toBe(only);
		}
	});

	test('ON + pool 비었을 때 → 안내가 뜬다 (fallback 없음)', async ({ page }) => {
		// OFF 상태로 열어서 임의 케이스가 나온 뒤 ON → 안내로 전환.
		await seedChecked(page, [], []);
		await seedQuizInput(page, 'direct');
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);
		await expect(page.locator('[data-case]')).toBeVisible();

		await page.locator('[data-memorized-only-input]').click();
		await expect(page.locator('[data-memorized-only-input]')).toBeChecked();
		await expect(page.locator('[data-empty-pool]')).toBeVisible();
		await expect(page.locator('[data-case]')).toHaveCount(0);
	});
});

test.describe('레이아웃 안정성 (안내 등장 시 튀지 않음)', () => {
	test('입력 방식 토글 위치가 안내 등장 전후 동일 @viewport', async ({ page }) => {
		await seedChecked(page, [], []);
		await seedQuizInput(page, 'direct');
		await page.goto('/3x3/bld/3style/corner/quiz');
		await toggleReady(page);

		const inputMode = page.locator('.input-mode');
		const before = await inputMode.boundingBox();

		// 안내로 전환
		await page.locator('[data-memorized-only-input]').click();
		await expect(page.locator('[data-empty-pool]')).toBeVisible();

		const after = await inputMode.boundingBox();
		// 상단에 있는 입력 방식 토글의 위치가 안내 등장으로 흔들리면 안 된다
		expect(after!.y).toBe(before!.y);
	});
});
