/**
 * Phase 3 — 트레이싱 세션 E2E (FR-TR-2, 17, 19, 21, 22, 23; NFR-TR-1, 5).
 *
 * 이 화면에서만 확인할 수 있는 것을 본다 — 상태 기계, 계시 규칙, 회색 시작,
 * 워커 반납. 채점의 옳고 그름은 단위 테스트(`trace.test.ts`)가 본다.
 *
 * 워커 초기화는 실측 1.7초다. 고정 `waitForTimeout` 으로 기다리지 않고 시작 버튼이
 * 열리는 것을 기다린다 — 느린 기계에서 조용히 깨지는 검사를 만들지 않는다.
 */
import { test, expect, type Locator, type Page } from '@playwright/test';
import sharp from 'sharp';

/** 워커 준비 대기. 초기화 + 큐 적재까지다. */
async function ready(page: Page): Promise<void> {
	await expect(page.locator('[data-start]')).toBeEnabled({ timeout: 30_000 });
}

async function open(page: Page, settings: Record<string, string> = {}): Promise<void> {
	await page.addInitScript((s) => {
		for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
	}, settings);
	await page.goto('/trace');
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'idle');
}

const canvas = (page: Page): Locator => page.locator('canvas[data-cube3d]');

/** 캔버스 픽셀. WebGL 캔버스는 스크린샷으로 읽는다 — `toDataURL` 은 비어 나온다. */
async function pixels(page: Page): Promise<{ data: Buffer; channels: number }> {
	const shot = await canvas(page).screenshot();
	const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
	return { data, channels: info.channels };
}

/** 채도 = 한 픽셀에서 R·G·B 의 최대 차이. 무채색이면 0 에 가깝다. */
function saturations({ data, channels }: { data: Buffer; channels: number }): number[] {
	const out: number[] = [];
	for (let i = 0; i + channels <= data.length; i += channels * 7) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];
		out.push(Math.max(r, g, b) - Math.min(r, g, b));
	}
	return out;
}

/** 세션 하나를 끝까지 돌린다. 채점 결과는 보지 않는다 — 여기서 볼 것이 아니다. */
async function playRound(page: Page, targets = 'ABC'): Promise<void> {
	await page.locator('[data-start]').click();
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
	if (await page.locator('[data-memorized]').isEnabled()) {
		await page.locator('[data-memorized]').click();
	}
	await page.locator('[data-targets]').fill(targets);
	await page.locator('[data-grade]').click();
	await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
}

const seconds = (text: string): number => {
	const m = /^(?:(\d+):)?(\d+)\.(\d+)$/.exec(text.trim());
	if (!m) throw new Error(`시간 표기가 아니다: ${text}`);
	return Number(m[1] ?? 0) * 60 + Number(m[2]) + Number(m[3]) / 100;
};

const elapsed = async (page: Page): Promise<number> =>
	seconds((await page.locator('[data-timer]').innerText()) ?? '');

