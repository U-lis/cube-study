/**
 * Phase 4 — 입력과 결과 E2E (FR-TR-10~13, 18, 20, 23, 24, 25; NFR-TR-5).
 *
 * 채점의 옳고 그름은 Phase 1A 의 단위 테스트가 전수로 본다. 여기서 보는 것은
 * **화면이 엔진 결과를 그대로 옮기는가** 하나다.
 *
 * ─── 결정적 스크램블 (PHASE_4_TEST §실행 명령) ──────────────
 * 무작위 스크램블로는 기대 정답을 미리 알 수 없다. 그래서 `addInitScript` 로
 * **Worker 를 고정 값 스텁으로 바꾼다** — 큐에서 언제 몇 개를 꺼내든 같은
 * 스크램블이 나온다. 화면 코드에는 테스트 훅이 하나도 없다(프로덕션 번들에
 * 검사용 분기를 남기지 않는다). 스텁이 지키는 것은 `scramble.ts` 의 워커
 * 프로토콜뿐이고, 그 프로토콜은 `tests/unit/scramble.test.ts` 가 이미 못 박았다.
 *
 * 기대값은 테스트 쪽에서 같은 엔진으로 계산한다. 문자를 리터럴로 박지 않는다 —
 * 버퍼가 바뀌면 기대값도 함께 따라가야 한다 (FR-TR-7).
 * ────────────────────────────────────────────────────────────
 */
import { test, expect, type Page } from '@playwright/test';
import Cube from 'cubejs/lib/cube.js';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };
import { stateFromFacelets } from '../../src/lib/cube/sim.js';
import { gradeMemo, trace } from '../../src/lib/cube/trace.js';
import { optionsFrom } from '../../src/lib/domain/tracing.js';
import { CORNER_CUBIE, CORNER_LETTERS, CORNER_ROTATION } from '../../src/lib/cube/speffz.js';

const meta = (data as unknown as { meta: Parameters<typeof optionsFrom>[0] & { buffer: string } })
	.meta;

/**
 * 고정 스크램블 세 개.
 *
 * 무작위 상태에서 성질별로 골라낸 것이고, 성질은 아래 `expected` 가 엔진으로 다시
 * 계산한다 — 여기 적힌 문자열은 "그 성질을 갖는 한 예" 이지 기대값이 아니다.
 *
 *   ODD    코너 타깃 9개(홀수) · 끊기 2회 · 비틀림 없음  → 패리티 표시
 *   EVEN   코너 타깃 8개(짝수) · 끊기 2회 · 비틀림 없음  → 패리티 없음, 두 관례 수가 같음
 *   TWIST  관례 B 비틀림 2개, 그중 하나가 **버퍼**       → 버퍼 비틀림 별도 표시
 */
const ODD = "B2 U2 B2 L B2 L' R B R2 B' D F R2 U R B R' D' F U2 L' R2 U' L R";
const EVEN = "R2 B' U2 L2 U2 D2 B' F2 U' B F2 U2 D2 R2 L B2 U F2 U' R' U' D' L R B2";
const TWIST = "R' U D' F B2 F2 L2 B2 D R' D2 L' F' L R2 U R2 U' R2 L D2 B U L' B";

/** 스크램블 하나를 엔진에 통과시킨 기대값 묶음. */
function expected(alg: string, convention: 'A' | 'B' = 'A') {
	const state = stateFromFacelets(new Cube().move(alg).asString(), 'corner');
	const opts = optionsFrom(meta, 'corner', convention);
	const result = trace(state, opts);
	return { state, opts, result, targets: result.targets.join('') };
}

const odd = expected(ODD);
const even = expected(EVEN);
const twistB = expected(TWIST, 'B');
/** 관례 A 로 본 같은 스크램블. 두 관례의 타깃 수 비교(FR-TR-24)의 반대쪽이다. */
const twistA = expected(TWIST);

/**
 * 같은 스크램블의 **다른** 유효 메모. 끊는 자리를 마지막 후보로 바꾼다.
 * 문자열이 달라도 정답이어야 한다 (FR-TR-10).
 */
const evenAlt = trace(even.state, {
	...even.opts,
	pickBreakIn: (c) => c[c.length - 1]
}).targets.join('');

