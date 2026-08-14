/**
 * 데이터셋 로더.
 *
 * 현재는 corner/UBL 하나만 지원하지만, 시그니처를 지금 확정해두면
 * UFR 코너·엣지 3-style·M2/OP 참조표를 추가할 때 이 파일 내부만 바뀐다.
 * 호출부는 DatasetKey 만 넘기며 파일 경로를 알지 못한다.
 */

import type { Alternatives } from '../domain/alternatives.js';
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

/**
 * 케이스별 "다른 기준 경로" 표. 배정된 기준을 아직 안 배운 사용자에게만 필요하므로
 * 본 데이터와 따로 두고 필요할 때 부른다 (gzip 17KB). 캐시는 본 데이터와 같은 규칙.
 *
 * 데이터셋 키를 받지 않는다 — 지금은 corner/UBL 하나뿐이고, 다른 버퍼가 생기면
 * loadDataset 과 같은 모양으로 키를 받게 고친다.
 */
let altCache: Alternatives | null = null;

export async function loadAlternatives(): Promise<Alternatives> {
	if (altCache) return altCache;
	const mod = await import('./corner-UBL-alternatives.json');
	altCache = mod.default as unknown as Alternatives;
	return altCache;
}