test.describe('T3-1 회색 시작 (FR-TR-22)', () => {
	test('진입 시 캔버스가 있고 상태가 idle 이다', async ({ page }) => {
		await open(page);
		await expect(canvas(page)).toBeVisible();
	});

	test('시작 전에는 스크램블 문자열이 DOM 어디에도 없다', async ({ page }) => {
		await open(page);
		await ready(page);
		const text = await page.locator('body').innerText();
		// 무브 표기가 연달아 셋 이상 나오면 스크램블이 샌 것이다.
		expect(text).not.toMatch(/(?:[URFDLB][2']?\s+){2}[URFDLB][2']?/);
	});

	test('시작 전 캔버스는 전부 무채색이다', async ({ page }) => {
		await open(page);
		await ready(page);
		const sat = saturations(await pixels(page));
		expect(sat.length).toBeGreaterThan(100);
		expect(Math.max(...sat)).toBeLessThan(24);
	});

	// 드래그는 캔버스의 좌표를 재야 한다. 뷰포트 신호를 쓰므로 태그를 붙인다.
	test('회색 상태에서도 드래그로 돌아간다 @viewport', async ({ page }) => {
		await open(page);
		await ready(page);
		const before = (await pixels(page)).data;
		const box = (await canvas(page).boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 40, { steps: 8 });
		await page.mouse.up();
		await expect
			.poll(async () => (await pixels(page)).data.equals(before), { timeout: 5000 })
			.toBe(false);
	});

	test('시작을 누르면 색이 입혀진다', async ({ page }) => {
		await open(page);
		await ready(page);
		await page.locator('[data-start]').click();
		await expect
			.poll(async () => Math.max(...saturations(await pixels(page))), { timeout: 5000 })
			.toBeGreaterThan(60);
	});

	test('시작 직후 타이머가 0.00 에서 증가한다', async ({ page }) => {
		await open(page);
		await ready(page);
		expect(await elapsed(page)).toBe(0);
		await page.locator('[data-start]').click();
		await expect.poll(() => elapsed(page), { timeout: 5000 }).toBeGreaterThan(0.3);
	});
});

test.describe('T3-2 준비 중 (FR-TR-2)', () => {
	test('준비 전에는 시작 버튼이 잠겨 있고 준비 중이 보인다', async ({ page }) => {
		await open(page);
		// 초기화가 빠른 기계에서는 이미 끝났을 수 있다. 둘 중 하나가 참이면 된다.
		const status = await page.locator('[data-status]').innerText();
		if (!(await page.locator('[data-start]').isEnabled())) {
			expect(status).toContain('준비 중');
		}
		await ready(page);
		await expect(page.locator('[data-status]')).not.toContainText('준비 중');
	});

	test('연속 세 번 시작해도 기다리지 않는다', async ({ page }) => {
		await open(page);
		await ready(page);
		for (let i = 0; i < 3; i++) {
			await playRound(page);
			// 큐가 채워져 있으므로 다음 문제로 넘어가면 곧바로 다시 시작할 수 있다.
			await page.locator('[data-next]').click();
			await expect(page.locator('[data-start]')).toBeEnabled({ timeout: 2000 });
		}
	});
});

test.describe('T3-3 두 모드 (FR-TR-21, 23)', () => {
	test('follow 는 입력이 열려 있고 큐브가 계속 보인다', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-targets]')).toBeEnabled();
		await expect(page.locator('[data-memorized]')).toBeDisabled();
		await expect(canvas(page)).toBeVisible();
	});

	test('memorize 는 입력이 닫혀 있고 다 외웠다 버튼이 열린다', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-targets]')).toBeDisabled();
		await expect(page.locator('[data-memorized]')).toBeEnabled();
	});

	test('다 외웠다를 누르면 캔버스가 사라진다', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await ready(page);
		await page.locator('[data-start]').click();
		await page.locator('[data-memorized]').click();
		await expect(canvas(page)).toHaveCount(0);
		await expect(page.locator('[data-cube-hidden]')).toBeVisible();
		await expect(page.locator('[data-targets]')).toBeEnabled();
	});

	test('memorize 의 시간은 다 외웠다 시점에서 멈춘다 (FR-TR-23)', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect.poll(() => elapsed(page), { timeout: 5000 }).toBeGreaterThan(0.3);
		await page.locator('[data-memorized]').click();
		const stopped = await elapsed(page);
		// 입력 시간은 트레이싱 시간이 아니다. 한참 뒤에 채점해도 값이 그대로다.
		await page.locator('[data-targets]').fill('ABC');
		await page.waitForTimeout(900);
		await page.locator('[data-grade]').click();
		expect(await elapsed(page)).toBeCloseTo(stopped, 2);
	});

	test('follow 의 시간은 마지막 입력에서 멈춘다 (FR-TR-23)', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await page.locator('[data-targets]').fill('ABC');
		const atInput = await elapsed(page);
		// 채점을 누르기까지 생각한 시간은 트레이싱 시간이 아니다.
		await page.waitForTimeout(1200);
		await page.locator('[data-grade]').click();
		const recorded = await elapsed(page);
		expect(recorded).toBeLessThan(atInput + 0.6);
	});

	test('기록의 mode 필드가 모드마다 남는다', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await playRound(page);
		await page.locator('[data-next]').click();
		// 모드는 화면에서 바꾼다. `addInitScript` 는 새로고침마다 다시 심어지므로
		// 저장소를 직접 고치면 그 값이 되살아난다.
		await page.locator('[data-toggle="trace-mode"] [data-option="memorize"]').click();
		await playRound(page);
		const modes = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('trace.records') ?? '{}').records.map(
				(r: { mode: string }) => r.mode
			)
		);
		expect(modes).toEqual(['memorize', 'follow']);
	});
});