/** 불필요한 끊기 2회를 만드는 문자. 엔진이 `correct-extra` 로 판정하는 것만 쓴다. */
const extraLetter = CORNER_LETTERS.find((l) => {
	const v = gradeMemo(
		even.state,
		{ targets: [...even.result.targets, l, l], twists: [] },
		even.opts
	);
	return v.kind === 'correct-extra' && v.extra === 2;
})!;

/** 한 글자를 **같은 큐비의 다른 스티커** 로 바꾼 메모 → 방향이 다르다. */
const wrongOrientation = (() => {
	for (let i = 0; i < even.result.targets.length; i++) {
		const t = even.result.targets[i];
		for (const s of CORNER_ROTATION[CORNER_CUBIE[t]]) {
			if (s === t || meta.bufferStickers.includes(s)) continue;
			const targets = even.result.targets.map((x, n) => (n === i ? s : x));
			const v = gradeMemo(even.state, { targets, twists: [] }, even.opts);
			if (v.kind === 'wrong-at' && v.reason === 'wrong-orientation' && v.index === i)
				return { text: targets.join(''), index: i + 1 };
		}
	}
	throw new Error('방향 오류를 만드는 자리를 못 찾았다');
})();

/** 한 글자를 **엉뚱한 조각** 으로 바꾼 메모 → 다른 조각이다. */
const wrongPiece = (() => {
	for (let i = 0; i < even.result.targets.length; i++) {
		for (const s of CORNER_LETTERS) {
			if (meta.bufferStickers.includes(s)) continue;
			if (CORNER_CUBIE[s] === CORNER_CUBIE[even.result.targets[i]]) continue;
			const targets = even.result.targets.map((x, n) => (n === i ? s : x));
			const v = gradeMemo(even.state, { targets, twists: [] }, even.opts);
			if (v.kind === 'wrong-at' && v.reason === 'wrong-piece' && v.index === i)
				return { text: targets.join(''), index: i + 1 };
		}
	}
	throw new Error('조각 오류를 만드는 자리를 못 찾았다');
})();

/**
 * 워커를 고정 값 스텁으로 바꾸고 `/trace` 를 연다.
 *
 * 스텁은 `ScrambleQueue` 가 보는 프로토콜만 지킨다 — `init` 에 `ready`,
 * `request` 에 요청한 개수만큼 `scramble`. 큐가 몇 번 채워져도 같은 값이라
 * 같은 문제를 여러 번 풀 수 있다.
 */
async function open(
	page: Page,
	alg: string,
	settings: Record<string, string> = {}
): Promise<void> {
	await page.addInitScript(
		([scramble, store]: [string, Record<string, string>]) => {
			for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
			class FixedWorker {
				onmessage: ((e: { data: unknown }) => void) | null = null;
				postMessage(message: unknown) {
					const msg = message as { type: string; n?: number };
					const send = (d: unknown) => setTimeout(() => this.onmessage?.({ data: d }), 0);
					if (msg.type === 'init') send({ type: 'ready' });
					else if (msg.type === 'request')
						for (let i = 0; i < (msg.n ?? 0); i++)
							send({ type: 'scramble', scramble, core: scramble });
				}
				terminate() {}
			}
			(globalThis as unknown as { Worker: unknown }).Worker = FixedWorker;
		},
		[alg, settings] as [string, Record<string, string>]
	);
	await page.goto('/trace');
	await expect(page.locator('[data-start]')).toBeEnabled({ timeout: 15_000 });
}

const keys = (page: Page, pad: string) => page.locator(`[data-pad="${pad}"] button[data-letter]`);
const key = (page: Page, pad: string, letter: string) =>
	page.locator(`[data-pad="${pad}"] button[data-letter="${letter}"]`);
const targetsValue = (page: Page) => page.locator('[data-targets]').inputValue();

/** 한 판을 시작해 채점까지 간다. */
async function play(page: Page, targets: string, twists = ''): Promise<void> {
	await page.locator('[data-start]').click();
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
	if (targets) await page.locator('[data-targets]').fill(targets);
	if (twists) await page.locator('[data-twists]').fill(twists);
	await page.locator('[data-grade]').click();
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
}

