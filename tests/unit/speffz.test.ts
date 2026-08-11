/**
 * Speffz 좌표 검증.
 *
 * 무브의 물리는 cubejs 가 안다. 우리 저장소에 남은 큐브 지식은 `speffz.ts` 의
 * 좌표 — "어느 문자가 어느 facelet 인가" — 하나뿐이고, 이 파일이 그걸 지킨다.
 *
 * 대조 상대는 데이터다. `corner-UBL.json` 은 케이스마다 타깃을
 * `{sticker, cubie, face}` 삼중항으로 적어두므로, 756개를 우리 좌표와 맞춰보면
 * 24개 문자의 배정이 전부 걸린다. 우리가 만든 값이 아니라는 점이 중요하다.
 */
import { describe, it, expect } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import {
	CORNER_CUBIE,
	CORNER_FACELETS,
	CORNER_INDEX,
	EDGE_CUBIE,
	EDGE_FACELETS,
	EDGE_INDEX,
	faceOfIndex
} from '../../src/lib/cube/speffz.js';
import { CubeSim } from '../../src/lib/cube/sim.js';
import dataJson from '../../src/lib/data/corner-UBL.json';

type Target = { sticker: string; cubie: string; face: string };
const cases = Object.values(
	(dataJson as unknown as { cases: Record<string, { target1: Target; target2: Target }> }).cases
);

describe('Speffz 좌표 ↔ 데이터', () => {
	it('378 케이스의 타깃 삼중항 756개가 좌표와 일치한다', () => {
		const bad: string[] = [];
		for (const c of cases)
			for (const t of [c.target1, c.target2]) {
				const i = CORNER_INDEX[t.sticker];
				if (i === undefined) bad.push(`${t.sticker}: 좌표에 없음`);
				else if (CORNER_CUBIE[t.sticker] !== t.cubie)
					bad.push(`${t.sticker}: 데이터 ${t.cubie}, 좌표 ${CORNER_CUBIE[t.sticker]}`);
				else if (faceOfIndex(i) !== t.face)
					bad.push(`${t.sticker}: 데이터 ${t.face}면, 좌표 ${faceOfIndex(i)}면`);
			}
		expect(bad).toEqual([]);
	});

	it('24개 코너 문자가 전부 데이터에 등장한다 (버퍼 3개 제외)', () => {
		const seen = new Set(cases.flatMap((c) => [c.target1.sticker, c.target2.sticker]));
		const missing = Object.keys(CORNER_INDEX).filter(
			(s) => !seen.has(s) && !['A', 'E', 'R'].includes(s)
		);
		expect(missing).toEqual([]);
	});
});

describe('Speffz 좌표 내부 정합', () => {
	it('문자 48개가 서로 다른 facelet 을 가리킨다', () => {
		const all = [...Object.values(CORNER_INDEX), ...Object.values(EDGE_INDEX)];
		expect(new Set(all).size).toBe(48);
	});

	it('큐비마다 코너 3문자·엣지 2문자가 배정된다', () => {
		const count = (m: Record<string, string>) =>
			Object.values(m).reduce<Record<string, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {});
		expect(Object.values(count(CORNER_CUBIE))).toEqual(Array(8).fill(3));
		expect(Object.values(count(EDGE_CUBIE))).toEqual(Array(12).fill(2));
	});

	it('facelet 목록과 문자 좌표가 같은 칸을 가리킨다', () => {
		for (const [letter, i] of Object.entries(CORNER_INDEX))
			expect(CORNER_FACELETS[CORNER_CUBIE[letter]]).toContain(i);
		for (const [letter, i] of Object.entries(EDGE_INDEX))
			expect(EDGE_FACELETS[EDGE_CUBIE[letter]]).toContain(i);
	});
});

describe('cubejs 관례 확인', () => {
	// 라이브러리를 올렸을 때 관례가 바뀌면 여기서 걸린다. 0.3.0 의 버그가 정확히
	// 이 지점(L 의 방향)이었으므로 표준인지 한 번 못박아 둔다.
	it('L 은 표준이다 — U 스티커가 F 로 간다', () => {
		const s = new Cube().move('L').asString();
		expect(s[18]).toBe(new Cube().asString()[0]); // UFL 의 F면 ← UBL 의 U면 색
	});

	it('슬라이스는 M=L, E=D, S=F 방향이다', () => {
		const sim = new CubeSim();
		// 슬라이스는 조각의 방향도 바꾸므로 도착한 스티커가 원래 어느 면이었는지까지 본다.
		// M(L 방향): UF 자리의 U면 ← UB 조각의 B면(q)
		expect(sim.apply(sim.solvedEdges(), 'M', 'edge')['c']).toBe('q');
		// E(D 방향): BR 자리의 B면 ← FR 조각의 F면(j)
		expect(sim.apply(sim.solvedEdges(), 'E', 'edge')['n']).toBe('j');
		// S(F 방향): UR 자리의 U면 ← UL 조각의 L면(e)
		expect(sim.apply(sim.solvedEdges(), 'S', 'edge')['b']).toBe('e');
	});

	it('회전과 wide 무브도 받는다', () => {
		const sim = new CubeSim();
		for (const m of ['x', "y'", 'z2', 'r', "u'"])
			expect(() => sim.apply(sim.solvedCorners(), m)).not.toThrow();
	});
});
