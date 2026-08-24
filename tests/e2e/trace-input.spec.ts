/**
 * Phase 4 — 입력과 결과 E2E (FR-TR-10~13, 18, 20, 23, 24, 25; NFR-TR-5).
 *
 * 채점의 옳고 그름은 Phase 1A 의 단위 테스트가 전수로 본다. 여기서 보는 것은
 * **화면이 엔진 결과를 그대로 옮기는가** 하나다.
 *
 * ─── 입력은 한 줄이다 ───────────────────────────────────────
 * 타깃 구획과 비틀림 구획이 따로 있던 때의 검사는 셀렉터를 바꾸는 것으로 끝나지
 * 않는다. 그 구획이 지키던 성질 — 비틀림 선언이 채점된다, 순서를 안 본다, 버퍼도
 * 선언으로 읽힌다 — 을 **한 줄 위에서** 다시 세운다. 구획이 사라졌다고 성질이
 * 사라진 것이 아니기 때문이다.
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
import {
	optionsFrom,
	ENTRY_SEPARATOR,
	RECORDS_SCHEMA_VERSION,
	SEPARATOR_LABEL
} from '../../src/lib/domain/tracing.js';
import {
	CORNER_CUBIE,
	CORNER_LETTERS,
	CORNER_ROTATION,
	EDGE_CUBIE,
	EDGE_ROTATION
} from '../../src/lib/cube/speffz.js';

const meta = (data as unknown as { meta: Parameters<typeof optionsFrom>[0] & { buffer: string } })
	.meta;

/**
 * 엣지 버퍼. 엣지 데이터셋(#16)이 아직 없어서 화면이 상수로 들고 있고
 * (`+page.svelte` 의 `EDGE_BUFFER`), 여기서는 그 기준 스티커 하나만 받아 좌표에서
 * 나머지를 만든다. 데이터가 생기면 양쪽 다 지워진다.
 */
const EDGE_PRIMARY = 'c';
const edgeMeta = {
	buffer: EDGE_CUBIE[EDGE_PRIMARY],
	bufferStickers: EDGE_ROTATION[EDGE_CUBIE[EDGE_PRIMARY]],
	primarySticker: EDGE_PRIMARY
};

/**
 * 고정 스크램블 세 개.
 *
 * 무작위 상태에서 성질별로 골라낸 것이고, 성질은 아래 `expected` 가 엔진으로 다시
 * 계산한다 — 여기 적힌 문자열은 "그 성질을 갖는 한 예" 이지 기대값이 아니다.
 *
 *   ODD    코너 타깃 9개(홀수) · 버퍼막힘 2회 · 비틀림 없음 → 패리티 표시
 *   EVEN   코너 타깃 8개(짝수) · 버퍼막힘 2회 · 비틀림 없음 → 패리티 없음
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

/** 같은 스크램블의 엣지 쪽 기대값. `both` 한 판이 두 갈래를 함께 채점한다. */
function edgeExpected(alg: string, convention: 'A' | 'B' = 'A') {
	const state = stateFromFacelets(new Cube().move(alg).asString(), 'edge');
	const opts = optionsFrom(edgeMeta, 'edge', convention);
	const result = trace(state, opts);
	return { state, opts, result, targets: result.targets.join('') };
}

const odd = expected(ODD);
const even = expected(EVEN);
const evenEdge = edgeExpected(EVEN);
const twistA = expected(TWIST);
const twistB = expected(TWIST, 'B');

/** `both` 한 판의 한 줄 입력. 구분자가 코너와 엣지를 가른다. */
const bothEntry = `${even.targets}${ENTRY_SEPARATOR}${evenEdge.targets}`;

/**
 * 같은 스크램블의 **다른** 유효 메모. 버퍼막힘 자리를 마지막 후보로 바꾼다.
 * 문자열이 달라도 정답이어야 한다 (FR-TR-10).
 */
const evenAlt = trace(even.state, {
	...even.opts,
	pickBreakIn: (c) => c[c.length - 1]
}).targets.join('');