/** 이 세션에서 타깃이 될 수 있는 문자들 (버퍼 제외). */
const free = CORNER_LETTERS.filter((l) => !meta.bufferStickers.includes(l));

test.describe('T4-1 패드 입력 (FR-TR-18)', () => {
	test('코너 세션의 패드는 대문자 24글자다', async ({ page }) => {
		await open(page, EVEN);
		await expect(keys(page, 'targets')).toHaveCount(24);
		expect(await keys(page, 'targets').allInnerTexts()).toEqual(CORNER_LETTERS);
	});

	test('엣지 세션의 패드는 소문자 24글자다', async ({ page }) => {
		await open(page, EVEN, { 'trace.pieceKind': 'edge' });
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		const labels = await keys(page, 'targets').allInnerTexts();
		expect(labels).toHaveLength(24);
		expect(labels.join('')).toBe(labels.join('').toLowerCase());
		expect(new Set(labels).size).toBe(24);
	});

	test('버튼 세 개를 누르면 순서대로 쌓인다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const l of free.slice(0, 3)) await key(page, 'targets', l).click();
		expect(await targetsValue(page)).toBe(free.slice(0, 3).join(''));
	});

	test('삭제는 마지막 한 글자만 지운다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const l of free.slice(0, 3)) await key(page, 'targets', l).click();
		await page.locator('[data-pad="targets"] [data-action="back"]').click();
		expect(await targetsValue(page)).toBe(free.slice(0, 2).join(''));
	});

	test('전체 지우기는 열을 비운다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const l of free.slice(0, 3)) await key(page, 'targets', l).click();
		await page.locator('[data-pad="targets"] [data-action="clear"]').click();
		expect(await targetsValue(page)).toBe('');
	});

	test('상한을 넘는 입력은 조용히 무시된다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		const max = Number(await page.locator('[data-pad="targets"]').getAttribute('data-max'));
		expect(max).toBeGreaterThan(0);
		// 붙여넣기 한 번으로 상한을 넘겨본다. 잘리기만 하고 아무것도 죽지 않는다.
		const long = Array.from({ length: max + 10 }, (_, i) => free[i % free.length]).join('');
		await page.locator('[data-targets]').fill(long);
		expect((await targetsValue(page)).length).toBe(max);
		// 상한에 닿으면 패드가 잠긴다 — 누를 데가 없어 초과가 애초에 안 생긴다.
		await expect(key(page, 'targets', free[0])).toBeDisabled();
		// 키보드로 더 쳐도 늘지 않는다.
		await page.locator('[data-targets]').focus();
		await page.keyboard.press('End');
		await page.keyboard.type(free.slice(0, 3).join(''));
		expect((await targetsValue(page)).length).toBe(max);
		// 프리즈·예외 없이 계속 쓸 수 있다.
		await page.locator('[data-pad="targets"] [data-action="back"]').click();
		expect((await targetsValue(page)).length).toBe(max - 1);
		await expect(key(page, 'targets', free[0])).toBeEnabled();
	});

	test('타깃 구획의 버퍼 문자는 눌러도 들어가지 않는다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const s of meta.bufferStickers) {
			await expect(key(page, 'targets', s)).toBeDisabled();
			await expect(key(page, 'targets', s)).toHaveAttribute('data-blocked', 'true');
		}
		// 키보드로 쳐도 같다. 두 경로가 같은 규칙을 지난다.
		await page.locator('[data-targets]').focus();
		await page.keyboard.type(meta.bufferStickers.join(''));
		expect(await targetsValue(page)).toBe('');
	});

	test('관례 B 의 비틀림 구획은 버퍼 문자를 받는다', async ({ page }) => {
		await open(page, TWIST, { 'trace.convention': 'B' });
		await page.locator('[data-start]').click();
		const s = meta.bufferStickers[0];
		await expect(key(page, 'twists', s)).toBeEnabled();
		await key(page, 'twists', s).click();
		expect(await page.locator('[data-twists]').inputValue()).toBe(s);
	});
});

