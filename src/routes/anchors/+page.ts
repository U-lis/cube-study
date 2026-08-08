import { loadDataset } from '$lib/data/loader.js';
import { anchorOrder } from '$lib/domain/anchor.js';
import { ANCHOR_DIRECT } from '$lib/domain/types.js';

export const prerender = true;

export async function load() {
	const ds = await loadDataset();
	// meta.anchorLearnOrder (담당 케이스 많은 순) 를 그대로 쓴다. 없으면 키 순서.
	const rows = anchorOrder(ds).map((name) => ({ name, ...ds.anchors[name] }));
	const directCount = Object.values(ds.cases).filter(
		(c) => c.setup.anchor === ANCHOR_DIRECT
	).length;
	return { rows, directCount };
}
