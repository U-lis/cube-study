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

	// 알파벳순. 셋업 수 순으로 두면 찾는 케이스가 목록 어디에 있는지 알 수 없어
	// 매번 전체를 훑게 된다. 코드는 Speffz 대문자뿐이라 단순 비교로 충분하고,
	// localeCompare 와 달리 로케일에 따라 순서가 바뀌지 않는다.
	const cases = Object.values(ds.cases)
		.filter((c) => c.setup.anchor === anchorName)
		.sort((a, b) => (a.case < b.case ? -1 : a.case > b.case ? 1 : 0));

	return { code: params.code, isDirect, anchor: isDirect ? null : ds.anchors[params.code], cases };
}