test.describe('T4-2 하드웨어 키보드 (FR-TR-18)', () => {
	test('코너 세션은 소문자로 쳐도 대문자로 들어간다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-targets]').focus();
		await page.keyboard.type(free.slice(0, 2).join('').toLowerCase());
		expect(await targetsValue(page)).toBe(free.slice(0, 2).join(''));
	});

	test('엣지 세션은 대문자로 쳐도 소문자로 들어간다', async ({ page }) => {
		await open(page, EVEN, { 'trace.pieceKind': 'edge' });
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		await page.locator('[data-targets]').focus();
		await page.keyboard.type('KB');
		expect(await targetsValue(page)).toBe('kb');
	});

	test('Backspace 는 한 글자, Escape 는 전체를 지운다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-targets]').focus();
		await page.keyboard.type(free.slice(0, 3).join(''));
		await page.keyboard.press('Backspace');
		expect(await targetsValue(page)).toBe(free.slice(0, 2).join(''));
		await page.keyboard.press('Escape');
		expect(await targetsValue(page)).toBe('');
	});

	test('Enter 로 제출한다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-targets]').focus();
		await page.keyboard.type(even.targets);
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
	});

	test('입력 구획 밖에서 친 글자는 들어가지 않는다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		// 전역 키 훅이 있으면 여기서 새어 들어온다.
		await page.locator('[data-next]').focus();
		await page.keyboard.type(free.slice(0, 3).join(''));
		expect(await targetsValue(page)).toBe('');
	});

	test('패드와 키보드를 섞어도 한 열에 순서대로 쌓인다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await key(page, 'targets', free[0]).click();
		await page.locator('[data-targets]').focus();
		await page.keyboard.type(free[1]);
		await key(page, 'targets', free[2]).click();
		expect(await targetsValue(page)).toBe(free.slice(0, 3).join(''));
	});
});

test.describe('T4-3 두 구획과 관례 (FR-TR-18, 24)', () => {
	test('관례 A 에서 비틀림 구획은 잠기되 DOM 에 남는다', async ({ page }) => {
		await open(page, EVEN, { 'trace.convention': 'A' });
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-twists]')).toBeDisabled();
		// 숨기지 않는다. 버튼 개수도 그대로다 (AD-14).
		await expect(page.locator('[data-twists]')).toHaveCount(1);
		await expect(keys(page, 'twists')).toHaveCount(24);
		await expect(key(page, 'twists', free[0])).toBeDisabled();
	});

	test('관례 B 에서 비틀림 구획이 열린다', async ({ page }) => {
		await open(page, TWIST, { 'trace.convention': 'B' });
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-twists]')).toBeEnabled();
		await expect(key(page, 'twists', free[0])).toBeEnabled();
	});

	test('비틀림은 집합이라 순서를 바꿔도 정답이다', async ({ page }) => {
		const list = twistB.result.twists;
		expect(list.length).toBeGreaterThanOrEqual(2);
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets, list.join(''));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		await page.locator('[data-next]').click();
		// 같은 스크램블을 다시 낸다. 이번에는 비틀림을 거꾸로 적는다.
		await play(page, twistB.targets, [...list].reverse().join(''));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
	});

	test('관례를 바꿔도 입력 구획의 자리가 밀리지 않는다 @viewport', async ({ page }) => {
		await open(page, EVEN, { 'trace.convention': 'A' });
		/*
		 * 뷰포트 좌표가 아니라 **문서 좌표** 로 잰다. 토글은 화면 아래쪽에 있어서
		 * 누르면 브라우저가 스크롤한다 — `boundingBox` 로 재면 그 스크롤을 레이아웃
		 * 밀림으로 오인한다.
		 */
		const place = () =>
			page.locator('[data-section="twists"]').evaluate((el) => {
				const r = el.getBoundingClientRect();
				return { top: r.top + window.scrollY, height: r.height };
			});
		const before = await place();
		await page.locator('[data-toggle="trace-convention"] [data-option="B"]').click();
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveAttribute(
			'data-value',
			'B'
		);
		const after = await place();
		expect(Math.abs(after.top - before.top)).toBeLessThan(1);
		expect(Math.abs(after.height - before.height)).toBeLessThan(1);
	});
});

