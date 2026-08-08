/**
 * 암기 체크 도메인 로직 유닛 테스트.
 *
 * 기준공식의 이름·개수를 테스트에 적지 않는다. 데이터에서 읽는다.
 * v2→v3 에서 기준이 10→6 개로 바뀐 전례가 있고, 다시 바뀌어도 이 파일은 따라가야 한다.
 */
import { describe, it, expect } from 'vitest';
import {
	parseStored,
	serialize,
	anchorProgress,
	poolFor,
	type MemorizeChecked
} from '../../src/lib/domain/memorize.js';
import dataJson from '../../src/lib/data/corner-UBL.json';
import { type Dataset, type CaseCode, ANCHOR_DIRECT } from '../../src/lib/domain/types.js';

const ds = dataJson as unknown as Dataset;

/** 이 테스트 파일 내에서 재사용할 빈 상태 생성기. 참조 공유 사고를 막는다. */
const empty = (): MemorizeChecked => ({ setup: new Set(), direct: new Set() });

/**
 * 데이터에 실제로 존재하는 케이스 하나를 뽑아 쓴다. 특정 코드('LB' 같은) 를
 * 하드코딩하면 데이터 교체 시 테스트가 무의미하게 깨진다. anchored 케이스를
 * 골라야 anchorProgress 집계 검증도 유효하다.
 */
function pickAnchoredCase(): CaseCode {
	const found = Object.values(ds.cases).find((c) => c.setup.anchor !== ANCHOR_DIRECT);
	if (!found) throw new Error('anchored 케이스가 데이터에 없다');
	return found.case;
}

describe('parseStored — 방어적 파싱 (FR-MC-7)', () => {
	it('null 은 빈 상태', () => {
		const r = parseStored(null);
		expect(r.setup).toBeInstanceOf(Set);
		expect(r.direct).toBeInstanceOf(Set);
		expect(r.setup.size).toBe(0);
		expect(r.direct.size).toBe(0);
	});

	it('빈 문자열도 빈 상태', () => {
		const r = parseStored('');
		expect(r.setup.size).toBe(0);
		expect(r.direct.size).toBe(0);
	});

	it('잘못된 JSON 은 throw 없이 빈 상태', () => {
		expect(() => parseStored('invalid json')).not.toThrow();
		const r = parseStored('invalid json');
		expect(r.setup.size).toBe(0);
		expect(r.direct.size).toBe(0);
	});

	it('schemaVersion 이 0 이면 필드가 유효해도 버린다', () => {
		const r = parseStored('{"schemaVersion":0,"checked":{"setup":["LB"],"direct":[]}}');
		expect(r.setup.size).toBe(0);
		expect(r.direct.size).toBe(0);
	});

	it('schemaVersion 이 2 이면 버린다 (미래 버전 방어)', () => {
		const r = parseStored('{"schemaVersion":2,"checked":{"setup":["LB"],"direct":[]}}');
		expect(r.setup.size).toBe(0);
	});

	it('schemaVersion 필드가 없으면 버린다', () => {
		const r = parseStored('{"checked":{"setup":["LB"],"direct":[]}}');
		expect(r.setup.size).toBe(0);
	});

	it('checked.setup 이 배열이 아니면 버린다', () => {
		const r = parseStored('{"schemaVersion":1,"checked":{"setup":"LB","direct":[]}}');
		expect(r.setup.size).toBe(0);
	});

	it('유효한 데이터는 Set 두 개로 복원된다', () => {
		const r = parseStored('{"schemaVersion":1,"checked":{"setup":["LB","SC"],"direct":["LB"]}}');
		expect(r.setup.has('LB')).toBe(true);
		expect(r.setup.has('SC')).toBe(true);
		expect(r.setup.size).toBe(2);
		expect(r.direct.has('LB')).toBe(true);
		expect(r.direct.size).toBe(1);
	});

	it('빈 배열은 빈 Set 두 개', () => {
		const r = parseStored('{"schemaVersion":1,"checked":{"setup":[],"direct":[]}}');
		expect(r.setup.size).toBe(0);
		expect(r.direct.size).toBe(0);
	});
});

