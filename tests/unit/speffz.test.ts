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
	CORNER_ROTATION,
	EDGE_CUBIE,
	EDGE_FACELETS,
	EDGE_INDEX,
	faceOfIndex,
	primaryAxisSticker,
	rotationOf
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

/**
 * T1A-1. 회전 방향 순서 — cubejs 물리로 확인한다.
 *
 * 우리가 적은 순서를 우리가 확인하지 않는다. 면 4분회전을 걸어보고, 큐비가
 * 옮겨간 자리에서 인덱스가 어떻게 대응되는지를 cubejs 에게 묻는다.
 *
 * 기대는 두 층이다:
 *  - U·D 회전: 인덱스가 **그대로** 보존된다. U/D 축을 기준으로 한 방향 정의라
 *    이 두 회전은 코너를 비틀지 않는다.
 *  - R·L·F·B 회전: 인덱스가 **순환 이동** 한다. 이동량이 0 이 아닌 것이 곧
 *    코너 비틀림이므로 0 을 요구할 수 없다. 요구할 수 있는 것은 "순환" 이며,
 *    한 큐비의 순서가 반대로 적혀 있으면 순환이 아니라 뒤집힘으로 나온다.
 */
describe('T1A-1. CORNER_ROTATION', () => {
	const sim = new CubeSim();
	const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

	it('각 큐비의 스티커 3개가 CORNER_FACELETS 와 집합으로 같다', () => {
		const bad: string[] = [];
		for (const [cubie, rot] of Object.entries(CORNER_ROTATION)) {
			const fromRot = rot.map((s) => CORNER_INDEX[s]).sort((a, b) => a - b);
			const fromFacelets = [...CORNER_FACELETS[cubie]].sort((a, b) => a - b);
			if (fromRot.join() !== fromFacelets.join()) bad.push(`${cubie}: ${fromRot} != ${fromFacelets}`);
		}
		expect(bad).toEqual([]);
	});

	/** 회전 후 "원래 s 자리에 있던 스티커가 지금 앉아 있는 자리". */
	const destination = (move: string) => {
		const st = sim.apply(sim.solvedCorners(), move, 'corner');
		const to: Record<string, string> = {};
		for (const [pos, origin] of Object.entries(st)) to[origin] = pos;
		return to;
	};

	it('면 4분회전 6개 × 코너 8개 = 48 조합에서 인덱스가 순환 이동한다', () => {
		const bad: string[] = [];
		let combos = 0;
		for (const face of FACES) {
			const to = destination(face);
			for (const [cubie, rot] of Object.entries(CORNER_ROTATION)) {
				combos++;
				const moved = CORNER_CUBIE[to[rot[0]]];
				const target = CORNER_ROTATION[moved];
				const shift = target.indexOf(to[rot[0]]);
				for (let i = 0; i < rot.length; i++) {
					const got = to[rot[i]];
					const want = target[(shift + i) % rot.length];
					if (got !== want) bad.push(`${face}: ${cubie}[${i}] → ${got}, 기대 ${want}`);
				}
			}
		}
		expect(combos).toBe(48);
		expect(bad).toEqual([]);
	});

	it('U·D 회전은 인덱스를 그대로 보존한다 (방향 정의의 축)', () => {
		const bad: string[] = [];
		for (const face of ['U', 'D']) {
			const to = destination(face);
			for (const [cubie, rot] of Object.entries(CORNER_ROTATION)) {
				const moved = CORNER_CUBIE[to[rot[0]]];
				for (let i = 0; i < rot.length; i++)
					if (to[rot[i]] !== CORNER_ROTATION[moved][i])
						bad.push(`${face}: ${cubie}[${i}] → ${to[rot[i]]}, 기대 ${CORNER_ROTATION[moved][i]}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('UFL 과 DBL 은 CORNER_FACELETS 나열 순서와 다르다 (AD-3 의 두 예외)', () => {
		for (const cubie of ['UFL', 'DBL'])
			expect(CORNER_ROTATION[cubie].map((s) => CORNER_INDEX[s])).not.toEqual(
				CORNER_FACELETS[cubie]
			);
	});

	it('나머지 6개는 CORNER_FACELETS 순서와 같다', () => {
		for (const cubie of Object.keys(CORNER_ROTATION))
			if (cubie !== 'UFL' && cubie !== 'DBL')
				expect(CORNER_ROTATION[cubie].map((s) => CORNER_INDEX[s])).toEqual(CORNER_FACELETS[cubie]);
	});

	it('rotationOf(edge) 는 큐비마다 2칸이고 EDGE_FACELETS 와 같은 칸을 가리킨다', () => {
		for (const [cubie, rot] of Object.entries(rotationOf('edge'))) {
			expect(rot.length).toBe(2);
			expect(rot.map((s) => EDGE_INDEX[s])).toEqual(EDGE_FACELETS[cubie]);
		}
	});
});

describe('T1A-1. primaryAxisSticker', () => {
	it('코너 8개 전부 U/D 축 스티커를 하나씩 갖는다', () => {
		for (const cubie of Object.keys(CORNER_ROTATION))
			expect(CORNER_ROTATION[cubie]).toContain(primaryAxisSticker('corner', cubie));
	});

	it('U 면·D 면 코너의 축 스티커는 그 면의 칸이다', () => {
		for (const cubie of Object.keys(CORNER_ROTATION)) {
			const s = primaryAxisSticker('corner', cubie);
			expect(faceOfIndex(CORNER_INDEX[s])).toBe(cubie[0]);
		}
	});
});
