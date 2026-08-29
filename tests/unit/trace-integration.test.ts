/**
 * Phase 1.5 — 세 갈래(엔진 · 스크램블 · 뷰어)가 서로를 처음 만나는 지점.
 *
 * 각 갈래 안에서 참인 것은 자기 테스트가 본다. 여기는 **경계**만 본다.
 * 가장 위험한 것은 좌표계다 — 뷰어의 (큐비, 면)과 Speffz 의 facelet 인덱스가
 * 어긋나면 하이라이트가 엉뚱한 조각에 칠해지고, 그 화면은 "틀린 답을 가르치는" 화면이 된다.
 */
import { describe, expect, it } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import {
	CORNER_CUBIE,
	CORNER_FACELETS,
	CORNER_INDEX,
	EDGE_CUBIE,
	EDGE_FACELETS,
	EDGE_INDEX
} from '../../src/lib/cube/speffz.js';
import { cubieKey, faceletToCubie } from '../../src/lib/cube/cube3d-map.js';
import { stateFromFacelets } from '../../src/lib/cube/sim.js';
import { splitCore } from '../../src/lib/cube/scramble.js';
import { applyTargets, trace, type TraceOptions } from '../../src/lib/cube/trace.js';

const CORNER: TraceOptions = {
	pieceKind: 'corner',
	bufferStickers: ['A', 'E', 'R'],
	primarySticker: 'A'
};
const EDGE: TraceOptions = {
	pieceKind: 'edge',
	bufferStickers: ['c', 'i'],
	primarySticker: 'c'
};

