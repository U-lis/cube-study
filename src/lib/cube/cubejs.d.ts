/**
 * `cubejs` 는 타입 선언을 내놓지 않는다. 교차 검증 테스트가 쓰는 만큼만 적는다.
 * 앱 번들은 이 패키지를 쓰지 않는다 (devDependency).
 */
declare module 'cubejs' {
	export default class Cube {
		constructor(other?: Cube);
		move(alg: string): Cube;
		asString(): string;
	}
}
