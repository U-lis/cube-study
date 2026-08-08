import { loadDataset } from '$lib/data/loader.js';
import { ANCHOR_DIRECT } from '$lib/domain/types.js';

export const prerender = true;

/** 데이터에 있는 기준 전부 + (기준 없는 케이스가 있을 때만) direct 그룹 */
export async function entries() {
	const ds = await loadDataset();
	const pages = Object.keys(ds.anchors).map((code) => ({ code }));
	const hasDirect = Object.values(ds.cases).some((c) => c.setup.anchor === ANCHOR_DIRECT);
	return hasDirect ? [...pages, { code: 'direct' }] : pages;
}

export async function load({ params }) {
	const ds = await loadDataset();
	const isDirect = params.code === 'direct';
	const anchorName = isDirect ? ANCHOR_DIRECT : params.code;

	const cases = Object.values(ds.cases)
		.filter((c) => c.setup.anchor === anchorName)
		.sort((a, b) => a.setup.moves - b.setup.moves || a.case.localeCompare(b.case));

	return { code: params.code, isDirect, anchor: isDirect ? null : ds.anchors[params.code], cases };
}