test.describe('T4-4 채점 결과 (FR-TR-10, 11, 12, 20)', () => {
	test('엔진이 낸 타깃 열은 정답이다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		await expect(page.locator('[data-verdict]')).toHaveText('정답');
	});

	test('끊는 자리를 다르게 잡은 다른 유효 메모도 정답이다', async ({ page }) => {
		// 문자열이 다른데도 정답이어야 한다 — 정답은 하나가 아니다 (FR-TR-10).
		expect(evenAlt).not.toBe(even.targets);
		await open(page, EVEN);
		await play(page, evenAlt);
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		// 화면의 정답 예시는 사용자의 입력과 다르다. 그렇다고 오답이 되지 않는다.
		await expect(page.locator('[data-answer]')).toHaveText(even.targets);
		expect(even.targets).not.toBe(evenAlt);
	});

	test('불필요한 끊기는 오답이 아니라 별도 문구다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets + extraLetter + extraLetter);
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct-extra');
		await expect(page.locator('[data-verdict]')).toContainText('불필요한 끊기');
		await expect(page.locator('[data-verdict]')).not.toContainText('오답');
	});

	test('같은 큐비의 다른 스티커는 방향 오류로 짚는다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, wrongOrientation.text);
		await expect(page.locator('[data-verdict]')).toContainText('방향이 다릅니다');
		await expect(page.locator('[data-verdict]')).toHaveAttribute(
			'data-wrong-index',
			String(wrongOrientation.index)
		);
		await expect(page.locator('[data-verdict]')).toContainText(`${wrongOrientation.index}번째`);
	});

	test('엉뚱한 조각은 조각 오류로 짚는다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, wrongPiece.text);
		await expect(page.locator('[data-verdict]')).toContainText('다른 조각입니다');
		await expect(page.locator('[data-verdict]')).toHaveAttribute(
			'data-wrong-index',
			String(wrongPiece.index)
		);
	});

	test('짧게 적으면 남은 개수를 알려준다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets.slice(0, 2));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'incomplete');
		await expect(page.locator('[data-verdict]')).toContainText('남았습니다');
	});

	test('정답 예시 하나와 정답이 여럿이라는 안내가 함께 나온다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		await expect(page.locator('[data-answer]')).toHaveText(even.targets);
		await expect(page.locator('[data-answer-note]')).toContainText('정답은 여럿입니다');
	});
});

test.describe('T4-5 패리티와 관례 비교 (FR-TR-13, 24)', () => {
	test('코너 타깃이 홀수면 패리티가 표시된다', async ({ page }) => {
		expect(odd.result.parity).toBe(true);
		await open(page, ODD);
		await play(page, odd.targets);
		await expect(page.locator('[data-parity]')).toHaveAttribute('data-parity', 'true');
		await expect(page.locator('[data-parity]')).toContainText('패리티');
	});

	test('짝수면 패리티 표시가 없다', async ({ page }) => {
		expect(even.result.parity).toBe(false);
		await open(page, EVEN);
		await play(page, even.targets);
		await expect(page.locator('[data-parity]')).toHaveAttribute('data-parity', 'false');
		await expect(page.locator('[data-parity]')).not.toContainText('패리티입니다');
		expect((await page.locator('[data-parity] .v').innerText()).trim()).toBe('');
	});

	test('두 관례의 타깃 수가 함께 나온다', async ({ page }) => {
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets, twistB.result.twists.join(''));
		const row = page.locator('[data-convention-compare]');
		await expect(row).toHaveAttribute('data-count-a', String(twistA.result.targets.length));
		await expect(row).toHaveAttribute('data-count-b', String(twistB.result.targets.length));
		// 관례가 타깃 수를 실제로 바꾼다는 것이 이 화면이 보여주려는 것이다.
		expect(twistA.result.targets.length).not.toBe(twistB.result.targets.length);
	});

	test('비틀림이 없는 스크램블은 두 수가 같다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		const row = page.locator('[data-convention-compare]');
		const a = await row.getAttribute('data-count-a');
		expect(await row.getAttribute('data-count-b')).toBe(a);
	});

	test('관례 B 결과의 버퍼 비틀림은 따로 표시된다', async ({ page }) => {
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets, twistB.result.twists.join(''));
		await expect(page.locator('[data-answer-twists] [data-buffer="true"]')).toHaveCount(1);
		await expect(page.locator('[data-buffer-note]')).toContainText('버퍼');
		// 방향 마커를 쓰지 않는다 — 비틀림은 문자 하나다 (FR-TR-25).
		const text = await page.locator('[data-answer-twists]').innerText();
		expect(text).not.toContain("'");
	});
});

