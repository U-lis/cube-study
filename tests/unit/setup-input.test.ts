/**
 * 퀴즈 setup 입력의 전제 검증.
 *
 * 화면은 셋업 무브 S 와 기준(방향 포함)만 받고, 채점 직전에 expandSetup() 으로
 * `S + 기준(또는 그 역) + S'` 를 펼친다. 이 조립식이 데이터의 setup.strict.alg 와
 * 어긋나면 맞게 푼 사용자가 오답 처리된다.
 *
 * 기준의 개수·이름은 어디에도 적지 않는다. 데이터가 정한다.
 */
import { describe, it, expect } from 'vitest';
import { CubeSim } from '../../src/lib/cube/sim.js';
import { splitMoves } from '../../src/lib/cube/notation.js';
import { grade } from '../../src/lib/domain/grade.js';
import { anchorOrder, anchorRef, anchorRefs, expandSetup, refLabel } from '../../src/lib/domain/anchor.js';
import dataJson from '../../src/lib/data/corner-UBL.json';
import { ANCHOR_DIRECT, type Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim();
const ds = dataJson as unknown as Dataset;
const cases = Object.values(ds.cases);
const anchored = cases.filter((c) => c.setup.anchor !== ANCHOR_DIRECT);

describe('기준 목록', () => {
	it('anchorOrder 가 anchors 를 하나도 빠뜨리지 않는다', () => {
		expect([...anchorOrder(ds)].sort()).toEqual(Object.keys(ds.anchors).sort());
	});

	it('meta.anchorLearnOrder 가 있으면 그 순서를 그대로 쓴다', () => {
		if (ds.meta.anchorLearnOrder) expect(anchorOrder(ds)).toEqual(ds.meta.anchorLearnOrder);
	});

	it('선택지는 기준마다 정·역 두 칸', () => {
		const refs = anchorRefs(ds);
		expect(refs).toHaveLength(anchorOrder(ds).length * 2);
		expect(new Set(refs.map(refLabel)).size).toBe(refs.length);
	});

	it('어느 기준도 self-inverse 가 아니다 (방향이 유의미하다)', () => {
		const same = anchorOrder(ds).filter(
			(n) => expandSetup(ds, '', { name: n, inverse: true }) === ds.anchors[n].alg
		);
		expect(same).toEqual([]);
	});
});

describe('setup 입력 조립', () => {
	it('S + 기준(방향) + S 역 이 데이터의 setup.strict.alg 와 일치한다', () => {
		const bad: string[] = [];
		for (const c of anchored) {
			const got = expandSetup(ds, c.setup.S, anchorRef(c)!);
			if (got !== c.setup.strict.alg) bad.push(`${c.case}: ${got} != ${c.setup.strict.alg}`);
		}
		expect(bad).toEqual([]);
	});

	it('조립한 알고리즘이 전부 correct 로 채점된다', () => {
		const bad: string[] = [];
		for (const c of anchored) {
			const v = grade(sim, ds, c, expandSetup(ds, c.setup.S, anchorRef(c)!));
			if (v.kind !== 'correct') bad.push(`${c.case}: ${v.kind}`);
		}
		expect(bad).toEqual([]);
	});

	/** 방향을 틀리면 다른 케이스를 푸는 알고리즘이 된다 — 관대하게 채점하면 안 되는 이유. */
	it('방향을 뒤집으면 어느 케이스도 correct 가 아니다', () => {
		const bad: string[] = [];
		for (const c of anchored) {
			const ref = anchorRef(c)!;
			const flipped = { name: ref.name, inverse: !ref.inverse };
			if (grade(sim, ds, c, expandSetup(ds, c.setup.S, flipped)).kind === 'correct')
				bad.push(c.case);
		}
		expect(bad).toEqual([]);
	});

	it('다른 기준을 고르면 correct 가 아니다', () => {
		const bad: string[] = [];
		for (const c of anchored) {
			const ref = anchorRef(c)!;
			const other = anchorOrder(ds).find((n) => n !== ref.name);
			if (!other) break;
			if (grade(sim, ds, c, expandSetup(ds, c.setup.S, { name: other, inverse: ref.inverse })).kind === 'correct')
				bad.push(c.case);
		}
		expect(bad).toEqual([]);
	});

	it('셋업 무브가 전부 18버튼 키패드로 입력 가능하다', () => {
		const keypad = new Set(
			['U', 'L', 'F', 'R', 'B', 'D'].flatMap((f) => ['', "'", '2'].map((s) => f + s))
		);
		const unknown = new Set<string>();
		for (const c of anchored) {
			for (const mv of splitMoves(c.setup.S)) if (!keypad.has(mv)) unknown.add(mv);
		}
		expect([...unknown]).toEqual([]);
	});

	it('기준이 없는 케이스는 setup 입력으로 표현할 수 없다', () => {
		// v3 에는 0건. 남아 있다면 퀴즈가 그 사실을 알려줘야 한다.
		const direct = cases.filter((c) => !anchorRef(c));
		expect(direct.map((c) => c.case)).toEqual(
			cases.filter((c) => c.setup.anchor === ANCHOR_DIRECT).map((c) => c.case)
		);
	});
});