describe('serialize — round-trip (FR-MC-6)', () => {
	it('출력 JSON 에 schemaVersion: 1 이 있다', () => {
		const s = serialize(empty());
		const parsed = JSON.parse(s);
		expect(parsed.schemaVersion).toBe(1);
	});

	it('빈 상태는 빈 배열 두 개로 직렬화', () => {
		const parsed = JSON.parse(serialize(empty()));
		expect(parsed.checked.setup).toEqual([]);
		expect(parsed.checked.direct).toEqual([]);
	});

	it('배열은 삽입 순서 무관하게 사전순으로 저장된다', () => {
		// 'SC' 를 먼저 삽입해도 저장 배열은 정렬되어야 한다.
		const c: MemorizeChecked = { setup: new Set(['SC', 'LB', 'AB']), direct: new Set() };
		const parsed = JSON.parse(serialize(c));
		expect(parsed.checked.setup).toEqual(['AB', 'LB', 'SC']);
	});

	it('setup 과 direct 를 각각 정렬한다', () => {
		const c: MemorizeChecked = {
			setup: new Set(['SC', 'LB']),
			direct: new Set(['ZZ', 'AA', 'MM'])
		};
		const parsed = JSON.parse(serialize(c));
		expect(parsed.checked.setup).toEqual(['LB', 'SC']);
		expect(parsed.checked.direct).toEqual(['AA', 'MM', 'ZZ']);
	});

	it('round-trip: serialize(parseStored(serialize(x))) === serialize(x)', () => {
		const c: MemorizeChecked = { setup: new Set(['SC', 'LB']), direct: new Set(['LB']) };
		const once = serialize(c);
		const twice = serialize(parseStored(once));
		expect(twice).toBe(once);
	});
});

describe('anchorProgress — 기준별 집계 (FR-MC-2, FR-MC-12)', () => {
	it('빈 setupChecked 는 모든 기준이 0', () => {
		const m = anchorProgress(ds, new Set());
		expect(m.size).toBe(Object.keys(ds.anchors).length);
		for (const [, v] of m) expect(v).toBe(0);
	});

	it('한 케이스만 체크하면 그 케이스의 anchor 만 1', () => {
		const code = pickAnchoredCase();
		const anchor = ds.cases[code].setup.anchor;
		const m = anchorProgress(ds, new Set([code]));
		expect(m.get(anchor)).toBe(1);
		// 다른 기준은 그대로 0
		let sum = 0;
		for (const [, v] of m) sum += v;
		expect(sum).toBe(1);
	});

	it('반환 Map 의 키 집합이 Dataset.anchors 의 키 집합과 정확히 일치', () => {
		const m = anchorProgress(ds, new Set());
		expect([...m.keys()].sort()).toEqual(Object.keys(ds.anchors).sort());
	});

	it('Map 값 합계 === setupChecked 에서 유효 케이스 수', () => {
		// 데이터의 anchored 케이스 3 개를 뽑아 넣는다.
		const anchored = Object.values(ds.cases)
			.filter((c) => c.setup.anchor !== ANCHOR_DIRECT)
			.slice(0, 3)
			.map((c) => c.case);
		const m = anchorProgress(ds, new Set(anchored));
		let sum = 0;
		for (const [, v] of m) sum += v;
		expect(sum).toBe(anchored.length);
	});

	it('directChecked 는 무관 — setup 전용 집계 (FR-MC-1)', () => {
		const code = pickAnchoredCase();
		const withSetup = anchorProgress(ds, new Set([code]));
		// setup 을 그대로 두고 direct 만 뭘 담아도 anchorProgress 는 setup 만 본다.
		const stillSetup = anchorProgress(ds, new Set([code]));
		expect([...stillSetup.entries()]).toEqual([...withSetup.entries()]);
	});

	it('각 기준의 집계는 그 기준을 setup.anchor 로 갖는 데이터의 케이스 수를 넘지 않는다', () => {
		// 데이터의 모든 anchored 케이스를 다 체크했을 때, 각 기준의 카운트는
		// 데이터에서 그 anchor 를 갖는 케이스 수와 정확히 같아야 한다.
		const all = new Set(
			Object.values(ds.cases)
				.filter((c) => c.setup.anchor !== ANCHOR_DIRECT)
				.map((c) => c.case)
		);
		const m = anchorProgress(ds, all);
		for (const name of Object.keys(ds.anchors)) {
			const expected = Object.values(ds.cases).filter((c) => c.setup.anchor === name).length;
			expect(m.get(name), name).toBe(expected);
		}
	});

	it('데이터에 없는 케이스 코드는 조용히 무시한다', () => {
		const m = anchorProgress(ds, new Set(['__nonexistent__']));
		for (const [, v] of m) expect(v).toBe(0);
	});
});

