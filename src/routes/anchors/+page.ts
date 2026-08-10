import { loadDataset } from '$lib/data/loader.js';
import { anchorOrder } from '$lib/domain/anchor.js';
import { ANCHOR_DIRECT } from '$lib/domain/types.js';

export const prerender = true;

export async function load() {
	const ds = await loadDataset();
	// meta.anchorLearnOrder 를 그대로 쓴다. 없으면 키 순서.
	// 무엇을 기준으로 매긴 순서인지는 데이터가 정한다 — v3 은 담당 케이스가 많은 순,
	// v5 는 평균 길이를 많이 줄이는 순이다. 여기서 다시 정렬하지 않는다.
	const rows = anchorOrder(ds).map((name) => ({ name, ...ds.anchors[name] }));
	const directCount = Object.values(ds.cases).filter(
		(c) => c.setup.anchor === ANCHOR_DIRECT
	).length;
	return { rows, directCount };
}
