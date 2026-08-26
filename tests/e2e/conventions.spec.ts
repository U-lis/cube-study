/**
 * 화면 규약 검사 (FR-NAV-17).
 *
 * **문서만으로는 안 지켜진다는 것이 이 저장소의 실적이다.** 프리렌더 불변 원칙은
 * GLOBAL 두 곳과 코드 주석에 세 번 적혔고, 그러고도 두 번 밟았다. 반대로 정적
 * 검사는 실제로 작동했다 — 버퍼 리터럴 금지가 검사로 박혀 있어서 지켜진다.
 *
 * 그래서 규약 문서(`.dc_workspace/CONVENTIONS.md`)를 쓰기 **전에** 이 파일을 쓴다.
 * 검사를 먼저 쓰면 규약이 실제로 성립하는지 그 자리에서 드러나고, 문서를 먼저 쓰면
 * 구현이 못 따라오는 규약을 적어 놓고도 모른다.
 *
 * 여기 없는 규약은 두 부류다.
 * - 이미 다른 파일이 검사한다 — 터치 타깃 44px·프리렌더 자리·단계별 접기는
 *   `trace-session.spec.ts`, 판정 색은 `quiz-feedback.spec.ts`
 * - 기계가 못 본다 — UI 문구가 사실만 적는가, 이름이 하는 일을 가리키는가.
 *   `CONVENTIONS.md` 가 "검사 없음 — 리뷰에서 본다" 로 표시한다
 *
 * 주소는 리터럴로 적는다. 검사가 앱과 같은 방식으로 URL 을 계산하면 URL 이 틀렸을 때
 * 같이 틀린다.
 */
import { test, expect, type Page } from '@playwright/test';

const HOME = '/';
const LOOKUP = '/3x3/bld/3style/corner/lookup';
const ALGS = '/3x3/bld/3style/corner/algs';
const QUIZ = '/3x3/bld/3style/corner/quiz';
const TRACE = '/3x3/bld/trace';
/** 데이터가 아는 기준 하나. 상세 화면의 표본이다. */
const DETAIL = '/3x3/bld/3style/corner/algs/GC';

/** 기능 화면 넷. 홈과 상세는 규약이 달라 따로 본다. */
const FEATURES = [
	{ path: LOOKUP, name: '조회' },
	{ path: ALGS, name: '기준공식' },
	{ path: QUIZ, name: '퀴즈' },
	{ path: TRACE, name: '트레이싱' }
];

const TABBED = [LOOKUP, ALGS, QUIZ];

/** 데이터셋이 붙어 화면이 다 선 뒤에 잰다. */
async function ready(page: Page, path: string) {
	await page.goto(path);
	await expect(page.locator('h1')).toBeVisible();
}

test.describe('T4 화면 이름 (FR-NAV-9)', () => {
	test('기능 화면의 h1 은 하나이고 화면 이름이다', async ({ page }) => {
		for (const f of FEATURES) {
			await ready(page, f.path);
			await expect(page.locator('h1'), f.path).toHaveCount(1);
			await expect(page.locator('h1'), f.path).toHaveText(f.name);
		}
	});

	test('홈의 h1 도 하나다', async ({ page }) => {
		await ready(page, HOME);
		await expect(page.locator('h1')).toHaveCount(1);
	});

	test('기준 상세의 h1 은 기준 이름이다', async ({ page }) => {
		// 이 화면의 이름은 기준 그 자체다 — 목록의 항목이라 이름이 곧 코드다.
		await ready(page, DETAIL);
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('h1')).toHaveText('GC');
	});

	test('케이스 코드는 h1 이 아니다', async ({ page }) => {
		// 퀴즈의 문제. 0.4.2 까지 이 자리가 h1 이었다.
		await ready(page, QUIZ);
		await expect(page.locator('[data-case]')).toBeVisible();
		await expect(page.locator('h1[data-case]')).toHaveCount(0);
	});
});

test.describe('T4 되돌아가기 (FR-NAV-7)', () => {
	test('기능 화면 넷은 홈으로 올라간다', async ({ page }) => {
		for (const f of FEATURES) {
			await ready(page, f.path);
			await expect(page.locator('[data-up-link]'), f.path).toHaveCount(1);
			await expect(page.locator('[data-up-link]'), f.path).toHaveAttribute('data-up-link', '/');
		}
	});

	test('기준 상세만 목록으로 올라간다', async ({ page }) => {
		// 유일한 예외다. 목록의 항목이라 상위가 홈이 아니라 목록이다.
		await ready(page, DETAIL);
		await expect(page.locator('[data-up-link]')).toHaveAttribute('data-up-link', ALGS);
	});

	test('홈에는 되돌아갈 곳이 없다', async ({ page }) => {
		await ready(page, HOME);
		await expect(page.locator('[data-up-link]')).toHaveCount(0);
	});
});