describe('poolFor — 퀴즈 풀 필터 (FR-MC-19)', () => {
	it("mode='setup' 은 setup Set 을 배열로 반환", () => {
		const c: MemorizeChecked = { setup: new Set(['LB', 'SC']), direct: new Set(['ZZ']) };
		expect(poolFor(c, 'setup').sort()).toEqual(['LB', 'SC']);
	});

	it("mode='direct' 는 direct Set 을 배열로 반환", () => {
		const c: MemorizeChecked = { setup: new Set(['LB', 'SC']), direct: new Set(['ZZ']) };
		expect(poolFor(c, 'direct')).toEqual(['ZZ']);
	});

	it('빈 Set 은 빈 배열 (FR-MC-20 안내 조건)', () => {
		expect(poolFor(empty(), 'setup')).toEqual([]);
		expect(poolFor(empty(), 'direct')).toEqual([]);
	});

	it("direct 가 비면 setup 에 항목이 있어도 direct 풀은 빈 배열 (FR-MC-1 독립)", () => {
		const c: MemorizeChecked = { setup: new Set(['LB', 'SC']), direct: new Set() };
		expect(poolFor(c, 'direct')).toEqual([]);
	});

	it('poolFor 호출은 인자 Set 을 변형하지 않는다 (부작용 없음)', () => {
		const c: MemorizeChecked = { setup: new Set(['LB']), direct: new Set(['ZZ']) };
		poolFor(c, 'setup');
		poolFor(c, 'direct');
		expect([...c.setup]).toEqual(['LB']);
		expect([...c.direct]).toEqual(['ZZ']);
	});
});

describe('역케이스 독립 (SPEC 제약)', () => {
	/**
	 * "BF 를 체크해도 FB 가 자동으로 체크되지 않는다" — 데이터의 c.inverse 를
	 * 자동 연동하지 않는다. 여기서는 순수 함수 층위에서 이 성질을 검증한다.
	 * (Set 자체가 그러므로 사실상 Set 의 성질 검증에 가깝다. UI 층 회귀를
	 *  대비한 명시적 마커로 남긴다.)
	 */
	it('setup 에 BF 추가 후 FB 는 여전히 미체크', () => {
		const c = empty();
		c.setup.add('BF');
		expect(c.setup.has('FB')).toBe(false);
	});

	it("setup 과 direct 는 독립: setup 에 BF 를 넣어도 direct.has('BF') 는 false", () => {
		const c = empty();
		c.setup.add('BF');
		expect(c.direct.has('BF')).toBe(false);
	});

	it('BF 와 FB 를 모두 체크한 뒤 각각 비워도 다른 쪽에 영향이 없다', () => {
		const c = empty();
		c.setup.add('BF');
		c.setup.add('FB');
		c.setup.delete('BF');
		expect(c.setup.has('FB')).toBe(true);
	});
});