/** 불필요한 버퍼막힘 2회를 만드는 문자. 엔진이 `correct-extra` 로 판정하는 것만 쓴다. */
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

const keys = (page: Page) => page.locator('[data-pad="entry"] button[data-letter]');
const key = (page: Page, letter: string) =>
	page.locator(`[data-pad="entry"] button[data-letter="${letter}"]`);
const entryValue = (page: Page) => page.locator('[data-entry]').inputValue();

/** 한 판을 시작해 채점까지 간다. 제출은 **한 번** 이다 (요구 2). */
async function play(page: Page, entry: string): Promise<void> {
	await page.locator('[data-start]').click();
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
	if (entry) await page.locator('[data-entry]').fill(entry);
	await page.locator('[data-grade]').click();
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
}

/** 기록 모달을 연다 (요구 3). 본문에는 개수만 남는다. */
async function openRecords(page: Page): Promise<void> {
	await page.locator('[data-open-records]').click();
	await expect(page.locator('[data-records-modal]')).toBeVisible();
}

/** 이 세션에서 타깃이 될 수 있는 문자들 (버퍼 제외). */
const free = CORNER_LETTERS.filter((l) => !meta.bufferStickers.includes(l));

test.describe('T4-1 패드 입력 (FR-TR-18)', () => {
	test('코너 세션의 패드는 대문자 24글자다', async ({ page }) => {
		await open(page, EVEN);
		await expect(keys(page)).toHaveCount(24);
		expect(await keys(page).allInnerTexts()).toEqual(CORNER_LETTERS);
	});

	test('엣지 세션의 패드는 소문자 24글자다', async ({ page }) => {
		await open(page, EVEN, { 'trace.pieceKind': 'edge' });
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		const labels = await keys(page).allInnerTexts();
		expect(labels).toHaveLength(24);
		expect(labels.join('')).toBe(labels.join('').toLowerCase());
		expect(new Set(labels).size).toBe(24);
	});

	test('버튼 세 개를 누르면 순서대로 쌓인다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const l of free.slice(0, 3)) await key(page, l).click();
		expect(await entryValue(page)).toBe(free.slice(0, 3).join(''));
	});

	test('삭제는 마지막 한 글자만 지운다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const l of free.slice(0, 3)) await key(page, l).click();
		await page.locator('[data-pad="entry"] [data-action="back"]').click();
		expect(await entryValue(page)).toBe(free.slice(0, 2).join(''));
	});

	test('전체 지우기는 열을 비운다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		for (const l of free.slice(0, 3)) await key(page, l).click();
		await page.locator('[data-pad="entry"] [data-action="clear"]').click();
		expect(await entryValue(page)).toBe('');
	});

	test('상한을 넘는 입력은 조용히 무시된다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		const max = Number(await page.locator('[data-pad="entry"]').getAttribute('data-max'));
		expect(max).toBeGreaterThan(0);
		// 붙여넣기 한 번으로 상한을 넘겨본다. 잘리기만 하고 아무것도 죽지 않는다.
		const long = Array.from({ length: max + 10 }, (_, i) => free[i % free.length]).join('');
		await page.locator('[data-entry]').fill(long);
		expect((await entryValue(page)).length).toBe(max);
		// 상한에 닿으면 패드가 잠긴다 — 누를 데가 없어 초과가 애초에 안 생긴다.
		await expect(key(page, free[0])).toBeDisabled();
		// 키보드로 더 쳐도 늘지 않는다.
		await page.locator('[data-entry]').focus();
		await page.keyboard.press('End');
		await page.keyboard.type(free.slice(0, 3).join(''));
		expect((await entryValue(page)).length).toBe(max);
		// 프리즈·예외 없이 계속 쓸 수 있다.
		await page.locator('[data-pad="entry"] [data-action="back"]').click();
		expect((await entryValue(page)).length).toBe(max - 1);
		await expect(key(page, free[0])).toBeEnabled();
	});

	test('버퍼 문자도 잠기지 않고 그대로 들어간다 (요구 5)', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		const s = meta.bufferStickers[0];
		// 한 줄 입력에서 버퍼는 비틀림 선언으로 정당하게 쓰인다. 잠글 자리가 문맥에
		// 따라 갈리면 사용자가 예측할 수 없으므로 아예 잠그지 않는다.
		await expect(key(page, s)).toBeEnabled();
		await key(page, s).click();
		expect(await entryValue(page)).toBe(s);
		// 키보드도 같은 규칙을 지난다.
		await page.locator('[data-pad="entry"] [data-action="clear"]').click();
		await page.locator('[data-entry]').focus();
		await page.keyboard.type(meta.bufferStickers.join(''));
		expect(await entryValue(page)).toBe(meta.bufferStickers.join(''));
	});

	test('버퍼를 타깃으로 쓴 것은 채점이 짚는다', async ({ page }) => {
		await open(page, EVEN);
		// 첫 글자를 버퍼 스티커로 바꾸면 그 자리가 오답이다.
		await play(page, meta.bufferStickers[0] + even.targets.slice(1));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'wrong-at');
		await expect(page.locator('[data-verdict]')).toContainText('버퍼 스티커');
	});
});

