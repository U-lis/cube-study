/**
 * 데이터셋 로더.
 *
 * 현재는 corner/UBL 하나만 지원하지만, 시그니처를 지금 확정해두면
 * UFR 코너·엣지 3-style·M2/OP 참조표를 추가할 때 이 파일 내부만 바뀐다.
 * 호출부는 DatasetKey 만 넘기며 파일 경로를 알지 못한다.
 */

import type { Dataset } from '../domain/types.js';

export type PieceType = 'corner' | 'edge';

export interface DatasetKey {
	pieceType: PieceType;
	buffer: string;
}

export const DEFAULT_DATASET: DatasetKey = { pieceType: 'corner', buffer: 'UBL' };

function keyOf(key: DatasetKey): string {
	return `${key.pieceType}/${key.buffer}`;
}

const cache = new Map<string, Dataset>();

export async function loadDataset(key: DatasetKey = DEFAULT_DATASET): Promise<Dataset> {
	const id = keyOf(key);
	const hit = cache.get(id);
	if (hit) return hit;

	if (key.pieceType !== 'corner' || key.buffer !== 'UBL') {
		throw new Error(
			`지원하지 않는 데이터셋입니다: ${id} (현재 corner/UBL 만 제공합니다)`
		);
	}

	const mod = await import('./corner-UBL.json');
	const ds = mod.default as unknown as Dataset;
	cache.set(id, ds);
	return ds;
}