test.describe('T3-4 세션 설정 (FR-TR-19, 24)', () => {
	test('대상·모드·관례가 새로고침 후 복원된다', async ({ page }) => {
		await open(page);
		await page.locator('[data-toggle="trace-kind"] [data-option="edge"]').click();
		await page.locator('[data-toggle="trace-mode"] [data-option="memorize"]').click();
		await page.locator('[data-toggle="trace-convention"] [data-option="B"]').click();
		await page.reload();
		await expect(page.locator('[data-toggle="trace-kind"]')).toHaveAttribute('data-value', 'edge');
		await expect(page.locator('[data-toggle="trace-mode"]')).toHaveAttribute(
			'data-value',
			'memorize'
		);
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveAttribute(
			'data-value',
			'B'
		);
	});

	test('관례 B 에서만 비틀림 구획이 열린다', async ({ page }) => {
		await open(page, { 'trace.convention': 'B', 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-twists]')).toBeEnabled();
	});

	test('관례 A 에서는 비틀림 구획이 닫혀 있다', async ({ page }) => {
		await open(page, { 'trace.convention': 'A', 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-targets]')).toBeEnabled();
		await expect(page.locator('[data-twists]')).toBeDisabled();
	});

	test('both 는 같은 스크램블로 코너 다음 엣지를 이어서 한다', async ({ page }) => {
		await open(page, { 'trace.pieceKind': 'both', 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'corner');
		const painted = (await pixels(page)).data;
		await page.locator('[data-targets]').fill('ABC');
		await page.locator('[data-grade]').click();
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		// 같은 스크램블이면 같은 그림이다 — 카메라도 색도 그대로다.
		expect((await pixels(page)).data.equals(painted)).toBe(true);
	});

	test('트레이싱 기록을 남겨도 암기 진도가 그대로다 (AD-13)', async ({ page }) => {
		const seeded = JSON.stringify({
			schemaVersion: 1,
			checked: { setup: ['AB'], direct: [] }
		});
		await open(page, { 'memorize.checked': seeded });
		await ready(page);
		await playRound(page);
		expect(await page.evaluate(() => localStorage.getItem('memorize.checked'))).toBe(seeded);
		expect(await page.evaluate(() => localStorage.getItem('trace.records'))).toContain(
			'schemaVersion'
		);
	});
});

test.describe('T3-5 카메라 각도 (FR-TR-17)', () => {
	/**
	 * 픽셀로 재지 않는다. 회색 큐브는 24방향에서 **같은 그림** 이다 — 큐브의 회전
	 * 대칭이 정확히 그 24개라서, 스크린샷 비교는 각도가 고정돼 있어도 통과한다.
	 * 색을 입힌 뒤 비교하면 이번엔 스크램블이 달라 무엇 때문에 달랐는지 알 수 없다.
	 */
	test('세션마다 초기 각도가 달라진다', async ({ page }) => {
		const seen = new Set<string>();
		for (let i = 0; i < 10; i++) {
			await page.goto('/trace');
			const v = await page.locator('[data-stage]').getAttribute('data-orientation');
			seen.add(v ?? '');
		}
		expect(seen.size).toBeGreaterThanOrEqual(3);
	});

	test('시작이 각도를 다시 흔들지 않는다', async ({ page }) => {
		await open(page);
		await ready(page);
		const before = await page.locator('[data-stage]').getAttribute('data-orientation');
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'tracing');
		expect(await page.locator('[data-stage]').getAttribute('data-orientation')).toBe(before);
	});
});

test.describe('T3-6 워커 반납 (NFR-TR-1)', () => {
	test('화면을 벗어나면 워커가 종료된다', async ({ page }) => {
		await open(page);
		await ready(page);
		expect(page.workers().length).toBeGreaterThan(0);
		await page.locator('nav a[href="/quiz"]').click();
		await expect(page.locator('h1[data-case]')).toBeVisible();
		await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBe(0);
	});

	test('다시 들어오면 새 워커가 준비된다', async ({ page }) => {
		await open(page);
		await ready(page);
		await page.locator('nav a[href="/quiz"]').click();
		await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBe(0);
		await page.locator('nav a[href="/trace"]').click();
		await ready(page);
		expect(page.workers().length).toBeGreaterThan(0);
	});

	test('퀴즈 화면은 워커를 띄우지 않는다', async ({ page }) => {
		await page.goto('/quiz');
		await expect(page.locator('h1[data-case]')).toBeVisible();
		await page.waitForTimeout(1500);
		expect(page.workers().length).toBe(0);
	});
});

test.describe('T3-7 레이아웃 @viewport', () => {
	test('모바일 폭에서 가로 스크롤이 생기지 않는다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.goto('/trace');
		const over = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(over).toBeLessThanOrEqual(0);
	});

	test('버튼 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		await page.goto('/trace');
		for (const sel of ['[data-start]', '[data-memorized]', '[data-grade]', '[data-next]']) {
			const box = (await page.locator(sel).boundingBox())!;
			expect(box.height, sel).toBeGreaterThanOrEqual(44);
		}
	});

	test('타이머 숫자가 길어져도 옆이 밀리지 않는다 @viewport', async ({ page }) => {
		await page.goto('/trace');
		const label = page.locator('[data-piece-label]');
		const before = (await label.boundingBox())!;
		await ready(page);
		await page.locator('[data-start]').click();
		await expect.poll(() => elapsed(page), { timeout: 5000 }).toBeGreaterThan(0.5);
		const after = (await label.boundingBox())!;
		expect(Math.abs(after.x - before.x)).toBeLessThan(1);
	});
});

/** 하이드레이션 전(스크립트 없음)의 자리를 잰다 (AD-14). */
test.describe('T3-7 프리렌더 자리 @viewport', () => {
	test.use({ javaScriptEnabled: false });

	test('스크립트 없이도 캔버스 자리가 같은 크기로 존재한다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 412, height: 900 });
		await page.goto('/trace');
		const box = (await canvas(page).boundingBox())!;
		expect(box.width).toBeGreaterThan(100);
		// 정사각 자리. 하이드레이션 후에도 이 비율이 바뀌지 않아야 화면이 안 밀린다.
		expect(Math.abs(box.width - box.height)).toBeLessThan(2);
		await expect(page.locator('[data-timer]')).toHaveText('0.00');
		await expect(page.locator('[data-start]')).toBeDisabled();
		await expect(page.locator('[data-status]')).not.toContainText('준비 중');
	});
});
