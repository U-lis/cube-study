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
import { ENTRY_SEPARATOR as SEPARATOR } from '../../src/lib/domain/tracing.js';

/** 워커 준비 대기. 초기화 + 큐 적재까지다. */
async function ready(page: Page): Promise<void> {
	await expect(page.locator('[data-start]')).toBeEnabled({ timeout: 30_000 });
}

async function open(page: Page, settings: Record<string, string> = {}): Promise<void> {
	await page.addInitScript((s) => {
		for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
	}, settings);
	await page.goto('/3x3/bld/trace');
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
	await page.locator('[data-entry]').fill(targets);
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
		await expect(page.locator('[data-entry]')).toBeEnabled();
		await expect(page.locator('[data-memorized]')).toBeDisabled();
		await expect(canvas(page)).toBeVisible();
	});

	test('memorize 는 입력이 닫혀 있고 다 외웠다 버튼이 열린다', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-entry]')).toBeDisabled();
		await expect(page.locator('[data-memorized]')).toBeEnabled();
	});

	test('다 외웠다를 누르면 캔버스가 사라진다', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await ready(page);
		await page.locator('[data-start]').click();
		await page.locator('[data-memorized]').click();
		await expect(canvas(page)).toHaveCount(0);
		await expect(page.locator('[data-cube-hidden]')).toBeVisible();
		await expect(page.locator('[data-entry]')).toBeEnabled();
	});

	test('memorize 의 시간은 다 외웠다 시점에서 멈춘다 (FR-TR-23)', async ({ page }) => {
		await open(page, { 'trace.mode': 'memorize' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect.poll(() => elapsed(page), { timeout: 5000 }).toBeGreaterThan(0.3);
		await page.locator('[data-memorized]').click();
		const stopped = await elapsed(page);
		// 입력 시간은 트레이싱 시간이 아니다. 한참 뒤에 채점해도 값이 그대로다.
		await page.locator('[data-entry]').fill('ABC');
		await page.waitForTimeout(900);
		await page.locator('[data-grade]').click();
		expect(await elapsed(page)).toBeCloseTo(stopped, 2);
	});

	test('follow 의 시간은 마지막 입력에서 멈춘다 (FR-TR-23)', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await page.locator('[data-entry]').fill('ABC');
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
	test('대상·모드가 새로고침 후 복원된다', async ({ page }) => {
		await open(page);
		await page.locator('[data-toggle="trace-kind"] [data-option="edge"]').click();
		await page.locator('[data-toggle="trace-mode"] [data-option="memorize"]').click();
		await page.reload();
		await expect(page.locator('[data-toggle="trace-kind"]')).toHaveAttribute('data-value', 'edge');
		await expect(page.locator('[data-toggle="trace-mode"]')).toHaveAttribute(
			'data-value',
			'memorize'
		);
	});

	/**
	 * 관례는 결과 패널 안에서 고른다 (요구 3 재검토). 저장은 그대로라 다음 판의
	 * 결과에서도 고른 관례로 보인다 — 복원되는지는 그 자리에서 본다.
	 */
	test('관례가 새로고침 뒤 결과에서도 그대로다', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await playRound(page);
		await page.locator('[data-toggle="trace-convention"] [data-option="B"]').click();
		await page.reload();
		await ready(page);
		await playRound(page);
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveAttribute(
			'data-value',
			'B'
		);
	});

	/*
	 * 관례는 **입력을 가르지 않는다**. 어느 쪽으로 쳐도 정답은 정답이고, 판정은
	 * `readEntry` 가 입력만 보고 한다. 이 설정이 정하는 것은 결과 화면이 정답
	 * 예시와 타깃 수를 어느 관례로 보여줄지 하나뿐이다 (요구 1).
	 */
	test('어느 관례에서도 입력은 한 줄 그대로다', async ({ page }) => {
		for (const convention of ['A', 'B']) {
			await open(page, { 'trace.convention': convention, 'trace.mode': 'follow' });
			await ready(page);
			await page.locator('[data-start]').click();
			await expect(page.locator('[data-entry]')).toBeEnabled();
			await expect(page.locator('[data-pad="entry"] button[data-letter]')).toHaveCount(24);
		}
	});

	test('관례 토글은 정답 예시와 함께 서고 함께 사라진다', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		// 시작 전에는 없다. 세션 설정이 아니라 결과의 표시 방식이다 (요구 3 재검토).
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveCount(0);
		await playRound(page);
		// 바꾸는 대상과 같은 상자 안에 선다.
		await expect(
			page.locator('[data-result-panel] [data-toggle="trace-convention"]')
		).toBeVisible();
		// 라벨만으로는 이 토글이 채점 기준을 바꾼다고 읽힌다 (요구 1).
		await expect(page.locator('[data-heading="trace-convention"]')).toBeVisible();
		await expect(page.locator('[data-hint="trace-convention"]')).toContainText('정답 예시');
		// 잠기지 않는다 — 판이 끝난 뒤에 바꾸는 것이 정상 사용이다.
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveAttribute(
			'data-locked',
			'false'
		);
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-toggle="trace-convention"]')).toHaveCount(0);
	});

	test('both 는 한 줄로 이어 치고 한 번에 채점한다 (요구 2)', async ({ page }) => {
		await open(page, { 'trace.pieceKind': 'both', 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'corner');
		await page.locator('[data-entry]').fill('BC');
		// 구분자가 갈래를 가른다. 패드 글자가 여기서 엣지로 바뀐다.
		await page.locator('[data-pad="entry"] [data-action="separator"]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'edge');
		await page.locator('[data-entry]').fill('BC' + SEPARATOR + 'ci');
		await page.locator('[data-grade]').click();
		// 제출은 한 번이고 그것으로 판이 끝난다 — 이어지는 반쪽이 없다.
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'result');
		await expect(page.locator('[data-part]')).toHaveCount(2);
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'idle');
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-piece', 'corner');
		// 한 판에 기록도 한 건이다.
		const recs = await page.evaluate(() =>
			JSON.parse(localStorage.getItem('trace.records') ?? '{}').records
		);
		expect(recs).toHaveLength(1);
		expect(recs[0].pieceKind).toBe('both');
	});

	/**
	 * 요구 4 — 시작하면 세션 설정이 잠긴다.
	 *
	 * 도중에 바뀌면 이미 친 입력의 판정 기준이 흔들리고, 기록의 세 필드가 무엇을
	 * 가리키는지 알 수 없게 된다. `idle` 로 돌아오면 다시 풀린다.
	 */
	const LOCKED = [
		['trace-kind', 'edge'],
		['trace-mode', 'memorize']
	];

	test('시작하면 세션 옵션이 접히고 값도 잠긴다', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await page.locator('[data-start]').click();
		for (const [name, option] of LOCKED) {
			const toggle = page.locator(`[data-toggle="${name}"]`);
			// 눈에서 사라진다 (요구 1). 큐브부터 입력 패드까지가 한 화면에 들어와야 한다.
			await expect(toggle).toBeHidden();
			// DOM 에는 남는다. `{#if}` 로 빼면 SSR/CSR 구성이 갈린다 (AD-14).
			await expect(toggle).toHaveCount(1);
			// 접는 것은 눈이고 잠그는 것은 값이다 — 둘은 따로다 (요구 4).
			await expect(toggle).toHaveAttribute('data-locked', 'true');
			expect(await toggle.getAttribute('data-value')).not.toBe(option);
			/*
			 * 선택지 버튼이 전부 `disabled` 다. 숨긴 것만으로는 모자란다 — 접는 것은
			 * CSS 이고, 확대·리더 모드·사용자 스타일시트처럼 CSS 가 뜻대로 안 먹는
			 * 자리가 있다. 값을 지키는 것은 `disabled` 쪽이다.
			 *
			 * 합성 클릭(`dispatchEvent`)으로 확인하지 않는다. 그것은 브라우저가
			 * `disabled` 요소에 애초에 배달하지 않는 이벤트라, 통과하든 실패하든
			 * 사용자가 겪는 일과 무관한 답이 나온다.
			 */
			for (const b of await toggle.locator('[data-option]').all())
				await expect(b).toBeDisabled();
		}
	});

	test('결과 단계에서도 접힌 채 잠겨 있고 다음 문제에서 풀린다', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		await playRound(page);
		// 채점한 판의 조건이 결과를 보는 동안 흔들리면 안 된다.
		for (const [name] of LOCKED) {
			const toggle = page.locator(`[data-toggle="${name}"]`);
			await expect(toggle).toBeHidden();
			await expect(toggle).toHaveAttribute('data-locked', 'true');
		}
		await page.locator('[data-next]').click();
		await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage', 'idle');
		for (const [name, option] of LOCKED) {
			const toggle = page.locator(`[data-toggle="${name}"]`);
			// 다시 펴진다. 고르고 시작하는 순서가 그대로 돌아온다.
			await expect(toggle).toBeVisible();
			await expect(toggle).toHaveAttribute('data-locked', 'false');
			await toggle.locator(`[data-option="${option}"]`).click();
			await expect(toggle).toHaveAttribute('data-value', option);
		}
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
			await page.goto('/3x3/bld/trace');
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
	/*
	 * 트레이싱에는 하단 탭이 없다 (FR-NAV-5 — 형제가 없다). 그래서 화면을 뜨고
	 * 돌아오는 길이 홈을 거친다. **전체 새로고침이 아니라 클라이언트 이동이어야**
	 * 이 검사가 뜻을 갖는다 — 새로고침은 워커를 무조건 버리므로 아무것도 증명하지
	 * 않는다. 그래서 `goto` 가 아니라 링크를 누른다.
	 */
	test('화면을 벗어나면 워커가 종료된다', async ({ page }) => {
		await open(page);
		await ready(page);
		expect(page.workers().length).toBeGreaterThan(0);
		await page.locator('[data-up-link]').click();
		await expect(page.locator('[data-home]')).toBeVisible();
		await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBe(0);
	});

	test('다시 들어오면 새 워커가 준비된다', async ({ page }) => {
		await open(page);
		await ready(page);
		await page.locator('[data-up-link]').click();
		await expect.poll(() => page.workers().length, { timeout: 10_000 }).toBe(0);
		await page.locator('[data-home] a[href="/3x3/bld/trace"]').click();
		await ready(page);
		expect(page.workers().length).toBeGreaterThan(0);
	});

	test('퀴즈 화면은 워커를 띄우지 않는다', async ({ page }) => {
		await page.goto('/3x3/bld/3style/corner/quiz');
		await expect(page.locator('[data-case]')).toBeVisible();
		await page.waitForTimeout(1500);
		expect(page.workers().length).toBe(0);
	});
});

