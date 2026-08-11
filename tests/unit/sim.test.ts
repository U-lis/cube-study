import { describe, it, expect } from 'vitest';
import { CubeSim } from '../../src/lib/cube/sim.js';

const sim = new CubeSim();

describe('시뮬레이터 경계', () => {
	it('미지 무브는 throw', () => {
		expect(() => sim.apply(sim.solvedCorners(), 'Z')).toThrow('Unknown move: Z');
	});
	it('빈 알고리즘은 상태 불변', () => {
		expect(sim.apply(sim.solvedCorners(), '')).toEqual(sim.solvedCorners());
	});
	it('슬라이스 무브 M2 가 엣지를 바꾼다', () => {
		expect(sim.isSolved(sim.applyToEdges(sim.solvedEdges(), 'M2'))).toBe(false);
	});
	it('27무브 전부 지원 (U L F R B D M E S x 3)', () => {
		const faces = ['U', 'L', 'F', 'R', 'B', 'D', 'M', 'E', 'S'];
		for (const f of faces)
			for (const s of ['', "'", '2'])
				expect(() => sim.apply(sim.solvedCorners(), f + s)).not.toThrow();
	});
});

describe('identifyCase', () => {
	it('항등 알고리즘은 null', () => {
		expect(sim.identifyCase("R R'")).toBeNull();
	});
	it('빈 알고리즘은 null', () => {
		expect(sim.identifyCase('')).toBeNull();
	});
	it('sexy move 는 3-cycle 이 아니라 null', () => {
		expect(sim.identifyCase("R U R' U'")).toBeNull();
	});
	it('LB 알고리즘을 LB 로 식별', () => {
		expect(sim.identifyCase("R D2 R' U R D2 R' U'")).toBe('LB');
	});
});

describe('isEdgeNeutral', () => {
	it('sexy move 는 엣지를 건드린다', () => {
		expect(sim.isEdgeNeutral("R U R' U'")).toBe(false);
	});
	it('LB 알고리즘은 엣지 무영향', () => {
		expect(sim.isEdgeNeutral("R D2 R' U R D2 R' U'")).toBe(true);
	});
});

describe('affectedCubies', () => {
	it('LB 는 3개 코너 큐비만 건드린다', () => {
		const st = sim.applyToCorners(sim.solvedCorners(), "R D2 R' U R D2 R' U'");
		expect(sim.affectedCubies(st, 'corner')).toHaveLength(3);
	});
	it('LB 는 엣지 큐비를 건드리지 않는다', () => {
		const st = sim.applyToEdges(sim.solvedEdges(), "R D2 R' U R D2 R' U'");
		expect(sim.affectedCubies(st, 'edge')).toEqual([]);
	});
});
