/**
 * 54칸 facelet 문자열 → 뷰어가 받는 색 배열 (GLOBAL AD-12).
 *
 * 뷰어는 "무슨 색을 어디에" 만 받는다. 어느 면이 무슨 색인지는 데이터셋
 * `meta.colorScheme` 이 정한다 — 면과 색의 짝을 코드가 정하지 않는다.
 *
 * 다만 `colorScheme` 의 값은 `W`·`Y` 같은 **색 이름** 이지 화면에 칠할 값이 아니다.
 * 그 이름을 실제 픽셀로 옮기는 표가 아래 `PAINT` 하나이며, 이것은 데이터의 몫이
 * 아니라 화면의 몫이다 — 같은 "노랑" 도 배경이 어두우면 다르게 칠해야 한다.
 * 그래서 이 파일이 `ui/` 에 있다.
 *
 * 룬을 쓰지 않는다. 순수 함수라 단위 테스트가 그대로 돈다.
 */
import type { Face } from '$lib/domain/types.js';

/**
 * 색 이름 → 칠할 값. 표준 배색(WCA 기준 배열)의 이름들이다.
 *
 * 데이터가 모르는 이름을 들고 오면 회색으로 떨어진다. 던지지 않는 이유는
 * 훈련 화면이 색 하나 때문에 통째로 죽는 것보다, 한 면이 회색으로 보이는 편이
 * 사용자에게 덜 나쁘기 때문이다.
 */
const PAINT: Record<string, string> = {
	W: '#f0f0f0',
	Y: '#f2d02c',
	G: '#0aa04a',
	B: '#2059c0',
	R: '#d02020',
	O: '#f07a1a'
};

/**
 * 시작 전의 회색 (FR-TR-22).
 *
 * 완전한 무채색이다 — 채도가 조금이라도 있으면 "무슨 색인지 맞혀보는" 여지가
 * 생기고, 회색인지 확인하는 검사도 흐려진다.
 */
export const GRAY = '#9a9a9a';

/** 전 면 회색 54칸. 시작 전 큐브는 이 배열만 존재한다 — 색 배열이 곧 정답의 일부다. */
export const grayFacelets = (): string[] => Array.from({ length: 54 }, () => GRAY);

/** `asString()` 의 면 문자 순서. `speffz.ts:5-7` 과 같다. */
const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/**
 * facelet 문자열의 각 칸을 색으로 옮긴다.
 *
 * 문자열의 문자는 **면 이름** 이다(`U` 자리에서 온 스티커). 그 면의 색을
 * `colorScheme` 에서 찾고, 색 이름을 칠할 값으로 옮긴다. 자리는 건드리지 않는다 —
 * 한 칸이라도 자리를 옮기면 그 화면은 틀린 답을 가르친다.
 */
export function faceletColors(colorScheme: Record<Face, string>, facelets: string): string[] {
	if (facelets.length !== 54) throw new RangeError(`facelet 문자열은 54칸이어야 한다: ${facelets.length}`);
	return [...facelets].map((ch) => {
		const face = FACE_ORDER.find((f) => f === ch);
		const name = face ? colorScheme[face] : undefined;
		return (name && PAINT[name]) || GRAY;
	});
}
