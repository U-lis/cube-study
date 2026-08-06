/**
 * 기준공식(anchor) 취급의 유일한 책임 지점.
 *
 * 기준의 개수·이름·순서를 코드에 적지 않는다. 전부 데이터에서 읽으므로
 * corner-UBL.json 이 교체되어도(v2 10개 → v3 6개) UI 는 손대지 않는다.
 *
 * 방향이 핵심이다. v3 는 역트릭을 접어 기준 수를 줄였고, 378 중 188 케이스가
 * 기준공식을 거꾸로 돌린다 (setup.usesInverse). 어느 기준도 self-inverse 가
 * 아니므로 방향이 틀리면 다른 케이스를 푸는 알고리즘이 된다.
 */

import { invertAlg } from '../cube/notation.js';
import { ANCHOR_DIRECT, type AnchorName, type CaseEntry, type Dataset } from './types.js';

/** 기준 하나를 방향까지 지정해 가리키는 값. */
export interface AnchorRef {
	name: AnchorName;
	inverse: boolean;
}

/**
 * 화면에 세울 기준 순서. meta.anchorLearnOrder 를 따르되 데이터와 어긋난
 * 이름은 버리고, 거기 없는 기준은 뒤에 붙인다. 목록이 조용히 잘리면 안 된다.
 */
export function anchorOrder(ds: Dataset): AnchorName[] {
	const all = Object.keys(ds.anchors);
	const listed = (ds.meta.anchorLearnOrder ?? []).filter((n) => n in ds.anchors);
	return [...listed, ...all.filter((n) => !listed.includes(n))];
}

/** 케이스가 쓰는 기준 + 방향. 기준이 없는 케이스면 null. */
export function anchorRef(entry: CaseEntry): AnchorRef | null {
	if (entry.setup.anchor === ANCHOR_DIRECT) return null;
	return { name: entry.setup.anchor, inverse: entry.setup.usesInverse === true };
}

/** 표기용 이름. 역방향이면 프라임을 붙인다 (GC'). NFR-4 대로 ASCII 프라임. */
export function refLabel(ref: AnchorRef): string {
	return ref.inverse ? `${ref.name}'` : ref.name;
}

/** 실제로 돌릴 기준 무브열. 역방향이면 뒤집은 것을 준다. */
export function refAlg(ds: Dataset, ref: AnchorRef): string {
	const alg = ds.anchors[ref.name].alg;
	return ref.inverse ? invertAlg(alg) : alg;
}

/** [S: 기준] 을 펼친 무브열. 채점과 검증이 모두 이 한 식을 쓴다. */
export function expandSetup(ds: Dataset, s: string, ref: AnchorRef): string {
	const core = refAlg(ds, ref);
	return s ? `${s} ${core} ${invertAlg(s)}` : core;
}

/** 기준 목록을 정·역 두 갈래로 펼친 선택지. 퀴즈 입력 패드가 쓴다. */
export function anchorRefs(ds: Dataset): AnchorRef[] {
	return anchorOrder(ds).flatMap((name) => [
		{ name, inverse: false },
		{ name, inverse: true }
	]);
}