test.describe('T4-2 하드웨어 키보드 (FR-TR-18)', () => {
	test('코너 세션은 소문자로 쳐도 대문자로 들어간다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-entry]').focus();
		await page.keyboard.type(free.slice(0, 2).join('').toLowerCase());
		expect(await entryValue(page)).toBe(free.slice(0, 2).join(''));
	});

	test('엣지 세션은 대문자로 쳐도 소문자로 들어간다', async ({ page }) => {
		await open(page, EVEN, { 'trace.pieceKind': 'edge' });
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		await page.locator('[data-entry]').focus();
		await page.keyboard.type('KB');
		expect(await entryValue(page)).toBe('kb');
	});

	test('Backspace 는 한 글자, Escape 는 전체를 지운다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-entry]').focus();
		await page.keyboard.type(free.slice(0, 3).join(''));
		await page.keyboard.press('Backspace');
		expect(await entryValue(page)).toBe(free.slice(0, 2).join(''));
		await page.keyboard.press('Escape');
		expect(await entryValue(page)).toBe('');
	});

	test('Enter 로 제출한다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await page.locator('[data-entry]').focus();
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
		expect(await entryValue(page)).toBe('');
	});

	test('패드와 키보드를 섞어도 한 열에 순서대로 쌓인다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await key(page, free[0]).click();
		await page.locator('[data-entry]').focus();
		await page.keyboard.type(free[1]);
		await key(page, free[2]).click();
		expect(await entryValue(page)).toBe(free.slice(0, 3).join(''));
	});
});

/**
 * 구획이 둘이던 때의 성질을 한 줄 위에서 다시 세운다.
 *
 * 비틀림 선언은 이제 자리가 아니라 **판독** 으로 갈린다 (`readEntry`). 그래서
 * 여기서 확인할 것은 "구획이 열렸는가" 가 아니라 "같은 줄에 적은 선언이 채점에
 * 반영되는가" 다.
 */
