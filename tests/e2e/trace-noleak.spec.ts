/**
 * Phase 5 — 뒷면 누출 금지와 하이라이트 E2E (FR-TR-15, 16).
 *
 * **이 파일이 0.5.0 의 마지막 못이다.** 하이라이트를 붙이다 보면 "조금만 보여주면
 * 편한데" 가 반드시 나오고, 그 순간 3D 를 쓰는 이유가 통째로 사라진다. 전개도 대신
 * 3D 를 고른 것은 뒷면을 **돌려야만** 볼 수 있게 하기 위해서다.
 *
 * ─── 어떻게 재는가 ──────────────────────────────────────────
 * 하이라이트 색은 스티커 6색과 겹치지 않는 청록·자홍·연보라다(`MARK_PALETTE`).
 * 그래서 캔버스에서 그 세 색의 픽셀만 세면 "지금 무엇이 칠해져 있는가" 를 바깥에서
 * 셀 수 있다.
 *
 * ─── 훈련 중에는 버퍼만이다 (요구 2 재검토) ────────────────
 * 처음에는 입력한 문자를 따라 현재 타깃·지나간 조각을 칠했다. 그것은 **문자 →
 * 위치 매핑을 대신 해 주는 것** 이고, 그 매핑은 트레이싱이 아니라 그 앞 단계의
 * 기술이다. 더 나쁜 것은 브루트포스가 열린다는 점이다 — 스티커의 문자를 몰라도
 * 아무 글자나 눌러 가며 어디가 켜지는지 보면 된다. SPEC 이 "막혔을 때 다음 조각
 * 하이라이트" 를 FR-TR-15 와 충돌한다며 거부한 것과 같은 부류다.
 *
 * 그래서 훈련 중에는 자홍(현재 타깃)과 연보라(지나간 조각)가 **언제나 0** 이다.
 * 무엇을 얼마나 치든 그렇다. 정답 경로는 **채점이 끝난 뒤** 에만 칠해진다 — 판이
 * 끝났으므로 힌트가 될 것이 없고, 그때부터는 복기가 그 표시의 몫이다.
 * ────────────────────────────────────────────────────────────
 *
 * 캔버스는 돌려야 보이지만 DOM 은 개발자 도구로 그냥 보인다. 그래서 T5-2 의 본론은
 * 픽셀이 아니라 **DOM 텍스트와 속성** 이다.
 * ────────────────────────────────────────────────────────────
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';
import Cube from 'cubejs/lib/cube.js';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };
import { stateFromFacelets } from '../../src/lib/cube/sim.js';
import { trace } from '../../src/lib/cube/trace.js';
import { optionsFrom, MARK_PALETTE } from '../../src/lib/domain/tracing.js';
import { CORNER_INDEX } from '../../src/lib/cube/speffz.js';

const meta = (data as unknown as { meta: Parameters<typeof optionsFrom>[0] & { buffer: string } })
	.meta;

/** 고정 스크램블. 워커 스텁으로 주입한다 — `trace-input.spec.ts` 와 같은 방식이다. */
const FIXED = "R2 B' U2 L2 U2 D2 B' F2 U' B F2 U2 D2 R2 L B2 U F2 U' R' U' D' L R B2";
const facelets = new Cube().move(FIXED).asString();
const answer = trace(stateFromFacelets(facelets, 'corner'), optionsFrom(meta, 'corner', 'A'));
const targets = answer.targets.join('');

/**
 * 이 각도(VIEW=15, U·L·B)에서 화면에 걸리는 facelet 인덱스.
 * 면 순서는 `URFDLB` 이므로 U 는 0..8, L 은 36..44, B 는 45..53 이다.
 */
const onVisibleFace = (i: number): boolean => i < 9 || i >= 36;

/**
 * 정답 경로 중 이 각도에서 실제로 보이는 스티커.
 *
 * 하나도 없으면 픽셀로는 "안 칠했다" 와 "안 보인다" 를 구분할 수 없다. 픽스처를
 * 갈아 끼웠을 때 검사가 조용히 무력해지는 대신 여기서 먼저 걸리게 한다.
 */
