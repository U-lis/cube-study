import { test, expect } from '@playwright/test';
import data from '../../src/lib/data/corner-UBL.json' with { type: 'json' };

const codes = Object.keys((data as { cases: Record<string, unknown> }).cases);

test.describe('전수 스모크', () => {
	/*
	 * 378 케이스를 한 번씩 입력하고 결과를 확인한다. 왕복이 378번이라 Pixel 7
	 * 에뮬레이션에서 30초 기본값에 아슬아슬하게 걸린다 (실측 29~33초) — 통과와
	 * 실패를 오가며 CI 를 흔든다. 느린 테스트라고 알려 여유를 준다.
	 */
	test.slow();

	test('378 케이스가 모두 렌더되고 콘솔 오류가 없다', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => {
			if (m.type() === 'error') errors.push(m.text());
		});

		await page.goto('/');
		const input = page.getByLabel('케이스 코드');
		for (const code of codes) {
			await input.fill(code);
			await expect(page.locator('section.case')).toHaveAttribute('data-case', code);
		}
		expect(errors).toEqual([]);
	});
});

test.describe('성능 (NFR-1)', () => {
	test('2글자 입력에서 결과 갱신까지 100ms 이내', async ({ page }) => {
		await page.goto('/?c=TU');
		await expect(page.locator('section.case')).toBeVisible();
		const input = page.getByLabel('케이스 코드');

		const elapsed = await page.evaluate(async () => {
			const el = document.querySelector('input') as HTMLInputElement;
			const t0 = performance.now();
			el.value = 'LB';
			el.dispatchEvent(new Event('input', { bubbles: true }));
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
			return performance.now() - t0;
		});
		expect(elapsed).toBeLessThan(100);
		await expect(page.locator('section.case')).toHaveAttribute('data-case', 'LB');
		await input.fill('');
	});
});
