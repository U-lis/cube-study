/**
 * 3D 뷰어의 순수부 (PHASE_1C_TEST T1C-1 ~ T1C-3).
 *
 * `three` 를 import 하지 않는다 — WebGL 이 없는 node 환경에서 돌아야 하고, 이 파일이
 * `three` 를 끌어오면 지연 로드 검사(`bundle-three.test.ts`)의 의미가 흐려진다.
 * 그래서 대상은 `cube3d.ts` 가 아니라 순수부인 `cube3d-map.ts` 다.
 *
 * 그림이 맞는지는 여기서 보지 않는다. 눈 확인과 Phase 5 의 E2E 가 본다.
 */
import { describe, it, expect } from 'vitest';
import {
	assertFacelets,
	assertMarks,
	CAMERA_DISTANCE,
	cubieCoords,
	cubieKey,
	faceletToCubie,
	orientationOf,
	ORIENTATION_COUNT,
	type Mark
} from '../../src/lib/cube/cube3d-map.js';
import { CORNER_FACELETS, EDGE_FACELETS } from '../../src/lib/cube/speffz.js';

const ALL = Array.from({ length: 54 }, (_, i) => i);
/** material 인덱스 → 축 이름. `three` 의 BoxGeometry 규약 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z */
const AXIS = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
/** 면 순서 URFDLB 가 어느 축을 보는가. */
const FACE_AXIS: Record<string, string> = {
	U: '+Y',
	R: '+X',
	F: '+Z',
	D: '-Y',
	L: '-X',
	B: '-Z'
};

describe('T1C-1. faceletToCubie — 54칸 매핑', () => {
	it('0~53 전부에 좌표와 material 인덱스가 나온다', () => {
		const slots = ALL.map(faceletToCubie);
		expect(slots).toHaveLength(54);
		for (const { cubie, face } of slots) {
			expect(cubie.every((c) => c === -1 || c === 0 || c === 1)).toBe(true);
			expect(face).toBeGreaterThanOrEqual(0);
			expect(face).toBeLessThanOrEqual(5);
		}
	});

	it('범위 밖 인덱스는 조용히 넘어가지 않는다', () => {
		expect(() => faceletToCubie(-1)).toThrow();
		expect(() => faceletToCubie(54)).toThrow();
		expect(() => faceletToCubie(1.5)).toThrow();
	});

	it('서로 다른 두 인덱스가 같은 (큐비, 면)으로 가지 않는다', () => {
		const seen = new Set(
			ALL.map((i) => {
				const { cubie, face } = faceletToCubie(i);
				return `${cubieKey(cubie)}#${face}`;
			})
		);
		expect(seen.size).toBe(54);
	});

	it.each(Object.entries(FACE_AXIS).map(([face, axis], n) => [face, axis, n]))(
		'%s 면 9칸이 전부 %s 를 본다',
		(_face, axis, n) => {
			const block = ALL.slice((n as number) * 9, (n as number) * 9 + 9);
			expect(block.map((i) => AXIS[faceletToCubie(i).face])).toEqual(Array(9).fill(axis));
		}
	);

	it('코너 8개가 3칸, 엣지 12개가 2칸, 센터 6개가 1칸을 받는다', () => {
		const count = new Map<string, number>();
		for (const i of ALL) {
			const key = cubieKey(faceletToCubie(i).cubie);
			count.set(key, (count.get(key) ?? 0) + 1);
		}
		const byCount = (n: number) => [...count.values()].filter((v) => v === n).length;
		expect(byCount(3)).toBe(8);
		expect(byCount(2)).toBe(12);
		expect(byCount(1)).toBe(6);
		// 26개 큐비가 전부 최소 한 칸을 받는다. 중앙(0,0,0)은 그리지 않는다.
		expect(count.size).toBe(26);
		expect(cubieCoords()).toHaveLength(26);
	});

	/**
	 * 뷰어의 좌표계가 앱의 좌표계와 같다는 확인이다. `speffz.ts` 의 좌표는 데이터의
	 * `target1/target2` 삼중항 756개와 이미 대조돼 있으므로, 그것이 한 큐비로 묶는
	 * 인덱스들이 여기서도 한 큐비로 모이면 두 좌표계가 같다.
	 */
	it('speffz 의 CORNER_FACELETS / EDGE_FACELETS 가 같은 큐비로 모인다', () => {
		for (const [kind, table] of [
			['corner', CORNER_FACELETS],
			['edge', EDGE_FACELETS]
		] as const) {
			for (const [cubie, indices] of Object.entries(table)) {
				const keys = new Set(indices.map((i) => cubieKey(faceletToCubie(i).cubie)));
				expect(keys.size, `${kind} ${cubie}`).toBe(1);
			}
		}
	});

	/** 큐비 이름의 글자(U/D/F/B/L/R)가 그 큐비의 좌표 부호와 맞는지까지 본다. */
	it('큐비 이름과 좌표 부호가 맞는다', () => {
		const sign: Record<string, [number, number, number]> = {
			U: [0, 1, 0],
			D: [0, -1, 0],
			R: [1, 0, 0],
			L: [-1, 0, 0],
			F: [0, 0, 1],
			B: [0, 0, -1]
		};
		for (const table of [CORNER_FACELETS, EDGE_FACELETS]) {
			for (const [cubie, indices] of Object.entries(table)) {
				const expected = [...cubie].reduce(
					(a, ch) => a.map((v, k) => v + sign[ch][k]) as [number, number, number],
					[0, 0, 0] as [number, number, number]
				);
				expect(faceletToCubie(indices[0]).cubie, cubie).toEqual(expected);
			}
		}
	});
});

