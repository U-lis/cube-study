/**
 * 스키마 호환성 — 데이터가 교체돼도 코드가 버티는가.
 *
 * data/schema-history 의 과거 버전을 같은 도메인 함수에 그대로 먹인다.
 * 기준 개수(10 vs 6)도, 기준 없는 케이스(6건 vs 0건)도, usesInverse 필드의
 * 유무도 코드가 데이터에서 읽어야만 통과한다.
 */
import { describe, it, expect } from 'vitest';
import { CubeSim } from '../../src/lib/cube/sim.js';
import { grade } from '../../src/lib/domain/grade.js';
import { formatAlg } from '../../src/lib/domain/format.js';
import { anchorOrder, anchorRef, anchorRefs, expandSetup, refLabel } from '../../src/lib/domain/anchor.js';
import v1Json from '../../data/schema-history/corner-UBL.v1.json';
import v2Json from '../../data/schema-history/corner-UBL.v2.json';
import shippedJson from '../../src/lib/data/corner-UBL.json';
import { ANCHOR_DIRECT, type Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim();

/**
 * v9 이전 데이터는 `L` 과 `L'` 이 뒤바뀐 표기다. 생성 시뮬레이터의 L 정의가
 * 표준의 역이었고 v9 에서 교정됐다 (MIGRATION-v3-to-v9.md). 보관본은 당시
 * 파일 그대로 두는 것이 기록으로서 맞으므로, 읽을 때 표기만 맞춰준다.
 * `L2` 는 자기 역이라 영향이 없다.
 */
const swapL = (alg: string) => alg.replace(/L2|L'|L/g, (m) => (m === 'L' ? "L'" : m === "L'" ? 'L' : m));

function toStandardNotation(ds: Dataset): Dataset {
	if ((ds.meta.schemaVersion ?? 0) >= 9) return ds;
	const out = structuredClone(ds);
	for (const a of Object.values(out.anchors)) a.alg = swapL(a.alg);
	for (const c of Object.values(out.cases))
		for (const mode of ['direct', 'setup'] as const) {
			const m = c[mode];
			m.alg = swapL(m.alg);
			if (m.S !== undefined) m.S = swapL(m.S);
			if (m.strict) m.strict.alg = swapL(m.strict.alg);
		}
	return out;
}

/**
 * v1 은 제외한다. strict 필드 자체가 없어서 앱이 읽을 수 있는 형태가 아니다
 * (표기·무브수 계산이 전부 strict 에 걸려 있다). 앱의 하한은 schemaVersion 2 다.
 */
const versions: [string, Dataset][] = [
	['v2', toStandardNotation(v2Json as unknown as Dataset)],
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
		// v9 의 L 표기 교정만 걷어내고 비교한다. 무브 열 자체는 v1 이래 그대로다.
		const bad = Object.keys(v1.cases).filter(
			(k) => swapL(v1.cases[k].direct.alg) !== shipped.cases[k].direct.alg
		);
		expect(bad).toEqual([]);
	});

	it('v1 은 strict 필드가 없어 앱이 읽을 수 없다 (하한은 v2)', () => {
		const v1 = v1Json as unknown as Dataset;
		expect(v1.meta.schemaVersion).toBeUndefined();
		expect(Object.values(v1.cases)[0].setup.strict).toBeUndefined();
	});
});
