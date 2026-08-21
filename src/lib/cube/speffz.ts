/**
 * Speffz 문자 ↔ 큐브 위치 좌표.
 *
 * 좌표계는 cubejs 의 `asString()` 이 내놓는 54칸 배열의 인덱스다.
 * 면 순서는 `URFDLB`, 각 면은 좌상 → 우하로 읽는다.
 *
 *   U:0-8  R:9-17  F:18-26  D:27-35  L:36-44  B:45-53
 *
 * 여기 있는 것은 **문자 배정 관례**뿐이고 큐브의 물리(무브가 무엇을 어디로
 * 보내는가)는 한 줄도 없다. 물리는 전부 cubejs 가 안다 — 우리가 무브 테이블을
 * 들고 있다가 `L` 이 뒤집힌 채 0.3.0 까지 나간 적이 있다.
 *
 * 이 좌표가 맞는지는 `tests/unit/speffz.test.ts` 가 데이터의
 * `target1/target2` ({sticker, cubie, face} 삼중항 756개)와 대조해 확인한다.
 */
import Cube from 'cubejs/lib/cube.js';
import type { Cubie, Sticker } from '../domain/types.js';

/** 면 순서. 인덱스 → 면 이름 계산에 쓴다. */
const FACE_ORDER = 'URFDLB';
export const faceOfIndex = (i: number) => FACE_ORDER[Math.floor(i / 9)];
/** 면 중앙 칸. 중앙은 안 움직이므로 그 면의 색이 곧 중앙의 문자다. */
const centerIndex = (face: string) => FACE_ORDER.indexOf(face) * 9 + 4;

/**
 * 풀린 상태의 facelet 문자열. 색 이름을 코드에 박지 않기 위한 기준이다 —
 * "이 칸이 무슨 색인가" 를 물어볼 곳이 필요할 때만 쓴다 (`primaryAxisSticker`).
 */
const SOLVED_FACELETS = new Cube().asString();
/** U/D 축 색. 코너 비틀림 표기의 기준이다 (AD-8). */
const AXIS_COLORS = new Set([
	SOLVED_FACELETS[centerIndex('U')],
	SOLVED_FACELETS[centerIndex('D')]
]);

/** Speffz 문자 → facelet 인덱스. 면마다 좌상에서 시계방향으로 A B C D 순. */
export const CORNER_INDEX: Record<Sticker, number> = {
	A: 0, B: 2, C: 8, D: 6,        // U
	E: 36, F: 38, G: 44, H: 42,    // L
	I: 18, J: 20, K: 26, L: 24,    // F
	M: 9, N: 11, O: 17, P: 15,     // R
	Q: 45, R: 47, S: 53, T: 51,    // B
	U: 27, V: 29, W: 35, X: 33     // D
};
export const EDGE_INDEX: Record<Sticker, number> = {
	a: 1, b: 5, c: 7, d: 3,        // U
	e: 37, f: 41, g: 43, h: 39,    // L
	i: 19, j: 23, k: 25, l: 21,    // F
	m: 10, n: 14, o: 16, p: 12,    // R
	q: 46, r: 50, s: 52, t: 48,    // B
	u: 28, v: 32, w: 34, x: 30     // D
};

/** 큐비 → 그 큐비를 이루는 facelet 인덱스들. 색 조합으로 조각을 식별할 때 쓴다. */
export const CORNER_FACELETS: Record<Cubie, number[]> = {
	UBL: [0, 36, 47], UBR: [2, 45, 11], UFR: [8, 9, 20], UFL: [6, 38, 18],
	DFL: [27, 44, 24], DFR: [29, 26, 15], DBR: [35, 17, 51], DBL: [33, 42, 53]
};
export const EDGE_FACELETS: Record<Cubie, number[]> = {
	UB: [1, 46], UR: [5, 10], UF: [7, 19], UL: [3, 37],
	FR: [23, 12], FL: [21, 41], BR: [48, 14], BL: [50, 39],
	DF: [28, 25], DR: [32, 16], DB: [34, 52], DL: [30, 43]
};

export const CORNER_LETTERS = Object.keys(CORNER_INDEX);
export const EDGE_LETTERS = Object.keys(EDGE_INDEX);

const invert = (m: Record<string, number>): Record<number, Sticker> =>
	Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
export const CORNER_AT = invert(CORNER_INDEX);
export const EDGE_AT = invert(EDGE_INDEX);

/** 문자 → 큐비. 좌표에서 파생시킨다 — 따로 적어두면 어긋날 수 있다. */
function letterToCubie(
	index: Record<Sticker, number>,
	facelets: Record<Cubie, number[]>
): Record<Sticker, Cubie> {
	return Object.fromEntries(
		Object.entries(index).map(([letter, i]) => [
			letter,
			Object.keys(facelets).find((cubie) => facelets[cubie].includes(i))!
		])
	);
}
export const CORNER_CUBIE = letterToCubie(CORNER_INDEX, CORNER_FACELETS);
export const EDGE_CUBIE = letterToCubie(EDGE_INDEX, EDGE_FACELETS);

/** 조각 종류. 좌표와 함께 쓰이므로 여기서 정의하고 `sim.ts` 가 다시 내보낸다. */
export type PieceKind = 'corner' | 'edge';

