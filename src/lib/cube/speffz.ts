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
import type { Cubie, Sticker } from '../domain/types.js';

/** 면 순서. 인덱스 → 면 이름 계산에 쓴다. */
const FACE_ORDER = 'URFDLB';
export const faceOfIndex = (i: number) => FACE_ORDER[Math.floor(i / 9)];

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
