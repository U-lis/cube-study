/**
 * "아는 기준으로 풀기" — 순수 함수.
 *
 * 배정(`setup.anchor`)은 10개를 다 외운 뒤의 최적 배분이다. 학습 도중에는 아직
 * 안 배운 기준에 배정된 케이스가 나오고, 그때 화면이 모르는 공식을 들이민다.
 * 기준 하나만 알아도 378개에 전부 도달하므로(`meta.coverageNote`), 아는 기준의
 * 경로를 대신 보여줄 수 있다. 그 경로가 담긴 것이 alternatives 데이터다.
 *
 * memorize.ts 와 같은 규칙을 따른다 — Svelte 를 import 하지 않고, 기준의 이름·
 * 개수·순서를 코드에 적지 않는다.
 */

import type { AnchorName, CaseCode, CaseEntry, Dataset } from './types.js';
import type { AnchorRef } from './anchor.js';

/** 케이스 × 기준 경로. `alg` 는 싣지 않는다 — S·inv 와 기준공식으로 재계산된다. */
export interface AltPath {
	moves: number;
	S: string;
	inv: boolean;
}
export interface Alternatives {
	anchors: AnchorName[];
	cases: Record<CaseCode, Record<AnchorName, AltPath>>;
}

/** 대체 경로 하나. `extraMoves` 는 배정 경로 대비 늘어나는 무브 수. */
export interface AltRoute extends AnchorRef {
	setup: string;
	moves: number;
	extraMoves: number;
}

/**
 * "이 기준을 배웠다" 를 케이스 암기 체크에서 유추한다.
 *
 * 기준 `XY` 는 케이스 `XY`·`YX` 를 셋업 없이 그대로 쓴다 (`setup.isAnchorCase`,
 * 기준 하나당 2개). 그 둘을 외웠다면 그 공식을 외운 것이다. 별도 상태를 만들지
 * 않는 이유는, 두 상태가 생기면 "공식은 체크했는데 자기 케이스는 안 한" 어긋난
 * 조합이 생기고 그걸 화면에서 설명할 방법이 없기 때문이다.
 *
 * `isAnchorCase` 가 없는 데이터(v2~v5)에서는 아무 기준도 배운 것으로 치지 않는다.
 * 그 경우 이 기능이 조용히 꺼진다 — 틀린 경로를 보여주는 것보다 낫다.
 */
export function learnedAnchors(ds: Dataset, checkedSetup: ReadonlySet<CaseCode>): Set<AnchorName> {
	const own = new Map<AnchorName, CaseCode[]>();
	for (const c of Object.values(ds.cases)) {
		if (!c.setup.isAnchorCase) continue;
		const list = own.get(c.setup.anchor) ?? [];
		list.push(c.case);
		own.set(c.setup.anchor, list);
	}

	const learned = new Set<AnchorName>();
	for (const [name, cases] of own) {
		if (name in ds.anchors && cases.every((code) => checkedSetup.has(code))) learned.add(name);
	}
	return learned;
}

/**
 * 배운 기준들로 이 케이스를 푸는 경로. 짧은 것부터.
 *
 * 배정된 기준 자신은 뺀다 — 화면에 이미 주된 답으로 떠 있다. 도달하지 못하는
 * 기준도 뺀다 (alternatives 는 378×10 중 3668개만 갖는다).
 */
export function altRoutes(
	ds: Dataset,
	alt: Alternatives,
	entry: CaseEntry,
	learned: ReadonlySet<AnchorName>
): AltRoute[] {
	const paths = alt.cases[entry.case];
	if (!paths) return [];

	const base = entry.setup.moves;
	return [...learned]
		.filter((name) => name !== entry.setup.anchor && paths[name])
		.map((name) => ({
			name,
			inverse: paths[name].inv,
			setup: paths[name].S,
			moves: paths[name].moves,
			extraMoves: paths[name].moves - base
		}))
		.sort((a, b) => a.moves - b.moves || (a.name < b.name ? -1 : 1));
}

/**
 * 대체 경로를 화면에 낼 것인가.
 *
 * 배운 기준이 하나도 없으면 안 낸다 — 기본 상태(아무것도 체크 안 됨)에서 뜨면
 * 배정 경로 옆에 정체불명의 목록이 항상 붙어 있게 된다. 배정된 기준을 이미
 * 배웠어도 안 낸다 — 그때 주된 답은 이미 아는 공식이라 대체가 필요 없다.
 */
export function shouldOfferAlternatives(
	entry: CaseEntry,
	learned: ReadonlySet<AnchorName>
): boolean {
	return learned.size > 0 && !learned.has(entry.setup.anchor);
}