/**
 * 코너 스티커의 **회전 방향 순서** — 큐비 바깥에서 볼 때 시계방향으로 통일했다.
 *
 * `CORNER_FACELETS` 를 두고 왜 하나 더 두는가:
 * 조각 식별(`sim.ts` 의 `colorKey`)은 세 문자를 정렬해 쓰므로 나열 순서가
 * 무의미하다. 그래서 `CORNER_FACELETS` 는 `UFL`(U,L,F)과 `DBL`(D,L,B) 둘만
 * 나머지 6개와 반대 방향인 채로 데이터의 삼중항 756개와 대조를 통과해 왔다.
 * 반면 트레이싱은 방향을 **인덱스 차이** 로 읽는다 — 버퍼 조각의 i번째 스티커를
 * 타깃 큐비의 (j+i)번째 자리에 얹는 것이 타깃 하나의 정의다. 여기서 한 큐비만
 * 방향이 뒤집혀 있어도 그 큐비가 걸린 메모가 전부 어긋난다. 프로토타입의 초기
 * 라운드트립 0/260 이 정확히 이 원인이었다.
 *
 * `CORNER_FACELETS` 는 고치지 않는다. 756개와 대조된 좌표를 방향 때문에 흔들
 * 이유가 없고, 순서가 필요한 쪽만 이 상수를 보면 된다.
 *
 * **이 순서가 맞다고 우리가 주장하지 않는다.** `tests/unit/speffz.test.ts` 가
 * cubejs 의 면 4분회전 6개로 확인한다 — U·D 회전은 인덱스를 그대로 보존하고,
 * R·L·F·B 회전은 인덱스를 순환 이동시킨다(그 이동량이 곧 코너 비틀림이다).
 * 한 큐비라도 방향이 반대면 순환이 아니라 뒤집힘으로 나와 테스트가 잡는다.
 * `sim.ts:4-13` 과 같은 규율이다 — 물리는 cubejs 가 알고 우리는 대조만 한다.
 */
export const CORNER_ROTATION: Record<Cubie, Sticker[]> = {
	UBL: ['A', 'E', 'R'], // U L B
	UBR: ['B', 'Q', 'N'], // U B R
	UFR: ['C', 'M', 'J'], // U R F
	UFL: ['D', 'I', 'F'], // U F L   ← CORNER_FACELETS 는 U L F 순
	DFL: ['U', 'G', 'L'], // D L F
	DFR: ['V', 'K', 'P'], // D F R
	DBR: ['W', 'O', 'T'], // D R B
	DBL: ['X', 'S', 'H'] // D B L   ← CORNER_FACELETS 는 D L B 순
};

/**
 * 엣지의 순서는 `EDGE_FACELETS` 에서 그대로 파생한다. 스티커가 2개면 방향이
 * 하나뿐이라 시계방향을 따질 것이 없다 — 뒤집으면 그냥 반대쪽 스티커다.
 */
export const EDGE_ROTATION: Record<Cubie, Sticker[]> = Object.fromEntries(
	Object.entries(EDGE_FACELETS).map(([cubie, ix]) => [cubie, ix.map((i) => EDGE_AT[i])])
);

/** 조각 종류별 회전 순서. 코너 3칸·엣지 2칸. */
export const rotationOf = (kind: PieceKind): Record<Cubie, Sticker[]> =>
	kind === 'corner' ? CORNER_ROTATION : EDGE_ROTATION;

/** 조각 종류별 문자 → 큐비. */
export const cubieOf = (kind: PieceKind): Record<Sticker, Cubie> =>
	kind === 'corner' ? CORNER_CUBIE : EDGE_CUBIE;

/** 조각 종류별 문자 목록 (Speffz 순). */
export const lettersOf = (kind: PieceKind): Sticker[] =>
	kind === 'corner' ? CORNER_LETTERS : EDGE_LETTERS;

/**
 * 그 큐비에서 U/D 축 색 스티커의 **원래** 자리.
 *
 * 색 이름을 코드에 박지 않는다 — 풀린 facelet 문자열에서 U 면·D 면 중앙과 같은
 * 문자를 가진 칸을 찾는다. 색 값이 바뀌어도(데이터의 `meta.colorScheme`) 여기는
 * 안 바뀐다. 코너는 정확히 하나가 걸리므로 비틀림 표기(FR-TR-25)의 기준이 된다.
 *
 * 엣지에는 쓰지 않는다 — 적도층 엣지는 U/D 색이 아예 없어 0개가 걸린다.
 * 엣지 뒤집힘은 상태가 하나뿐이라 큐비를 지목하면 끝이라 필요도 없다.
 */
export function primaryAxisSticker(kind: PieceKind, cubie: Cubie): Sticker {
	const index = kind === 'corner' ? CORNER_INDEX : EDGE_INDEX;
	const hit = rotationOf(kind)[cubie].filter((s) => AXIS_COLORS.has(SOLVED_FACELETS[index[s]]));
	if (hit.length !== 1) throw new Error(`${cubie}: U/D 축 스티커가 ${hit.length}개다`);
	return hit[0];
}