test.describe('T4-3 한 줄 입력과 관례 (FR-TR-18, 24)', () => {
	test('비틀림 선언을 같은 줄에 적어도 채점된다', async ({ page }) => {
		const list = twistB.result.twists;
		expect(list.length).toBeGreaterThanOrEqual(2);
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets + list.join(''));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		// 판독이 그 문자들을 비틀림으로 읽었다고 화면이 밝힌다 (요구 1).
		await expect(page.locator('[data-reading]')).toHaveAttribute('data-read-convention', 'B');
	});

	test('비틀림은 집합이라 순서를 바꿔도 정답이다', async ({ page }) => {
		const list = twistB.result.twists;
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets + [...list].reverse().join(''));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
	});

	test('버퍼 문자도 같은 줄에서 비틀림 선언으로 읽힌다', async ({ page }) => {
		const buffer = twistB.result.twists.filter((t) => meta.bufferStickers.includes(t));
		expect(buffer).toHaveLength(1);
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets + twistB.result.twists.join(''));
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		// 버퍼 문자가 타깃이 아니라 선언 쪽으로 갔다.
		expect(await page.locator('[data-reading]').getAttribute('data-read-twists')).toContain(
			buffer[0]
		);
	});

	/**
	 * 관례 토글이 결과 패널로 옮겨 갔다 (요구 3 재검토).
	 *
	 * 이 토글은 채점 기준이 아니라 **정답 예시의 표시 방식** 이다. 그것을 화면이
	 * 증명하는 방법은 하나뿐이다 — 눌렀을 때 정답 예시만 갈리고 판정도 기록도
	 * 그대로여야 한다. 다시 채점하면 그 순간 이 토글은 채점 기준이 된다.
	 */
	test('결과에서 관례를 바꾸면 정답 예시만 갈린다 @viewport', async ({ page }) => {
		// 비틀림이 있는 스크램블이어야 두 관례의 정답이 다르다. 없으면 글자까지 같다.
		expect(twistB.targets).not.toBe(twistA.targets);
		await open(page, TWIST, { 'trace.convention': 'A' });
		await play(page, twistA.targets);
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-answer]')).toHaveText(twistA.targets);

		const verdict = await page.locator('[data-verdict]').innerText();
		const records = () =>
			page.evaluate(
				() => JSON.parse(localStorage.getItem('trace.records') ?? '{}').records.length
			);
		const kept = await records();

		/*
		 * 입력 구획은 결과 패널 **위** 에 있다. 뷰포트 좌표가 아니라 문서 좌표로
		 * 잰다 — 토글은 화면 아래쪽이라 누르면 브라우저가 스크롤하고, `boundingBox`
		 * 로 재면 그 스크롤을 레이아웃 밀림으로 오인한다.
		 */
		const place = () =>
			page.locator('[data-section="entry"]').evaluate((el) => {
				const r = el.getBoundingClientRect();
				return { top: r.top + window.scrollY, height: r.height };
			});
		const before = await place();

		await page.locator('[data-toggle="trace-convention"] [data-option="B"]').click();
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveAttribute(
			'data-value',
			'B'
		);

		// 정답 예시가 그 자리에서 갈린다. 채점은 다시 돌지 않는다.
		await expect(page.locator('[data-answer]')).toHaveText(twistB.targets);
		expect(await page.locator('[data-verdict]').innerText()).toBe(verdict);
		expect(await records()).toBe(kept);

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

	test('버퍼막힘 자리를 다르게 잡은 다른 유효 메모도 정답이다', async ({ page }) => {
		// 문자열이 다른데도 정답이어야 한다 — 정답은 하나가 아니다 (FR-TR-10).
		expect(evenAlt).not.toBe(even.targets);
		await open(page, EVEN);
		await play(page, evenAlt);
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		// 화면의 정답 예시는 사용자의 입력과 다르다. 그렇다고 오답이 되지 않는다.
		await expect(page.locator('[data-answer]')).toHaveText(even.targets);
	});

	test('불필요한 버퍼막힘은 오답이 아니라 별도 문구다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets + extraLetter + extraLetter);
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct-extra');
		await expect(page.locator('[data-verdict]')).toContainText('불필요한 버퍼막힘');
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

test.describe('T4-5 패리티와 비틀림 표시 (FR-TR-13)', () => {
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

	// 관례 A/B 의 타깃 수 비교 줄은 없앴다. 쓸모가 없다고 판정됐다 (SPEC 의
	// FR-TR-24 는 아직 이 표시를 적고 있고, 문서 정리는 별건이다).
	test('관례 타깃 수 비교 줄이 없다', async ({ page }) => {
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets + twistB.result.twists.join(''));
		await expect(page.locator('[data-convention-compare]')).toHaveCount(0);
		await expect(page.locator('[data-result-panel]')).not.toContainText('관례 A');
	});

	test('관례 B 결과의 버퍼 비틀림은 따로 표시된다', async ({ page }) => {
		await open(page, TWIST, { 'trace.convention': 'B' });
		await play(page, twistB.targets + twistB.result.twists.join(''));
		await expect(page.locator('[data-answer-twists] [data-buffer="true"]')).toHaveCount(1);
		await expect(page.locator('[data-buffer-note]')).toContainText('버퍼');
		// 방향 마커를 쓰지 않는다 — 비틀림은 문자 하나다 (FR-TR-25).
		const text = await page.locator('[data-answer-twists]').innerText();
		expect(text).not.toContain("'");
	});
});

/**
 * 요구 2 — `both` 한 판을 한 줄로 치고 한 번에 채점한다.
 *
 * 코너를 제출·채점한 뒤 엣지를 이어서 받던 반씩 채점은 없앴다. 여기서 보는 것은
 * 구분자가 갈래를 가르는가, 판정이 갈래별로 나오는가, 기록이 한 건인가 셋이다.
 */
test.describe('T4-8 both 한 번에 (요구 2)', () => {
	const both = { 'trace.pieceKind': 'both' };

	test('구분자 버튼이 패드를 엣지로 바꾸고, 지우면 되돌아온다', async ({ page }) => {
		await open(page, EVEN, both);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'corner');
		await key(page, free[0]).click();
		await page.locator('[data-pad="entry"] [data-action="separator"]').click();
		expect(await entryValue(page)).toBe(free[0] + ENTRY_SEPARATOR);
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		// 패드 글자가 엣지 문자로 바뀐다.
		const labels = (await keys(page).allInnerTexts()).join('');
		expect(labels).toBe(labels.toLowerCase());
		// 구분자는 한 번뿐이라 버튼이 잠긴다.
		await expect(page.locator('[data-pad="entry"] [data-action="separator"]')).toBeDisabled();
		// 삭제로 구분자를 지우면 코너로 되돌아온다.
		await page.locator('[data-pad="entry"] [data-action="back"]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'corner');
		expect((await keys(page).allInnerTexts()).join('')).toBe(CORNER_LETTERS.join(''));
	});

	test('구분자 버튼의 라벨이 무엇이 시작되는지 적는다', async ({ page }) => {
		await open(page, EVEN, both);
		await expect(page.locator('[data-pad="entry"] [data-action="separator"]')).toHaveText(
			SEPARATOR_LABEL
		);
	});

	test('코너·엣지 전용 판에서는 구분자 버튼이 자리만 지킨 채 감춰진다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		const sep = page.locator('[data-pad="entry"] [data-action="separator"]');
		// 버튼은 **사라지지 않는다** — 개수가 설정에 따라 갈리면 SSR/CSR 이 어긋난다.
		await expect(sep).toHaveCount(1);
		await expect(sep).toBeDisabled();
		// 눈에서만 지운다. `display: none` 이면 자리가 사라져 나머지 두 칸이 넓어진다.
		await expect(sep).toHaveAttribute('data-hidden', 'true');
		expect(await sep.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
		expect(await sep.evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
	});

	test('both 판에서는 구분자 버튼이 보이고 포인트 컬러로 선다', async ({ page }) => {
		await open(page, EVEN, both);
		await page.locator('[data-start]').click();
		const sep = page.locator('[data-pad="entry"] [data-action="separator"]');
		await expect(sep).toBeVisible();
		await expect(sep).toBeEnabled();
		// 색 하나로 알리지 않는다 (#26) — 테두리와 굵기가 함께 선다.
		const own = await sep.evaluate((el) => {
			const s = getComputedStyle(el);
			return { color: s.color, border: s.borderTopColor, weight: Number(s.fontWeight) };
		});
		const other = await page
			.locator('[data-pad="entry"] [data-action="clear"]')
			.evaluate((el) => {
				const s = getComputedStyle(el);
				return { color: s.color, border: s.borderTopColor, weight: Number(s.fontWeight) };
			});
		expect(own.color).not.toBe(other.color);
		expect(own.border).not.toBe(other.border);
		expect(own.weight).toBeGreaterThan(other.weight);
	});

	test('한 줄로 이어 치고 한 번에 채점한다', async ({ page }) => {
		await open(page, EVEN, both);
		await play(page, bothEntry);
		// 제출은 한 번이고 결과가 곧바로 나온다 — 중간 채점이 없다.
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
		// 두 갈래가 결과에 함께 있다.
		await expect(page.locator('[data-part]')).toHaveCount(2);
		await expect(page.locator('[data-part="corner"] [data-answer]')).toHaveText(even.targets);
		await expect(page.locator('[data-part="edge"] [data-answer]')).toHaveText(evenEdge.targets);
	});

	test('한쪽만 틀리면 어느 쪽인지 알 수 있다', async ({ page }) => {
		await open(page, EVEN, both);
		// 코너는 맞게, 엣지는 짧게 적는다.
		await play(page, `${even.targets}${ENTRY_SEPARATOR}${evenEdge.targets.slice(0, 2)}`);
		await expect(page.locator('[data-part="corner"]')).toHaveAttribute(
			'data-part-kind',
			'correct'
		);
		await expect(page.locator('[data-part="edge"]')).toHaveAttribute(
			'data-part-kind',
			'incomplete'
		);
		// 한 줄 판정에도 어느 갈래인지가 남는다.
		await expect(page.locator('[data-verdict]')).toContainText('엣지');
		await expect(page.locator('[data-verdict]')).toContainText('남았습니다');
	});

	test('구분자를 안 넣으면 엣지 열이 비어 있는 것으로 채점된다', async ({ page }) => {
		await open(page, EVEN, both);
		await play(page, even.targets);
		await expect(page.locator('[data-part="corner"]')).toHaveAttribute(
			'data-part-kind',
			'correct'
		);
		await expect(page.locator('[data-part="edge"]')).toHaveAttribute(
			'data-part-kind',
			'incomplete'
		);
	});

	test('기록은 한 판에 한 건이고 두 갈래가 함께 남는다', async ({ page }) => {
		await open(page, EVEN, both);
		await play(page, bothEntry);
		const recs = await page.evaluate(
			() => JSON.parse(localStorage.getItem('trace.records')!).records
		);
		expect(recs).toHaveLength(1);
		expect(recs[0].pieceKind).toBe('both');
		// 타깃 수는 두 갈래의 합이다 — 시간도 합쳐 잰 값이라 단위가 맞는다.
		expect(recs[0].targetCount).toBe(
			even.result.targets.length + evenEdge.result.targets.length
		);
		expect(recs[0].correct).toBe(true);
		// 두 버퍼가 한 칸에 함께 남는다.
		expect(recs[0].buffer).toContain(meta.buffer);
		expect(recs[0].buffer).toContain(edgeMeta.buffer);
	});

	test('한쪽만 맞은 판은 오답으로 남는다', async ({ page }) => {
		await open(page, EVEN, both);
		await play(page, `${even.targets}${ENTRY_SEPARATOR}${evenEdge.targets.slice(0, 2)}`);
		const rec = await page.evaluate(
			() => JSON.parse(localStorage.getItem('trace.records')!).records[0]
		);
		expect(rec.correct).toBe(false);
	});

	test('대소문자가 어긋나도 구분자가 정본이다', async ({ page }) => {
		await open(page, EVEN, both);
		await page.locator('[data-start]').click();
		// 구분자 뒤에 대문자로 쳐도 엣지로 읽는다. 어긋난 글자 수만 따로 알린다.
		await page.locator('[data-entry]').fill(`${even.targets}${ENTRY_SEPARATOR}${evenEdge.targets.toUpperCase()}`);
		expect(await entryValue(page)).toBe(bothEntry);
		await expect(page.locator('[data-case-hint]')).toHaveAttribute(
			'data-conflicts',
			String(evenEdge.targets.length)
		);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct');
	});
});

test.describe('T4-6 시간과 기록 (FR-TR-23)', () => {
	test('세 판을 돌리면 직전 기록들이 모달에 보인다', async ({ page }) => {
		await open(page, EVEN);
		for (let i = 0; i < 3; i++) {
			await play(page, even.targets);
			await page.locator('[data-next]').click();
		}
		// 본문에는 개수만 남는다 — 50건이 쌓이면 이 화면이 기록 화면이 된다.
		await expect(page.locator('[data-record-count]')).toHaveAttribute('data-record-count', '3');
		await openRecords(page);
		await expect(page.locator('[data-record]')).toHaveCount(3);
	});

	/**
	 * 요구 7 — 기록을 읽을 수 있게 만든다.
	 *
	 * 자릿수가 세로로 맞아야 두 기록을 비교할 수 있다. 강조도 그래프도 없고
	 * (NFR-TR-5) 바뀐 것은 정렬뿐이다.
	 */
	test('기록이 자릿수 맞은 표로 나온다 @viewport', async ({ page }) => {
		// 시간과 타깃 수의 자릿수가 서로 다른 세 건을 심는다.
		const seeded = JSON.stringify({
			schemaVersion: RECORDS_SCHEMA_VERSION,
			records: [
				{ at: 1755660003000, ms: 7010, pieceKind: 'corner', buffer: meta.buffer, mode: 'follow', twistConvention: 'A', targetCount: 8, correct: true },
				{ at: 1755660002000, ms: 84210, pieceKind: 'both', buffer: meta.buffer, mode: 'follow', twistConvention: 'A', targetCount: 20, correct: false },
				{ at: 1755660001000, ms: 123, pieceKind: 'edge', buffer: meta.buffer, mode: 'memorize', twistConvention: 'B', targetCount: 12, correct: true }
			]
		});
		await open(page, EVEN, { 'trace.records': seeded });
		await openRecords(page);
		await expect(page.locator('[data-record]')).toHaveCount(3);
		const cells = page.locator('[data-record] td.num');
		// 숫자 칸은 같은 오른쪽 끝에서 끝난다 — 그것이 자릿수가 맞았다는 뜻이다.
		const rights = await cells.evaluateAll((els) =>
			els.map((el) => Math.round(el.getBoundingClientRect().right))
		);
		expect(rights.length).toBe(6);
		expect(new Set(rights.filter((_, i) => i % 2 === 0)).size).toBe(1);
		expect(new Set(rights.filter((_, i) => i % 2 === 1)).size).toBe(1);
		// 글자 폭이 고른 숫자여야 오른쪽 정렬이 실제로 자릿수를 맞춘다.
		const numeric = await cells
			.first()
			.evaluate((el) => getComputedStyle(el).fontVariantNumeric);
		expect(numeric).toContain('tabular-nums');
	});

	test('기록 표에 강조도 그래프도 없다', async ({ page }) => {
		const seeded = JSON.stringify({
			schemaVersion: RECORDS_SCHEMA_VERSION,
			records: [
				{ at: 1755660002000, ms: 7010, pieceKind: 'corner', buffer: meta.buffer, mode: 'follow', twistConvention: 'A', targetCount: 8, correct: true },
				{ at: 1755660001000, ms: 99010, pieceKind: 'corner', buffer: meta.buffer, mode: 'follow', twistConvention: 'A', targetCount: 8, correct: true }
			]
		});
		await open(page, EVEN, { 'trace.records': seeded });
		await openRecords(page);
		const text = await page.locator('[data-records]').innerText();
		for (const word of ['최고', '신기록', '평균', '축하'])
			expect(text, word).not.toContain(word);
		await expect(page.locator('[data-records] svg, [data-records] canvas')).toHaveCount(0);
		// 두 줄의 배경이 같다 — 빠른 판을 색으로 치켜세우지 않는다.
		const bgs = await page
			.locator('[data-record]')
			.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
		expect(new Set(bgs).size).toBe(1);
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
			schemaVersion: RECORDS_SCHEMA_VERSION,
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
		await expect(page.locator('[data-record-count]')).toHaveAttribute('data-record-count', '1');
		await openRecords(page);
		await expect(page.locator('[data-record]')).toHaveCount(1);
	});
});

/**
 * 요구 3 — 판정 표시를 퀴즈 화면과 같게 한다.
 *
 * `quiz-feedback.spec.ts` 가 보는 것과 **같은 성질** 이다: 입력창 자체가 칠해지고,
 * 색은 언제나 문구와 함께 선다 (#26).
 */
test.describe('T4-9 판정 표시 (요구 3)', () => {
	test('채점 전에는 입력창이 칠해지지 않는다', async ({ page }) => {
		await open(page, EVEN);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-entry]')).toHaveAttribute('data-result', '');
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-result', '');
	});

	test('정답이면 입력창과 판정 줄이 함께 녹색이 된다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		await expect(page.locator('[data-entry]')).toHaveAttribute('data-result', 'ok');
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-result', 'ok');
		// 색만으로 알리지 않는다 — 같은 자리에 판정 문구가 서 있다 (#26).
		await expect(page.locator('[data-verdict]')).toHaveText('정답');
	});

	test('오답이면 빨강이고 이유가 글자로 남는다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets.slice(0, 2));
		await expect(page.locator('[data-entry]')).toHaveAttribute('data-result', 'bad');
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-result', 'bad');
		await expect(page.locator('[data-verdict]')).toContainText('남았습니다');
	});

	test('불필요한 버퍼막힘은 풀리므로 녹색이다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets + extraLetter + extraLetter);
		await expect(page.locator('[data-verdict]')).toHaveAttribute('data-kind', 'correct-extra');
		await expect(page.locator('[data-entry]')).toHaveAttribute('data-result', 'ok');
	});

	test('정답 예시와 입력창이 결과 상자의 잔글씨보다 크다', async ({ page }) => {
		await open(page, EVEN);
		await play(page, even.targets);
		const size = (sel: string) =>
			page.locator(sel).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		const body = await size('[data-answer-note]');
		// 실제로 읽는 두 줄이다. 꼬리표와 같은 크기면 눈이 어디를 봐야 할지 모른다.
		expect(await size('[data-answer]')).toBeGreaterThan(body);
		expect(await size('[data-entry]')).toBeGreaterThan(body);
		// 판정 줄은 퀴즈와 같은 0.95rem = 15.2px 다.
		expect(await size('[data-verdict]')).toBeGreaterThan(15);
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
		// 구분자 버튼이 보이는 판으로 연다 — 감춰진 버튼은 잴 수는 있어도 무의미하다.
		await open(page, EVEN, { 'trace.pieceKind': 'both' });
		for (const sel of [
			'[data-pad="entry"] button[data-letter]',
			'[data-pad="entry"] [data-action="back"]',
			'[data-pad="entry"] [data-action="clear"]',
			'[data-pad="entry"] [data-action="separator"]'
		]) {
			const box = (await page.locator(sel).first().boundingBox())!;
			expect(box.height, sel).toBeGreaterThanOrEqual(44);
		}
	});

	test('320px 폭에서 가로 스크롤이 생기지 않는다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await open(page, EVEN, { 'trace.pieceKind': 'both' });
		await page.locator('[data-start]').click();
		await page.locator('[data-entry]').fill(bothEntry);
		await page.locator('[data-grade]').click();
		const over = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(over).toBeLessThanOrEqual(0);
	});

	test('잠긴 세션 토글은 색 말고 다른 신호도 함께 준다', async ({ page }) => {
		await open(page, EVEN);
		const toggle = page.locator('[data-toggle="trace-kind"]');
		const style = () =>
			toggle.evaluate((el) => {
				const s = getComputedStyle(el);
				const b = getComputedStyle(el.querySelector('button')!);
				return { opacity: Number(s.opacity), cursor: b.cursor };
			});
		await expect(toggle).toHaveAttribute('data-locked', 'false');
		const before = await style();
		await page.locator('[data-start]').click();
		await expect(toggle).toHaveAttribute('data-locked', 'true');
		const after = await style();
		// 색 하나로 알리지 않는다 — 투명도와 커서가 함께 바뀐다 (#26).
		expect(after.opacity).toBeLessThan(before.opacity);
		expect(after.cursor).toBe('not-allowed');
		expect(before.cursor).not.toBe('not-allowed');
	});
});
