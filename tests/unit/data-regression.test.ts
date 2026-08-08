/**
 * 원본 데이터 회귀 테스트 — handoff/sim/test_sim.mjs 재현 (1134건).
 *
 * 이식한 src/lib/cube/sim.ts 를 사용한다. 원본 cube-sim.js 를 import 하면
 * 이식 검증이 되지 않는다.
 */
import { describe, it, expect } from 'vitest';
import { CubeSim, type Perms } from '../../src/lib/cube/sim.js';
import { invertAlg, cancelMoves, moveCount } from '../../src/lib/cube/notation.js';
import permsJson from '../../src/lib/cube/perms.json';
import dataJson from '../../src/lib/data/corner-UBL.json';
import { ANCHOR_DIRECT, type Dataset } from '../../src/lib/domain/types.js';

const sim = new CubeSim(permsJson as unknown as Perms);
const data = dataJson as unknown as Dataset;
const entries = Object.entries(data.cases);

describe('데이터 무결성', () => {
	it('378 케이스', () => {
		expect(entries.length).toBe(378);
	});
	// 기준 개수는 데이터가 정한다 (v2 10개 → v3 6개). 개수 대신 정합성만 고정한다.
	it('anchor.count 합 + (직접) 케이스 = 전체 케이스 수', () => {
		const sum = Object.values(data.anchors).reduce((a, x) => a + x.count, 0);
		const direct = entries.filter(([, c]) => c.setup.anchor === ANCHOR_DIRECT).length;
		expect(sum + direct).toBe(entries.length);
	});

	it('anchor.count 가 실제 담당 케이스 수와 일치한다', () => {
		const bad: string[] = [];
		for (const [name, a] of Object.entries(data.anchors)) {
			const n = entries.filter(([, c]) => c.setup.anchor === name).length;
			if (n !== a.count) bad.push(`${name}: ${a.count} != ${n}`);
		}
		expect(bad).toEqual([]);
	});

	it('모든 케이스의 anchor 가 anchors 에 존재한다 ((직접) 제외)', () => {
		const bad = entries.filter(
			([, c]) => c.setup.anchor !== ANCHOR_DIRECT && !(c.setup.anchor in data.anchors)
		);
		expect(bad.map(([k]) => k)).toEqual([]);
	});
});

describe('시뮬레이터 회귀 (1134건)', () => {
	it('direct.alg 가 해당 케이스를 푼다 (378)', () => {
		const bad = entries.filter(([k, c]) => sim.identifyCase(c.direct.alg) !== k);
		expect(bad.map(([k]) => k)).toEqual([]);
	});

	it('setup.alg 가 해당 케이스를 푼다 (378)', () => {
		const bad = entries.filter(([k, c]) => sim.identifyCase(c.setup.alg) !== k);
		expect(bad.map(([k]) => k)).toEqual([]);
	});

	it('direct/setup 모두 엣지 무영향 (756)', () => {
		const bad = entries.filter(
			([, c]) => !sim.isEdgeNeutral(c.direct.alg) || !sim.isEdgeNeutral(c.setup.alg)
		);
		expect(bad.map(([k]) => k)).toEqual([]);
	});

	it('moves 필드가 실제 무브 수와 일치 (756)', () => {
		const bad = entries.filter(
			([, c]) =>
				moveCount(c.direct.alg) !== c.direct.moves || moveCount(c.setup.alg) !== c.setup.moves
		);
		expect(bad.map(([k]) => k)).toEqual([]);
	});

	it('역트릭: direct.alg 를 뒤집으면 역케이스를 푼다 (378)', () => {
		const bad = entries.filter(
			([, c]) => sim.identifyCase(cancelMoves(invertAlg(c.direct.alg))) !== c.inverse
		);
		expect(bad.map(([k]) => k)).toEqual([]);
	});

	/**
	 * 조회 화면의 역케이스 링크가 출처(?from=)를 그대로 실어 보내는 근거다.
	 * 역케이스가 다른 기준에 속하게 되면 "← GC" 가 지금 보는 케이스를 담지 않은
	 * 페이지를 가리키게 된다. 그때는 링크에서 출처를 떼야 한다.
	 */
	it('역케이스는 같은 기준에 속한다 (378)', () => {
		const bad = entries.filter(([, c]) => {
			const inv = data.cases[c.inverse];
			return inv && inv.setup.anchor !== c.setup.anchor;
		});
		expect(bad.map(([k]) => k)).toEqual([]);
	});
});
