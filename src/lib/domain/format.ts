/**
 * 알고리즘 표기 생성.
 *
 * strict/compact × direct/setup 의 5가지 분기를 여기 한 곳에 모은다.
 * UI 는 AlgPart[] 를 받아 role 에 따라 색만 입히며 문자열을 조립하지 않는다.
 *
 * strict 는 상쇄를 적용하지 않은 구조형(데이터의 strict.alg),
 * compact 는 상쇄를 적용한 실행형(데이터의 alg)이다.
 * compact 는 상쇄로 파트 경계가 소실되므로 구분 표시가 불가능하다.
 */

import { anchorRef, decomposeCommutator, refLabel } from './anchor.js';
import { type CaseEntry } from './types.js';

export type PartRole = 'insert' | 'interchange' | 'setup' | 'anchor' | 'plain' | 'punct';
export type Mode = 'direct' | 'setup';
export type Notation = 'strict' | 'compact';

export interface AlgPart {
	text: string;
	role: PartRole;
}

const p = (text: string, role: PartRole): AlgPart => ({ text, role });

export function formatAlg(entry: CaseEntry, mode: Mode, notation: Notation): AlgPart[] {
	if (notation === 'compact') {
		const alg = mode === 'direct' ? entry.direct.alg : entry.setup.alg;
		return [p(alg, 'plain')];
	}

	if (mode === 'direct') {
		const { A, B, S, type } = entry.direct;
		const core: AlgPart[] = [
			p('[', 'punct'),
			p(A, 'insert'),
			p(',', 'punct'),
			p(B, 'interchange'),
			p(']', 'punct')
		];
		if (type === 'pure' || !S) return core;
		return [p('[', 'punct'), p(S, 'setup'), p(':', 'punct'), ...core, p(']', 'punct')];
	}

	// setup strict
	const { S, strict } = entry.setup;
	const ref = anchorRef(entry);
	if (!ref) return [p(strict.alg, 'plain')];
	// 역방향이면 GC 가 아니라 GC' 다. 이름만 적으면 반대로 돌리게 된다.
	const name = refLabel(ref);
	if (!S) return [p(name, 'anchor')];
	return [p('[', 'punct'), p(S, 'setup'), p(':', 'punct'), p(name, 'anchor'), p(']', 'punct')];
}

/** 표기에 실제로 등장하는 무브 열 (역할 구분 없이 이어붙인 것). 테스트·복사용. */
export function plainAlg(entry: CaseEntry, mode: Mode, notation: Notation): string {
	const src = mode === 'direct' ? entry.direct : entry.setup;
	return notation === 'compact' ? src.alg : src.strict.alg;
}

/** 화면에 표시할 무브 수. strict 는 상쇄 전이라 compact 보다 클 수 있다. */
export function displayMoves(entry: CaseEntry, mode: Mode, notation: Notation): number {
	const src = mode === 'direct' ? entry.direct : entry.setup;
	return notation === 'compact' ? src.moves : src.strict.moves;
}

/**
 * 기준 무브열의 [A, B] 표기. 분해되지 않으면 null 이고, 그때는 화면이 이 줄을
 * 통째로 걸러야 한다 — 무브열만 보여주면 되지 빈 대괄호를 띄울 이유가 없다.
 *
 * 색은 조회 화면의 direct strict 와 같다. 같은 것을 두 화면에서 다른 색으로
 * 보여주면 외우는 사람이 둘을 다른 개념으로 받아들인다.
 */
export function formatCommutator(alg: string): AlgPart[] | null {
	const d = decomposeCommutator(alg);
	if (!d) return null;
	return [
		p('[', 'punct'),
		p(d.A, 'insert'),
		p(',', 'punct'),
		p(d.B, 'interchange'),
		p(']', 'punct')
	];
}
