import { describe, it, expect } from 'vitest';
import { loadDataset, DEFAULT_DATASET } from '../../src/lib/data/loader.js';

describe('데이터 로더', () => {
	it('기본 데이터셋 로드', async () => {
		const ds = await loadDataset(DEFAULT_DATASET);
		expect(Object.keys(ds.cases)).toHaveLength(378);
		expect(ds.meta.buffer).toBe('UBL');
		// 기준 개수는 데이터가 정한다 (v2 10개 → v3 6개 → v5 5개). 비어 있지 않기만 요구한다.
		expect(Object.keys(ds.anchors).length).toBeGreaterThan(0);
		expect(ds.meta.schemaVersion).toBeGreaterThanOrEqual(2);
	});

	it('meta.totalCases 가 실제 케이스 수와 일치', async () => {
		const ds = await loadDataset();
		expect(Object.keys(ds.cases)).toHaveLength(ds.meta.totalCases);
	});

	it('meta.anchorLearnOrder 가 있으면 anchors 와 정확히 같은 집합', async () => {
		const ds = await loadDataset();
		if (!ds.meta.anchorLearnOrder) return;
		expect([...ds.meta.anchorLearnOrder].sort()).toEqual(Object.keys(ds.anchors).sort());
	});

	it('재호출 시 캐시된 동일 객체', async () => {
		const a = await loadDataset(DEFAULT_DATASET);
		const b = await loadDataset(DEFAULT_DATASET);
		expect(a).toBe(b);
	});

	it('인자 없이 호출하면 기본 데이터셋', async () => {
		const ds = await loadDataset();
		expect(ds.meta.buffer).toBe('UBL');
	});

	it('미지원 데이터셋은 명확한 오류', async () => {
		await expect(loadDataset({ pieceType: 'edge', buffer: 'UBL' })).rejects.toThrow(
			/지원하지 않는 데이터셋/
		);
	});
});
