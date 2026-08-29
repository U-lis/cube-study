/**
 * `cubejs` 는 타입 선언을 내놓지 않는다. 우리가 쓰는 만큼만 적는다.
 *
 * 진입점(`cubejs`)과 `cubejs/lib/cube.js` 를 나눠 선언한다. 앱 코드는 상태 적용만 쓰므로
 * `cube.js` 를 직접 가리키고, 풀이기가 필요한 곳은 `scramble.worker.ts` 하나다.
 *
 * **번들 크기 때문이 아니다** — `solve.js` 는 gzip 7.1KB 라 청크에 섞여도 문제가 없다.
 * 나누는 이유는 `Cube.initSolver()` 가 실측 1695ms / heap +37MB / RSS +102MB 라는 것 하나다.
 * 그래서 그 호출은 Worker 안에서만 하고, 화면을 벗어나면 `terminate()` 로 반납한다
 * (SPEC NFR-TR-1, GLOBAL AD-9). 근거를 "번들이 커진다" 로 적어두면 다음 사람이 청크를
 * 손으로 자르는 쪽으로 끌려간다.
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
	/** 진입점. `lib/cube.js` 에 Kociemba 풀이기(`lib/solve.js`)가 얹힌 같은 클래스다. */
	export default class Cube {
		constructor(other?: Cube);
		move(alg: string): Cube;
		asString(): string;
		/** 풀이 알고리즘. 이 결과를 뒤집은 것이 스크램블이다 (FR-TR-1). 실패 시 throw. */
		solve(maxDepth?: number): string;
		/** 균등 분포 랜덤 스테이트. */
		static random(): Cube;
		/** 실측 1695ms / RSS +102MB. **Worker 안에서만 부른다** (NFR-TR-1). */
		static initSolver(): void;
	}
}