describe('T1C-2. 24방향 카메라', () => {
	const all = Array.from({ length: ORIENTATION_COUNT }, (_, i) => orientationOf(i));

	it('0~23 에서 전부 정의된다', () => {
		expect(all).toHaveLength(24);
		expect(() => orientationOf(24)).toThrow();
		expect(() => orientationOf(-1)).toThrow();
	});

	it('24개가 서로 다르다 (위치 + up 조합)', () => {
		expect(new Set(all.map((o) => `${o.position}|${o.up}`)).size).toBe(24);
	});

	it('카메라가 큐브 안에 있지 않다', () => {
		// 큐브의 외접 반지름. 큐비 3칸(간격 1) 이므로 절반이 1.5 다.
		const radius = Math.sqrt(3) * 1.5;
		expect(CAMERA_DISTANCE).toBeGreaterThan(radius);
		for (const o of all) expect(o.position.some((v) => v !== 0)).toBe(true);
	});

	it('24개 전부에서 정확히 3개 면이 보인다 (코너 시점)', () => {
		for (const o of all) {
			const visible = [
				[1, 0, 0],
				[-1, 0, 0],
				[0, 1, 0],
				[0, -1, 0],
				[0, 0, 1],
				[0, 0, -1]
			].filter((n) => n.reduce((s, v, k) => s + v * o.position[k], 0) > 0);
			expect(visible).toHaveLength(3);
		}
	});

	it('up 이 시선과 나란하지 않다 (카메라가 정의된다)', () => {
		for (const o of all) {
			const cross = [
				o.position[1] * o.up[2] - o.position[2] * o.up[1],
				o.position[2] * o.up[0] - o.position[0] * o.up[2],
				o.position[0] * o.up[1] - o.position[1] * o.up[0]
			];
			expect(cross.some((v) => v !== 0)).toBe(true);
		}
	});
});

describe('T1C-3. 색·강조 배열 계약', () => {
	const gray = Array(54).fill('#808080');

	it('54칸이 아니면 명시적으로 실패한다 — 조용히 넘어가지 않는다', () => {
		expect(() => assertFacelets(gray.slice(0, 53))).toThrow(RangeError);
		expect(() => assertFacelets([...gray, '#fff'])).toThrow(RangeError);
		expect(() => assertFacelets(null)).toThrow(RangeError);
		expect(() => assertMarks(Array(53).fill(null))).toThrow(RangeError);
	});

	it('전부 같은 회색 54칸이 유효하다 (FR-TR-22)', () => {
		expect(() => assertFacelets(gray)).not.toThrow();
	});

	it('marks 에 null 과 값이 섞여도 유효하다', () => {
		const marks: (Mark | null)[] = Array(54).fill(null);
		marks[0] = { color: '#f00', outline: 'solid' };
		marks[9] = { color: '#0f0', outline: 'dashed' };
		expect(() => assertMarks(marks)).not.toThrow();
	});

	it('marks 가 20칸 이상 채워져도 유효하다 — 개수 상한이 없다 (FR-TR-16)', () => {
		const marks: (Mark | null)[] = Array.from({ length: 54 }, (_, i) =>
			i < 30 ? { color: '#ff0', outline: 'double' as const } : null
		);
		expect(() => assertMarks(marks)).not.toThrow();
	});

	it('outline 이 없는 강조는 거부된다 — 색만으로 구분하지 못하게 한다 (FR-TR-16)', () => {
		const marks = Array(54).fill(null);
		// @ts-expect-error outline 없는 Mark 는 타입 오류다. 런타임도 함께 막는다.
		const bad: Mark = { color: '#f00' };
		marks[0] = bad;
		expect(() => assertMarks(marks)).toThrow(TypeError);
	});
});