test.describe('T3-7 레이아웃 @viewport', () => {
	test('모바일 폭에서 가로 스크롤이 생기지 않는다 @viewport', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 720 });
		await page.goto('/3x3/bld/trace');
		const over = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(over).toBeLessThanOrEqual(0);
	});

	/**
	 * 요구 1 — 큐브부터 입력 패드까지 한 화면에 들어온다.
	 *
	 * 이 화면은 큐브를 **보면서** 치는 화면이다. 패드가 접힘선 아래에 있으면 한 글자
	 * 칠 때마다 스크롤해서 큐브를 다시 찾아야 하고, 그러면 3D 로 만든 이유가 사라진다.
	 *
	 * 스크롤하지 않은 상태에서 잰다. 큐브 위쪽이 화면 안에 있고 패드 아래쪽도 화면
	 * 안이면 둘 사이의 모든 것이 한 화면에 있다는 뜻이다.
	 */
	/**
	 * 요구 1 — 시작하면 화면 맨 위로 되돌아간다.
	 *
	 * 시작 버튼은 세션 설정 아래에 있어서 누르는 시점에 문서가 이미 조금 내려와
	 * 있다. 그 상태로 설정이 접히면 큐브 윗부분이 화면 밖으로 잘린 채 시작된다 —
	 * 스크롤을 되돌리지 않으면 "한 눈에 보인다" 는 약속이 시작하자마자 깨진다.
	 *
	 * 여기서 재는 것은 **이것뿐이다.** 큐브부터 패드까지 전부가 화면 안에 들어오는지는
	 * 재지 않는다 — 폭이 넓고 세로가 짧은 화면(작은 폰, 갤럭시 Z 폴드류 커버
	 * 디스플레이)에서는 이 페이지의 세로 콘텐츠 총량이 화면 높이를 넘는 경우가
	 * 실측으로 나온다. 큐브 높이는 `clamp()` 로 남는 자리만큼 줄지만 바닥이 있고
	 * (180px), 그 밑으로는 스티커를 읽을 수 없어 화면에 욱여넣는 값어치가 없다.
	 * 그 간극을 메우는 일은 #<Z-FOLD-ISSUE> 로 넘겼다.
	 */
	test('시작하면 화면이 맨 위로 되돌아간다 @viewport', async ({ page }) => {
		await open(page, { 'trace.mode': 'follow' });
		await ready(page);
		// 설정을 한 번 건드려 문서를 스크롤시킨 뒤 시작한다 — 실제 사용 순서와 같다.
		await page.locator('[data-toggle="trace-kind"] [data-option="edge"]').click();
		await page.mouse.wheel(0, 300);
		await expect
			.poll(() => page.evaluate(() => window.scrollY))
			.toBeGreaterThan(0);
		await page.locator('[data-start]').click();
		await expect(page.locator('[data-entry]')).toBeEnabled();
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
		const top = await page.evaluate(
			() => document.querySelector('canvas[data-cube3d]')!.getBoundingClientRect().top
		);
		expect(top).toBeGreaterThanOrEqual(0);
	});

	test('버튼 터치 타깃이 44px 이상이다 @viewport', async ({ page }) => {
		/*
		 * 단계마다 실제로 누를 수 있는 버튼 하나만 선다 (요구 1). 안 보이는 버튼은
		 * 상자가 없으므로 각자 자기 단계에서 잰다 — 규칙은 `min-height` 하나지만
		 * 그 규칙이 실제로 먹는 것을 보는 것이 이 검사의 일이다.
		 */
		await page.goto('/3x3/bld/trace');
		await ready(page);
		const tall = async (sel: string) => {
			const box = await page.locator(sel).boundingBox();
			expect(box, sel).not.toBeNull();
			expect(box!.height, sel).toBeGreaterThanOrEqual(44);
		};
		await tall('[data-start]');
		await page.locator('[data-start]').click();
		// follow 는 트레이싱 중에 이미 입력이 열려 있다.
		await tall('[data-grade]');
		await page.locator('[data-grade]').click();
		await tall('[data-next]');
		await page.locator('[data-next]').click();
		// "다 외웠다" 는 memorize 의 트레이싱 단계에서만 선다.
		await page.locator('[data-toggle="trace-mode"] [data-option="memorize"]').click();
		await page.locator('[data-start]').click();
		await tall('[data-memorized]');
	});

	test('타이머 숫자가 길어져도 옆이 밀리지 않는다 @viewport', async ({ page }) => {
		await page.goto('/3x3/bld/trace');
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
		await page.goto('/3x3/bld/trace');
		const box = (await canvas(page).boundingBox())!;
		expect(box.width).toBeGreaterThan(100);
		// 정사각 자리. 하이드레이션 후에도 이 비율이 바뀌지 않아야 화면이 안 밀린다.
		expect(Math.abs(box.width - box.height)).toBeLessThan(2);
		await expect(page.locator('[data-timer]')).toHaveText('0.00');
		await expect(page.locator('[data-start]')).toBeDisabled();
		await expect(page.locator('[data-status]')).not.toContainText('준비 중');
	});
});
