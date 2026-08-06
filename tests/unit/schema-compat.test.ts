/**
 * 스키마 호환성 — 데이터가 교체돼도 코드가 버티는가.
 *
 * data/schema-history 의 과거 버전을 같은 도메인 함수에 그대로 먹인다.
 * 기준 개수(10 vs 6)도, 기준 없는 케이스(6건 vs 0건)도, usesInverse 필드의
 * 유무도 코드가 데이터에서 읽어야만 통과한다.
 */
import { describe, it, expect } from 'vitest';
import { CubeSim, type Perms } from '../../src/lib/cube/sim.js';
import { grade } from '../../src/lib/domain/grade.js';
import { formatAlg } from '../../src/lib/domain/format.js';
import { anchorOrder, anchorRef, anchorRefs, expandSetup, refLabel } from '../../src/lib/domain/anchor.js';
import permsJson from '../../src/lib/cube/perms.json';
import v1Json from '../../data/schema-history/corner-UBL.v1.json';
import v2Json from '../../data/schema-history/corner-UBL.v2.json';
import shippedJson from '../../src/lib/data/corner-UBL.json';
import { ANCHOR_DIRECT, type Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim(permsJson as unknown as Perms);

/**
 * v1 은 제외한다. strict 필드 자체가 없어서 앱이 읽을 수 있는 형태가 아니다
 * (표기·무브수 계산이 전부 strict 에 걸려 있다). 앱의 하한은 schemaVersion 2 다.
 */
const versions: [string, Dataset][] = [
	['v2', v2Json as unknown as Dataset],
	['배포본', shippedJson as unknown as Dataset]
];

describe.each(versions)('%s 데이터셋', (_label, ds) => {
	const cases = Object.values(ds.cases);
	const anchored = cases.filter((c) => c.setup.anchor !== ANCHOR_DIRECT);

	it('기준 목록을 데이터에서 읽는다', () => {
		expect([...anchorOrder(ds)].sort()).toEqual(Object.keys(ds.anchors).sort());
		expect(anchorRefs(ds)).toHaveLength(Object.keys(ds.anchors).length * 2);
	});

	it('[S: 기준] 조립이 setup 알고리즘과 같은 효과를 낸다', () => {
		const bad: string[] = [];
		for (const c of anchored) {
			const v = grade(sim, ds, c, expandSetup(ds, c.setup.S, anchorRef(c)!));
			if (v.kind !== 'correct') bad.push(`${c.case}: ${v.kind}`);
		}
		expect(bad).toEqual([]);
	});

	it('usesInverse 가 없는 데이터는 전부 정방향으로 읽힌다', () => {
		const hasFlag = cases.some((c) => c.setup.usesInverse !== undefined);
		if (hasFlag) return;
		expect(anchored.every((c) => anchorRef(c)!.inverse === false)).toBe(true);
		expect(anchored.every((c) => refLabel(anchorRef(c)!) === c.setup.anchor)).toBe(true);
	});

	it('기준 없는 케이스는 괄호 없이 알고리즘만 표기한다', () => {
		for (const c of cases.filter((x) => x.setup.anchor === ANCHOR_DIRECT)) {
			const parts = formatAlg(c, 'setup', 'strict');
			expect(parts).toHaveLength(1);
			expect(parts[0].text).toBe(c.setup.strict.alg);
		}
	});
});

describe('버전 간 관계', () => {
	it('direct 알고리즘은 v1 이후 바뀐 적이 없다', () => {
		const v1 = v1Json as unknown as Dataset;
		const shipped = shippedJson as unknown as Dataset;
		const bad = Object.keys(v1.cases).filter(
			(k) => v1.cases[k].direct.alg !== shipped.cases[k].direct.alg
		);
		expect(bad).toEqual([]);
	});

	it('v1 은 strict 필드가 없어 앱이 읽을 수 없다 (하한은 v2)', () => {
		const v1 = v1Json as unknown as Dataset;
		expect(v1.meta.schemaVersion).toBeUndefined();
		expect(Object.values(v1.cases)[0].setup.strict).toBeUndefined();
	});
});
