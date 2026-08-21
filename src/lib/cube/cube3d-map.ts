/**
 * 3D 뷰어의 **순수부** — 54칸 좌표 매핑, 24방향 카메라, 인자 검증.
 *
 * `three` 를 import 하지 않는다. 이 파일이 `three` 를 끌어오면 지연 로드 검사가
 * 흐려지고(NFR-TR-2) 단위 테스트가 WebGL 없는 node 환경에서 못 돈다.
 * 그래서 PHASE_1C_PLAN 이 `cube3d.ts` 안에 두라고 적은 `faceletToCubie` 를
 * 여기로 갈랐다 — `cube3d.ts` 는 이 파일을 import 해 쓴다.
 *
 * ## 좌표 규약
 *
 * **facelet 인덱스**는 `speffz.ts:5-7` 과 같다. 면 순서 `URFDLB`, 각 면은
 * 좌상 → 우하. U:0-8 R:9-17 F:18-26 D:27-35 L:36-44 B:45-53.
 *
 * **큐비 좌표** `[x, y, z]` 는 각 축이 -1 / 0 / +1 이다.
 *
 *   +X = R   -X = L   +Y = U   -Y = D   +Z = F   -Z = B
 *
 * **material 인덱스**는 `three` 의 `BoxGeometry` 규약이다.
 *
 *   0:+X  1:-X  2:+Y  3:-Y  4:+Z  5:-Z
 *
 * 순서를 틀리면 색이 옆면으로 가는데 큐브는 대칭이라 눈으로 잘 안 잡힌다.
 * 그래서 매핑을 순수 함수로 빼서 54칸 전수로 확인한다(`tests/unit/cube3d.test.ts`).
 *
 * 이 파일은 트레이싱을 모른다 — "무슨 색을 어디에" 만 다룬다 (GLOBAL AD-12).
 */

/** material 인덱스. `three` 의 `BoxGeometry` 면 순서. */
export type FaceIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** 큐비 좌표. 각 축 -1 / 0 / +1. */
export type CubieCoord = [number, number, number];

export interface FaceletSlot {
	cubie: CubieCoord;
	face: FaceIndex;
}

/** 스티커 강조. 색과 **테두리** 를 함께 갖는다 — 색만으로 구분하지 않는다 (FR-TR-16). */
export interface Mark {
	color: string;
	outline: 'solid' | 'dashed' | 'double';
}

/** 면 순서 `URFDLB` 의 material 인덱스. U=+Y, R=+X, F=+Z, D=-Y, L=-X, B=-Z. */
const FACE_MATERIAL: FaceIndex[] = [2, 0, 4, 3, 1, 5];

/**
 * 한 면 안의 (행, 열) → 큐비 좌표.
 *
 * 각 면을 **그 면의 바깥에서 정면으로 볼 때** 좌상에서 우하로 읽는 관례를 그대로
 * 좌표로 옮긴 것이다. 예를 들어 U 면은 위에서 내려다보므로 행이 뒤(-Z)에서 앞(+Z)으로,
 * 열이 왼쪽(-X)에서 오른쪽(+X)으로 간다.
 *
 * 이 표가 맞는지는 우리가 주장하지 않는다 — `speffz.ts` 의 `CORNER_FACELETS` /
 * `EDGE_FACELETS` 가 지목하는 인덱스들이 같은 큐비로 모이는지로 확인한다
 * (T1C-1 #8). 그쪽 좌표는 데이터의 삼중항 756개와 이미 대조돼 있다.
 */
const PLACE: ((row: number, col: number) => CubieCoord)[] = [
	(r, c) => [c - 1, 1, r - 1], // U — 행: 뒤→앞, 열: 왼→오른
	(r, c) => [1, 1 - r, 1 - c], // R — 행: 위→아래, 열: 앞→뒤
	(r, c) => [c - 1, 1 - r, 1], // F — 행: 위→아래, 열: 왼→오른
	(r, c) => [c - 1, -1, 1 - r], // D — 행: 앞→뒤, 열: 왼→오른
	(r, c) => [-1, 1 - r, c - 1], // L — 행: 위→아래, 열: 뒤→앞
	(r, c) => [1 - c, 1 - r, -1] // B — 행: 위→아래, 열: 오른→왼
];

