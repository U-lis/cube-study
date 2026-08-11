/**
 * "아는 기준으로 풀기" 데이터와 도메인 로직.
 *
 * 배포본(`src/lib/data/corner-UBL-alternatives.json`)은 공급본에서 `alg` 를 뺀
 * 것이다. 그 생략이 무손실인지를 여기서 지킨다 — `S`·`inv` 와 기준공식으로
 * 조립한 결과가 공급본의 `alg` 와 3668건 전부 같아야 한다. 어긋나면 화면이
 * 실제로 안 풀리는 무브열을 보여주게 된다.
 */
import { describe, it, expect } from 'vitest';
import { cancelMoves, invertAlg, moveCount } from '../../src/lib/cube/notation.js';
import { expandSetup } from '../../src/lib/domain/anchor.js';
import {
	altRoutes,
	learnedAnchors,
	shouldOfferAlternatives,
	type Alternatives
} from '../../src/lib/domain/alternatives.js';
import shippedAlt from '../../src/lib/data/corner-UBL-alternatives.json';
import archiveAlt from '../../data/schema-history/corner-UBL-alternatives.v9.json';
import dataJson from '../../src/lib/data/corner-UBL.json';
import type { CaseCode, Dataset } from '../../src/lib/domain/types.js';

const ds = dataJson as unknown as Dataset;
const alt = shippedAlt as unknown as Alternatives;
const archive = archiveAlt as unknown as {
	cases: Record<string, Record<string, { moves: number; S: string; inv: boolean; alg: string }>>;
};

describe('배포본 alternatives', () => {
	it('공급본과 같은 케이스·기준 조합을 갖는다', () => {
		expect(Object.keys(alt.cases).sort()).toEqual(Object.keys(archive.cases).sort());
		const bad: string[] = [];
		for (const [code, by] of Object.entries(archive.cases)) {
			const got = Object.keys(alt.cases[code]).sort();
			if (got.join() !== Object.keys(by).sort().join()) bad.push(code);
		}
		expect(bad).toEqual([]);
	});

	it('빠진 alg 를 S·inv 와 기준공식으로 되살릴 수 있다 (3668건)', () => {
		const bad: string[] = [];
		let n = 0;
		for (const [code, by] of Object.entries(archive.cases))
			for (const [name, want] of Object.entries(by)) {
				const got = alt.cases[code][name];
				if (got.moves !== want.moves || got.S !== want.S || got.inv !== want.inv) {
					bad.push(`${code}/${name}: 필드 불일치`);
					continue;
				}
				const alg = cancelMoves(expandSetup(ds, got.S, { name, inverse: got.inv }));
				if (alg !== want.alg) bad.push(`${code}/${name}: ${alg} !== ${want.alg}`);
				else if (moveCount(alg) !== got.moves) bad.push(`${code}/${name}: moves 불일치`);
				else n++;
			}
		expect(bad).toEqual([]);
		expect(n).toBe(3668);
	});

	it('역방향 경로는 기준을 뒤집은 것이다', () => {
		const [code, name] = (() => {
			for (const [c, by] of Object.entries(alt.cases))
				for (const [a, v] of Object.entries(by)) if (v.inv) return [c, a];
			throw new Error('역방향 경로가 없다');
		})();
		const v = alt.cases[code][name];
		const core = invertAlg(ds.anchors[name].alg);
		expect(cancelMoves(expandSetup(ds, v.S, { name, inverse: true }))).toBe(
			cancelMoves(v.S ? `${v.S} ${core} ${invertAlg(v.S)}` : core)
		);
	});
});

describe('learnedAnchors', () => {
	const ownOf = (name: string) =>
		Object.values(ds.cases)
			.filter((c) => c.setup.isAnchorCase && c.setup.anchor === name)
			.map((c) => c.case);
	const first = Object.keys(ds.anchors)[0];

	it('기준마다 자기 케이스가 정확히 2개다', () => {
		for (const name of Object.keys(ds.anchors)) expect(ownOf(name)).toHaveLength(2);
	});

	it('체크가 없으면 배운 기준도 없다', () => {
		expect(learnedAnchors(ds, new Set()).size).toBe(0);
	});

	it('자기 케이스를 하나만 체크하면 아직 아니다', () => {
		expect(learnedAnchors(ds, new Set([ownOf(first)[0]])).has(first)).toBe(false);
	});

	it('둘 다 체크하면 배운 것으로 친다', () => {
		expect(learnedAnchors(ds, new Set(ownOf(first))).has(first)).toBe(true);
	});

	it('자기 케이스가 아닌 것을 아무리 체크해도 안 된다', () => {
		const others = Object.values(ds.cases)
			.filter((c) => c.setup.anchor === first && !c.setup.isAnchorCase)
			.map((c) => c.case);
		expect(learnedAnchors(ds, new Set(others)).has(first)).toBe(false);
	});
});

describe('altRoutes / shouldOfferAlternatives', () => {
	const anchorOf = (name: string) =>
		Object.values(ds.cases).filter((c) => c.setup.isAnchorCase && c.setup.anchor === name);
	const [a, b] = Object.keys(ds.anchors);
	const learnedA = new Set([a]);
	/** a 에 배정되지 않은 케이스 — 대체가 필요한 상황 */
	const foreign = Object.values(ds.cases).find(
		(c) => c.setup.anchor === b && !c.setup.isAnchorCase
	)!;

	it('아무것도 안 배웠으면 제안하지 않는다', () => {
		expect(shouldOfferAlternatives(foreign, new Set())).toBe(false);
	});

	it('배정된 기준을 이미 배웠으면 제안하지 않는다', () => {
		expect(shouldOfferAlternatives(foreign, new Set([b]))).toBe(false);
	});

	it('안 배운 기준에 배정됐으면 제안한다', () => {
		expect(shouldOfferAlternatives(foreign, learnedA)).toBe(true);
	});

	it('배운 기준의 경로만, 짧은 것부터 준다', () => {
		const routes = altRoutes(ds, alt, foreign, new Set([a, b]));
		expect(routes.map((r) => r.name)).toEqual([a]); // 배정된 b 는 빠진다
		expect(routes.map((r) => r.moves)).toEqual([...routes.map((r) => r.moves)].sort((x, y) => x - y));
	});

	it('extraMoves 는 배정 경로 대비 증가분이다', () => {
		for (const r of altRoutes(ds, alt, foreign, new Set([a])))
			expect(r.extraMoves).toBe(r.moves - foreign.setup.moves);
	});

	it('자기 케이스는 셋업 없이 그 기준 그대로다', () => {
		const own = anchorOf(a)[0];
		const path = alt.cases[own.case as CaseCode][a];
		expect(path.S).toBe('');
		expect(path.moves).toBe(ds.anchors[a].moves);
	});
});