test.describe('T4-6 시간과 기록 (FR-TR-23)', () => {
	test('세 판을 돌리면 직전 기록들이 목록으로 보인다', async ({ page }) => {
		await open(page, EVEN);
		for (let i = 0; i < 3; i++) {
			await play(page, even.targets);
			await page.locator('[data-next]').click();
		}
		await expect(page.locator('[data-record]')).toHaveCount(3);
	});

	test('기록 한 건의 필드가 스키마 그대로다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		const rec = await page.evaluate(
			() => JSON.parse(localStorage.getItem('trace.records')!).records[0]
		);
		expect(Object.keys(rec).sort()).toEqual(
			['at', 'buffer', 'correct', 'mode', 'ms', 'pieceKind', 'targetCount', 'twistConvention'].sort()
		);
		expect(rec.buffer).toBe(meta.buffer);
		expect(rec.targetCount).toBe(even.result.targets.length);
		expect(rec.correct).toBe(true);
	});

	test('상한 50건을 넘지 않는다', async ({ page }) => {
		// 51판을 화면으로 돌리는 대신 50건을 심어두고 한 판을 더 한다.
		const seeded = JSON.stringify({
			schemaVersion: 1,
			records: Array.from({ length: 50 }, (_, i) => ({
				at: 1755660000000 + i,
				ms: 1000 + i,
				pieceKind: 'corner',
				buffer: meta.buffer,
				mode: 'follow',
				twistConvention: 'A',
				targetCount: 8,
				correct: true
			}))
		});
		await open(page, EVEN, { 'trace.records': seeded });
		await play(page, even.targets);
		const n = await page.evaluate(
			() => JSON.parse(localStorage.getItem('trace.records')!).records.length
		);
		expect(n).toBe(50);
	});

	test('새로고침해도 기록이 복원된다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		await page.reload();
		await expect(page.locator('[data-record]')).toHaveCount(1);
	});
});

test.describe('T4-7 톤과 접근성 (NFR-TR-5)', () => {
	test('정답 화면에 축하·배지·연속·점수 문구가 없다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		const text = await page.locator('body').innerText();
		for (const word of ['축하', '배지', '연속', '점수', '신기록', '최고 기록', '훌륭'])
			expect(text, word).not.toContain(word);
	});

	test('패드 버튼의 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		await open(page, EVEN);
		for (const sel of [
			'[data-pad="targets"] button[data-letter]',
			'[data-pad="targets"] [data-action="back"]',
			'[data-pad="twists"] [data-action="clear"]'
		]) {
			const box = (await page.locator(sel).first().boundingBox())!;
			expect(box.height, sel).toBeGreaterThanOrEqual(44);
		}
	});

	test('320px 폭에서 가로 스크롤이 생기지 않는다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-targets]').fill(even.targets);
		await page.locator('[data-grade]').click();
		const over = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(over).toBeLessThanOrEqual(0);
	});

	test('잠긴 버튼은 색 말고 다른 신호도 함께 준다', async ({ page }) => {
		await open(page, EVEN);
		const blocked = key(page, 'targets', meta.bufferStickers[0]);
		const open_ = key(page, 'targets', free[0]);
		const style = (l: typeof blocked) =>
			l.evaluate((el) => {
				const s = getComputedStyle(el);
				return { border: s.borderTopStyle, line: s.textDecorationLine };
			});
		expect(await style(blocked)).toEqual({ border: 'dashed', line: 'line-through' });
		expect((await style(open_)).border).toBe('solid');
		expect((await style(open_)).line).not.toContain('line-through');
		// 안내 문구도 붙어 있다 — 화면 낭독기에서도 이유를 알 수 있다.
		expect(await blocked.getAttribute('title')).toContain('버퍼');
	});
});