/** 시드 고정 LCG. 테스트가 실행마다 다른 것을 보면 안 된다. */
function lcg(seed: number) {
	let s = seed >>> 0;
	return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const randomAlg = (rnd: () => number, n: number) => {
	const faces = 'URFDLB';
	const sfx = ['', "'", '2'];
	const out: string[] = [];
	let last = '';
	while (out.length < n) {
		const f = faces[Math.floor(rnd() * 6)];
		if (f === last) continue;
		last = f;
		out.push(f + sfx[Math.floor(rnd() * 3)]);
	}
	return out.join(' ');
};

describe('T1.5-1 좌표계 일치 — 뷰어 매핑 ↔ Speffz', () => {
	it('코너 스티커 24개가 같은 큐비를 가리킨다', () => {
		// 뷰어는 큐비를 좌표 [x,y,z] 로, Speffz 는 이름('UBL')으로 부른다.
		// 이름이 같은 것끼리 좌표가 같은지가 아니라, **같은 이름은 같은 좌표**인지를 본다.
		const byName = new Map<string, string>();
		for (const [letter, i] of Object.entries(CORNER_INDEX)) {
			const key = cubieKey(faceletToCubie(i).cubie);
			const name = CORNER_CUBIE[letter];
			const seen = byName.get(name);
			if (seen === undefined) byName.set(name, key);
			else expect(key, `${letter} (${name})`).toBe(seen);
		}
		expect(byName.size).toBe(8);
		expect(new Set(byName.values()).size).toBe(8); // 서로 다른 큐비 8개
	});

	it('엣지 스티커 24개가 같은 큐비를 가리킨다', () => {
		const byName = new Map<string, string>();
		for (const [letter, i] of Object.entries(EDGE_INDEX)) {
			const key = cubieKey(faceletToCubie(i).cubie);
			const name = EDGE_CUBIE[letter];
			const seen = byName.get(name);
			if (seen === undefined) byName.set(name, key);
			else expect(key, `${letter} (${name})`).toBe(seen);
		}
		expect(byName.size).toBe(12);
		expect(new Set(byName.values()).size).toBe(12);
	});

	it('센터 6칸이 서로 다른 큐비다', () => {
		// 면 순서는 URFDLB, 각 면의 5번째 칸(인덱스 4)이 센터다.
		const centers = [0, 1, 2, 3, 4, 5].map((f) => cubieKey(faceletToCubie(f * 9 + 4).cubie));
		expect(new Set(centers).size).toBe(6);
	});

	it('54칸이 모두 다른 (큐비, 면) 자리에 앉는다', () => {
		const slots = new Set<string>();
		for (let i = 0; i < 54; i++) {
			const { cubie, face } = faceletToCubie(i);
			slots.add(`${cubieKey(cubie)}#${face}`);
		}
		expect(slots.size).toBe(54);
	});

	it('뷰어가 모은 큐비별 facelet 집합이 speffz 와 정확히 같다', () => {
		// 좌표계가 어긋나는 가장 흔한 형태는 "한 면의 행·열이 뒤집힌" 것이다.
		// 큐비별로 어떤 facelet 이 모이는지를 비교하면 그 뒤집힘이 드러난다.
		const grouped = new Map<string, number[]>();
		for (let i = 0; i < 54; i++) {
			const key = cubieKey(faceletToCubie(i).cubie);
			grouped.set(key, [...(grouped.get(key) ?? []), i]);
		}
		for (const [cubie, indices] of Object.entries(CORNER_FACELETS)) {
			const key = cubieKey(faceletToCubie(indices[0]).cubie);
			expect([...(grouped.get(key) ?? [])].sort((a, b) => a - b), cubie).toEqual(
				[...indices].sort((a, b) => a - b)
			);
		}
		for (const [cubie, indices] of Object.entries(EDGE_FACELETS)) {
			const key = cubieKey(faceletToCubie(indices[0]).cubie);
			expect([...(grouped.get(key) ?? [])].sort((a, b) => a - b), cubie).toEqual(
				[...indices].sort((a, b) => a - b)
			);
		}
	});

	it('스크램블한 상태의 색이 자리를 바꾸지 않고 실린다', () => {
		const rnd = lcg(20260820);
		const c = new Cube();
		c.move(randomAlg(rnd, 12));
		const s = c.asString();
		// 뷰어에 넘기는 배열은 asString() 그대로다. 매핑은 자리만 정하고 색을 건드리지 않는다.
		const painted = new Map<string, string>();
		for (let i = 0; i < 54; i++) {
			const { cubie, face } = faceletToCubie(i);
			painted.set(`${cubieKey(cubie)}#${face}`, s[i]);
		}
		expect(painted.size).toBe(54);
		expect([...painted.values()].join('')).toHaveLength(54);
		for (const color of 'URFDLB') {
			expect([...painted.values()].filter((v) => v === color)).toHaveLength(9);
		}
	});
});

describe('T1.5-2 스크램블 → 상태 → 타깃 → 실행', () => {
	// initSolver() 를 부르지 않는다. 1.7초 걸리고 여기서 검증하려는 것도 아니다.
	const fakeCube = (alg: string) => ({ solve: () => alg });

	for (const [name, opts] of [
		['코너 UBL', CORNER],
		['엣지 UF', EDGE]
	] as const) {
		it(`${name} — 무작위 100개가 전부 풀린다`, () => {
			const rnd = lcg(19700101);
			let solved = 0;
			for (let n = 0; n < 100; n++) {
				const { core } = splitCore(scrambleOf(fakeCube(randomAlg(rnd, 20))));
				const c = new Cube();
				c.move(core);
				const state = stateFromFacelets(c.asString(), opts.pieceKind);
				const { targets } = trace(state, opts);
				const out = applyTargets(state, targets, opts);
				if (Object.entries(out).every(([p, v]) => p === v)) solved++;
			}
			expect(solved).toBe(100);
		});
	}

	it('지금은 core 와 scramble 이 같다', () => {
		// Cube.random().solve() 의 역은 면 무브만 내놓는다. 방향 무작위화(wide)를 붙이는
		// 순간 갈리고, 그때 scramble 을 상태 계산에 쓰면 문자가 통째로 틀어진다.
		const rnd = lcg(7);
		for (let n = 0; n < 20; n++) {
			const s = scrambleOf(fakeCube(randomAlg(rnd, 20)));
			const { scramble, core } = splitCore(s);
			expect(core).toBe(scramble);
		}
	});
});

/** `scrambleFrom` 과 같은 경로를 쓰되 여기서는 문자열만 필요하다. */
function scrambleOf(cube: { solve(): string }): string {
	return cube
		.solve()
		.trim()
		.split(/\s+/)
		.reverse()
		.map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'"))
		.join(' ');
}