const shownAnswer = answer.targets.filter((t) => onVisibleFace(CORNER_INDEX[t]));

async function open(
	page: Page,
	settings: Record<string, string> = {}
): Promise<void> {
	await page.addInitScript(
		([scramble, store]: [string, Record<string, string>]) => {
			for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
			/*
			 * 카메라 각도를 고정한다 (FR-TR-17 은 무작위를 요구하지만, 픽셀로 재는
			 * 검사는 각도가 흔들리면 성립하지 않는다). `Math.floor(0.625 * 24) = 15`
			 * 이고 15번은 `orientationOf` 상 **U·L·B** 면을 보는 각도다 — 버퍼 UBL 의
			 * 스티커 셋이 모두 이 세 면에 있다. 각도 산식이 바뀌면 `open()` 의
			 * `data-orientation` 확인이 먼저 깨져 원인이 바로 드러난다.
			 */
			Math.random = () => 0.625;
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
		[FIXED, settings] as [string, Record<string, string>]
	);
	await page.goto('/trace');
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-orientation', String(VIEW));
	await expect(page.locator('[data-start]')).toBeEnabled({ timeout: 15_000 });
}

/** 고정 카메라 각도. U·L·B 를 보는 각도라 버퍼 UBL 이 언제나 화면 안에 있다. */
const VIEW = 15;

/**
 * 이 각도에서 **반드시 보이는** 타깃 문자들.
 *
 * 하이라이트가 칠해졌는지는 픽셀로 재므로, 뒤에 숨은 조각을 고르면 "안 칠해졌다" 와
 * "안 보인다" 를 구분할 수 없다. U 면에 스티커를 가진 코너만 쓴다 (버퍼 제외).
 */
const SHOWN = 'BCD';

const canvas = (page: Page): Locator => page.locator('canvas[data-cube3d]');

/** WebGL 캔버스는 스크린샷으로 읽는다 — `toDataURL` 은 비어 나온다. */
async function pixels(page: Page): Promise<{ data: Buffer; channels: number }> {
	const shot = await canvas(page).screenshot();
	const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
	return { data, channels: info.channels };
}

const rgb = (hex: string): [number, number, number] => [
	parseInt(hex.slice(1, 3), 16),
	parseInt(hex.slice(3, 5), 16),
	parseInt(hex.slice(5, 7), 16)
];

/**
 * 팔레트 세 색의 픽셀 수. 허용 오차는 채널당 24 다 — 스티커 6색과 팔레트 3색은
 * 어느 채널에서든 그보다 훨씬 멀리 떨어져 있어(단위 테스트가 확인한다) 서로를
 * 오인할 수 없다.
 */
async function marks(page: Page): Promise<{ buffer: number; current: number; visited: number }> {
	const { data, channels } = await pixels(page);
	const want = {
		buffer: rgb(MARK_PALETTE.buffer.color),
		current: rgb(MARK_PALETTE.current.color),
		visited: rgb(MARK_PALETTE.visited.color)
	};
	const out = { buffer: 0, current: 0, visited: 0 };
	for (let i = 0; i + channels <= data.length; i += channels) {
		for (const [name, c] of Object.entries(want) as [keyof typeof out, number[]][]) {
			if (
				Math.abs(data[i] - c[0]) <= 24 &&
				Math.abs(data[i + 1] - c[1]) <= 24 &&
				Math.abs(data[i + 2] - c[2]) <= 24
			)
				out[name]++;
		}
	}
	return out;
}

/** 캔버스에 색이 실릴 때까지 기다린다. 그리기는 rAF 라 한 프레임 늦는다. */
async function settled(page: Page): Promise<void> {
	await expect.poll(async () => (await marks(page)).buffer, { timeout: 8000 }).toBeGreaterThan(0);
}

test.describe('T5-2 뒷면 누출 금지 (FR-TR-15)', () => {
	test('훈련 중 DOM 어디에도 스크램블 문자열이 없다', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
		const text = await page.locator('body').innerText();
		// 우리가 무엇을 주입했는지 알고 있으므로 그 문자열 자체를 찾는다.
		expect(text).not.toContain(FIXED);
		expect(text).not.toContain(FIXED.slice(0, 12));
		// 무브 표기가 연달아 셋 이상 나오면 어떤 형태로든 샌 것이다.
		expect(text).not.toMatch(/(?:[URFDLB][2']?\s+){2}[URFDLB][2']?/);
		// 정답 타깃 열도 훈련 중에는 화면에 없다.
		expect(text).not.toContain(targets);
	});

	test('facelet 배열·색 배열이 속성으로 새지 않는다', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
		const attrs = await page.evaluate(() =>
			[...document.querySelectorAll('*')].flatMap((el) =>
				[...el.attributes].map((a) => `${a.name}=${a.value}`)
			)
		);
		const joined = attrs.join('\n');
		// 54칸 facelet 문자열도, 색 배열도, 스크램블도 없다.
		expect(joined).not.toMatch(/[URFDLB]{9,}/);
		expect(joined).not.toMatch(/(#[0-9a-fA-F]{6}[^\n]*){3}/);
		expect(joined).not.toContain(FIXED);
	});

	test('미니맵·전개도·힌트 보조 표시가 없다', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		// 캔버스는 하나뿐이다. 두 번째 캔버스는 곧 미니맵이다.
		await expect(canvas(page)).toHaveCount(1);
		await expect(page.locator('canvas')).toHaveCount(1);
		// 훈련 영역 안에는 벡터 그림이 없다. 전개도가 들어온다면 여기다.
		// (레이아웃의 내비게이션 아이콘은 이 화면의 것이 아니다.)
		await expect(page.locator('[data-stage] svg')).toHaveCount(0);
		await expect(page.locator('[data-stage] img')).toHaveCount(0);
		const text = await page.locator('body').innerText();
		for (const word of ['미니맵', '전개도', '힌트', '펼쳐', '보여주기'])
			expect(text, word).not.toContain(word);
	});

	test('훈련 중에는 정답 경로가 칠해지지 않는다', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await settled(page);
		const m = await marks(page);
		// 버퍼는 늘 보인다. 정답 경로를 미리 칠했다면 여기서 현재·지나감이 잡힌다.
		expect(m.buffer).toBeGreaterThan(0);
		expect(m.current).toBe(0);
		expect(m.visited).toBe(0);
	});

	test('돌리기 전에는 뒷면 색을 알 수 없다 @viewport', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await settled(page);
		const before = (await pixels(page)).data;
		const box = (await canvas(page).boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		// 반 바퀴. 그때 처음 반대쪽이 보인다.
		await page.mouse.move(box.x + box.width / 2 + box.width * 1.2, box.y + box.height / 2, {
			steps: 12
		});
		await page.mouse.up();
		await expect
			.poll(async () => (await pixels(page)).data.equals(before), { timeout: 8000 })
			.toBe(false);
	});

	test('memorize 의 입력 단계에는 캔버스도 색도 없다', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await page.locator('[data-start]').click();
		await page.locator('[data-memorized]').click();
		await expect(canvas(page)).toHaveCount(0);
		await expect(page.locator('[data-cube-hidden]')).toBeVisible();
		const attrs = await page.evaluate(() =>
			[...document.querySelectorAll('*')]
				.flatMap((el) => [...el.attributes].map((a) => a.value))
				.join('\n')
		);
		// 색 **배열** 이 없다는 것이 요점이다. `theme-color` 한 칸은 이 화면의 것이 아니다.
		expect(attrs).not.toMatch(/(#[0-9a-fA-F]{6}[^\n]*){3}/);
		expect(attrs).not.toMatch(/[URFDLB]{9,}/);
		expect(await page.locator('body').innerText()).not.toContain(targets);
	});
});

test.describe('T5-3 하이라이트 (FR-TR-16)', () => {
	test('회색 단계에는 하이라이트가 없다', async ({ page }) => {
		await open(page);
		// idle 은 색 배열 자체가 없는 단계다 (FR-TR-22). 칠할 것도 없다.
		await expect.poll(async () => (await marks(page)).buffer, { timeout: 8000 }).toBe(0);
		const m = await marks(page);
		expect(m.current).toBe(0);
		expect(m.visited).toBe(0);
	});

	test('트레이싱 중에는 버퍼만 칠한다', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await settled(page);
		const before = await marks(page);
		expect(before.buffer).toBeGreaterThan(0);
		expect(before.current).toBe(0);
		expect(before.visited).toBe(0);

		// 이 각도에서 **보이는** 자리의 문자를 친다. 안 보이는 문자를 쳐서 0 이 나오면
		// 무엇을 확인한 것인지 알 수 없다.
		await page.locator('[data-entry]').fill(SHOWN);
		await expect(page.locator('[data-entry]')).toHaveValue(SHOWN);
		await page.waitForTimeout(300);
		const after = await marks(page);
		expect(after.current).toBe(0);
		expect(after.visited).toBe(0);
		expect(after.buffer).toBeGreaterThan(0);
	});

	test('입력이 길어져도 하이라이트가 늘지 않고 채점까지 간다', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await settled(page);
		const many = SHOWN + 'FGHIJKLMNOPQSTUVWX';
		expect(many.length).toBeGreaterThanOrEqual(20);
		await page.locator('[data-entry]').fill(many);
		expect((await page.locator('[data-entry]').inputValue()).length).toBe(many.length);
		await page.waitForTimeout(300);
		const m = await marks(page);
		expect(m.current).toBe(0);
		expect(m.visited).toBe(0);
		// 오류 없이 계속 돈다 — 채점까지 간다.
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
	});

	test('채점이 끝나면 정답 예시 경로가 칠해진다', async ({ page }) => {
		// 픽스처 가드 — 정답 경로가 이 각도에서 하나도 안 보이면 픽셀로 잴 수 없다.
		expect(shownAnswer.length).toBeGreaterThan(0);
		await open(page);
		await page.locator('[data-start]').click();
		await settled(page);
		await page.locator('[data-grade]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		// 판이 끝났으므로 힌트가 아니다. 여기서부터는 복기가 이 표시의 몫이다.
		await expect
			.poll(
				async () => {
					const m = await marks(page);
					return m.current + m.visited;
				},
				{ timeout: 8000 }
			)
			.toBeGreaterThan(0);
		expect((await marks(page)).buffer).toBeGreaterThan(0);
		// 다음 문제로 가면 회색으로 돌아가고 칠도 걷힌다.
		await page.locator('[data-next]').click();
		await expect.poll(async () => (await marks(page)).buffer, { timeout: 8000 }).toBe(0);
	});
});

test.describe('T5-4 회귀 @viewport', () => {
	test('320px 폭에서 캔버스가 화면 안에 들어온다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await open(page);
		await page.locator('[data-start]').click();
		const box = (await canvas(page).boundingBox())!;
		expect(box.width).toBeLessThanOrEqual(320);
		const over = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(over).toBeLessThanOrEqual(0);
	});

	test('입력이 늘어도 레이아웃이 밀리지 않는다 @viewport', async ({ page }) => {
		await open(page);
		await page.locator('[data-start]').click();
		await settled(page);
		const place = () =>
			page.locator('[data-section="entry"]').evaluate((el) => {
				const r = el.getBoundingClientRect();
				return { top: r.top + window.scrollY, height: r.height };
			});
		const before = await place();
		await page.locator('[data-entry]').fill(SHOWN);
		await expect(page.locator('[data-entry]')).toHaveValue(SHOWN);
		const after = await place();
		expect(Math.abs(after.top - before.top)).toBeLessThan(1);
		expect(Math.abs(after.height - before.height)).toBeLessThan(1);
	});
});
