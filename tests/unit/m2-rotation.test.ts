/**
 * M2 엣지 공식: B 면 공식 vs. 원래 x-rotation 공식 (SPEC FR-M2-D-2).
 *
 * 사용자 PDF 는 `x' … x` 로 큐브를 회전시켜 L/R/U 로 B 면을 치는 공식 6개를
 * 들고 있지만, 큐브를 돌리면 기준 자리 UB 가 틀어져 머리로도 손으로도 헷갈린다.
 * 그래서 데이터에는 **회전 없는 B 면 공식**을 넣었다 (M·E·P·F·O·G 여섯 줄).
 *
 * 이 검사는 두 가지가 54칸(스티커 + 센터) 수준에서 같은 상태를 내는지 확인한다.
 * 데이터의 공식이 변환 과정에서 깨지지 않았는가가 질문이다.
 */
import { describe, it, expect } from 'vitest';
import { faceletsOf } from '../../src/lib/cube/sim.js';
import dataJson from '../../src/lib/data/edge-DF-m2.json';
import { type M2DataSet } from '../../src/lib/domain/m2.js';

const ds = dataJson as unknown as M2DataSet;

const PAIRS: Array<{ id: string; letter: string; xRot: string }> = [
	{ id: 'm', letter: 'M', xRot: "x' U' R U M2 U' R' U x" },
	{ id: 'e', letter: 'E', xRot: "x' U L' U' M2 U L U' x" },
	{ id: 'p', letter: 'P', xRot: "x' U' R2 U M2 U' R2 U x" },
	{ id: 'f', letter: 'F', xRot: "x' U L2 U' M2 U L2 U' x" },
	{ id: 'o', letter: 'O', xRot: "x' U' R' U M2 U' R U x" },
	{ id: 'g', letter: 'G', xRot: "x' U L U' M2 U L' U' x" }
];

describe('B 면 공식 6개는 원래 x-rotation 공식과 54칸 상태가 같다', () => {
	for (const { id, letter, xRot } of PAIRS) {
		it(`${letter} (${id}): 데이터 공식 ≡ ${xRot}`, () => {
			const row = ds.rows.find((r) => r.id === id);
			if (!row) throw new Error(`row ${id} not found in data`);
			expect(faceletsOf(row.alg)).toBe(faceletsOf(xRot));
		});
	}
});