test.describe('T4 하단 탭 (FR-NAV-4, 5, 6)', () => {
	test('공식 화면 셋은 형제 탭 셋을 단다', async ({ page }) => {
		for (const path of TABBED) {
			await ready(page, path);
			const links = page.locator('nav a');
			await expect(links, path).toHaveCount(3);
			// 형제는 기능 칸만 다르다 — 앞의 네 칸이 모두 같아야 한다.
			expect(await links.evaluateAll((els) => els.map((e) => e.getAttribute('href'))), path).toEqual([
				LOOKUP,
				ALGS,
				QUIZ
			]);
		}
	});

	test('기준 상세는 목록의 탭을 물려받는다', async ({ page }) => {
		// 상세는 자기 형제가 없다. 동적 칸을 걷어낸 경로로 계산하므로 탭이 유지된다.
		await ready(page, DETAIL);
		await expect(page.locator('nav a')).toHaveCount(3);
		await expect(page.locator('nav a.on')).toHaveText('기준공식');
	});

	test('트레이싱에는 탭바가 없다', async ({ page }) => {
		// 형제가 없다. 자기 자신만 있는 탭바는 이동 수단이 아니라 장식이다.
		await ready(page, TRACE);
		await expect(page.locator('nav')).toHaveCount(0);
	});

	test('홈에는 탭바가 없다', async ({ page }) => {
		await ready(page, HOME);
		await expect(page.locator('nav')).toHaveCount(0);
	});
});

test.describe('T4 화면끼리 서로를 보여주지 않는다 (FR-NAV-4)', () => {
	test('공식 화면에 트레이싱으로 가는 링크가 없다', async ({ page }) => {
		// FR-NAV-4 의 본론이다. 퀴즈를 풀다가 트레이싱이 눈에 들어오지 않는다.
		for (const path of [...TABBED, DETAIL]) {
			await ready(page, path);
			await expect(page.locator(`a[href^="${TRACE}"]`), path).toHaveCount(0);
		}
	});

	test('트레이싱에 공식 화면으로 가는 링크가 없다', async ({ page }) => {
		await ready(page, TRACE);
		await expect(page.locator('a[href^="/3x3/bld/3style"]')).toHaveCount(0);
	});

	test('홈은 넷을 모두 링크한다', async ({ page }) => {
		// 반대쪽 요구다. 홈이 지도이므로 여기서만 전부 보인다.
		await ready(page, HOME);
		for (const f of FEATURES) {
			await expect(page.locator(`a[href="${f.path}"]`), f.path).toHaveCount(1);
		}
	});
});

test.describe('T4 진행 버튼 (FR-NAV-13, AD-NAV-9)', () => {
	test('퀴즈는 판정 뒤에만 다음 문제를 낸다', async ({ page }) => {
		await ready(page, QUIZ);
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'active');
		await expect(page.locator('[data-next]')).toHaveCount(0);

		// 아무 무브나 하나 넣고 채점한다. 맞든 틀리든 판정이 서는 것이 요점이다.
		await page.locator('[data-move="R"]').click();
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-next]')).toBeVisible();
	});

	test('퀴즈의 진행 버튼이 본문 최하단에 선다 @viewport', async ({ page }) => {
		await ready(page, QUIZ);
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		// 문제 → 입력칸 → 진행 버튼 순서. 버튼이 문제나 입력보다 위에 서지 않는다.
		expect(await y('[data-grade]')).toBeGreaterThan(await y('[data-case]'));
		expect(await y('[data-grade]')).toBeGreaterThan(await y('.entry'));
	});

	test('트레이싱의 진행 버튼이 본문 최하단에 선다 @viewport', async ({ page }) => {
		await ready(page, TRACE);
		const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
		// idle 에서는 아래가 다 접히므로 최하단이 곧 설정 바로 아래다.
		expect(await y('[data-start]')).toBeGreaterThan(await y('canvas[data-cube3d]'));
		expect(await y('[data-start]')).toBeGreaterThan(await y('[data-timer]'));
	});
});

test.describe('T4 판정 줄 (FR-NAV-12)', () => {
	test('퀴즈의 판정 줄이 규약 속성을 갖는다', async ({ page }) => {
		await ready(page, QUIZ);
		await page.locator('[data-move="R"]').click();
		await page.locator('[data-grade]').click();
		const verdict = page.locator('[data-verdict]');
		await expect(verdict).toBeVisible();
		// 무엇인지는 data-kind, 좋은 소식인지는 data-result 가 말한다.
		await expect(verdict).toHaveAttribute('data-kind', /.+/);
		await expect(verdict).toHaveAttribute('data-result', /^(ok|bad)$/);
	});

	test('판정 전에는 판정 줄이 없다', async ({ page }) => {
		// 판정이 없는 동안 상자를 그리지 않는다.
		await ready(page, QUIZ);
		await expect(page.locator('[data-verdict]')).toHaveCount(0);
	});
});

test.describe('T4 단계 (FR-NAV-14)', () => {
	test('훈련형 화면은 data-stage 를 낸다', async ({ page }) => {
		// 검사와 CSS 가 같은 신호를 본다.
		await ready(page, QUIZ);
		await expect(page.locator('[data-stage]')).toHaveCount(1);
		await ready(page, TRACE);
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'idle');
	});

	test('퀴즈에는 idle 이 없다', async ({ page }) => {
		// 단계 이름은 공유하되 단계를 강제하지 않는다 — 연달아 푸는 화면이라
		// 문제마다 시작을 누르게 하면 흐름이 끊긴다 (AD-NAV-5).
		await ready(page, QUIZ);
		await expect(page.locator('[data-stage="idle"]')).toHaveCount(0);
		await expect(page.locator('[data-start]')).toHaveCount(0);
	});
});