/** facelet 인덱스 → 그 칸이 앉은 큐비와 material 인덱스. */
export function faceletToCubie(i: number): FaceletSlot {
	if (!Number.isInteger(i) || i < 0 || i > 53) throw new RangeError(`facelet 인덱스가 아니다: ${i}`);
	const face = Math.floor(i / 9);
	const cell = i % 9;
	return { cubie: PLACE[face](Math.floor(cell / 3), cell % 3), face: FACE_MATERIAL[face] };
}

/** 큐비 좌표 → 키. 26개 큐비를 Map 에 담을 때 쓴다. */
export const cubieKey = ([x, y, z]: CubieCoord): string => `${x},${y},${z}`;

/** 중앙(0,0,0)을 뺀 26개 큐비 좌표. 안 보이는 중앙은 그리지 않는다 — 드로우콜 낭비다. */
export function cubieCoords(): CubieCoord[] {
	const out: CubieCoord[] = [];
	for (let x = -1; x <= 1; x++)
		for (let y = -1; y <= 1; y++)
			for (let z = -1; z <= 1; z++) if (x || y || z) out.push([x, y, z]);
	return out;
}

/** 카메라 배치. 위치와 up 벡터만 정한다 — 거리·화각은 뷰어가 정한다. */
export interface Orientation {
	position: CubieCoord;
	up: CubieCoord;
}

/** 24방향의 개수. */
export const ORIENTATION_COUNT = 24;

/**
 * 초기 카메라 각도 24방향 (FR-TR-17).
 *
 * 스크램블에 방향 회전을 섞는 대신 카메라를 돌린다. 큐브의 회전 대칭이 24개이므로
 * 코너 8개 × up 축 3개 = 24 가 정확히 그 개수다. 코너에서 보면 세 면이 동시에
 * 보이는데, 이것은 뒷면을 새게 하는 것이 아니다 — 실물을 손에 들었을 때와 같다
 * (FR-TR-15 가 막는 것은 회전 없이 **뒷면** 이 보이는 것이다).
 */
export function orientationOf(index: number): Orientation {
	if (!Number.isInteger(index) || index < 0 || index >= ORIENTATION_COUNT)
		throw new RangeError(`0..23 이 아니다: ${index}`);
	const corner = Math.floor(index / 3);
	const sx = corner & 1 ? -1 : 1;
	const sy = corner & 2 ? -1 : 1;
	const sz = corner & 4 ? -1 : 1;
	const up: CubieCoord = [[0, sy, 0], [sx, 0, 0], [0, 0, sz]][index % 3] as CubieCoord;
	return { position: [sx, sy, sz], up };
}

/**
 * 카메라 거리. 큐브 반지름(√3 × 1.5 ≈ 2.6)보다 밖이면서, 화각 40° 에서 큐브가
 * 잘리지 않는 거리다 — tan(20°) × 9 ≈ 3.28 > 2.6.
 */
export const CAMERA_DISTANCE = 9;

/**
 * 54칸 배열인지 확인한다. **조용히 넘어가지 않는다** — 한 칸이 어긋난 색은
 * 그림으로는 잘 안 잡히고, 트레이싱 훈련에서는 그게 곧 오답이다.
 */
export function assertFacelets(colors: unknown): asserts colors is string[] {
	if (!Array.isArray(colors) || colors.length !== 54)
		throw new RangeError(`색은 54칸이어야 한다: ${Array.isArray(colors) ? colors.length : typeof colors}`);
	for (let i = 0; i < 54; i++)
		if (typeof colors[i] !== 'string' || colors[i] === '')
			throw new TypeError(`${i}번 칸의 색이 문자열이 아니다`);
}

/**
 * 54칸 강조 배열인지 확인한다. `null` 은 "강조 없음" 이라 유효하고,
 * 채워진 칸 수에는 **상한이 없다** — 지나간 조각은 계속 늘어난다 (FR-TR-16).
 */
export function assertMarks(marks: unknown): asserts marks is (Mark | null)[] {
	if (!Array.isArray(marks) || marks.length !== 54)
		throw new RangeError(`강조는 54칸이어야 한다: ${Array.isArray(marks) ? marks.length : typeof marks}`);
	for (let i = 0; i < 54; i++) {
		const m = marks[i];
		if (m === null || m === undefined) continue;
		if (typeof m !== 'object' || typeof (m as Mark).color !== 'string')
			throw new TypeError(`${i}번 칸의 강조에 색이 없다`);
		if (!['solid', 'dashed', 'double'].includes((m as Mark).outline))
			throw new TypeError(`${i}번 칸의 강조에 테두리 종류가 없다 — 색만으로 구분하지 않는다`);
	}
}
