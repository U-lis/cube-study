/**
 * `cubejs` 는 타입 선언을 내놓지 않는다. 우리가 쓰는 만큼만 적는다.
 *
 * `cubejs/lib/cube.js` 를 직접 가리키는 이유는 패키지 진입점이 Kociemba 풀이기
 * (`lib/solve.js`, 32KB)까지 끌고 오기 때문이다. 우리는 상태 적용만 쓴다.
 */
declare module 'cubejs/lib/cube.js' {
	export default class Cube {
		constructor(other?: Cube);
		/** 공백으로 구분된 무브. 면·슬라이스·회전·wide 를 받는다. 미지 토큰은 throw. */
		move(alg: string): Cube;
		/** 54칸 facelet 문자열. 면 순서 URFDLB, 각 면은 좌상 → 우하. */
		asString(): string;
	}
}
declare module 'cubejs' {
	export { default } from 'cubejs/lib/cube.js';
}
