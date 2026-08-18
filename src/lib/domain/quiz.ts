/**
 * 퀴즈 출제 선택 — 순수 함수.
 *
 * 0.4.0 까지는 균등 복원추출에 "직전 문제와 같지 않을 것" 하나만 걸려 있었다.
 * 378개나 되니 겹칠 일이 없어 보이지만 생일 문제라 그렇지 않다 — 50문항이면
 * 같은 케이스가 3.24회 다시 나오는 것이 기댓값이고, 한 번도 안 겹칠 확률은 3.9%다.
 * "고루 안 나온다" 는 체감은 정확했다. 0.4.1 이 최근 RECENT_LIMIT 개를 제외했다.
 *
 * 0.4.2 는 역케이스도 같이 제외한다. 역쌍 XY/YX 는 답이 서로의 뒤집기라
 * (inverseTrick.setup 이 378/378 true), 가까이 나오면 같은 답을 연달아 쓰게 된다.
 * 코드가 달라 "겹치지 않았다" 고 판정되던 것이 실제로는 겹친 것이었다.
 *
 * 무작위성을 버리는 것이 아니라 짧은 구간의 재출현만 막는다. 어느 케이스가 다음에
 * 나올지는 여전히 모른다.
 *
 * memorize.ts 와 같은 규칙을 따른다 — Svelte 를 import 하지 않고, 난수는 인자로
 * 받는다. 난수를 안에서 부르면 테스트가 확률에 기대게 된다.
 */

import type { CaseCode } from './types.js';

/**
 * 제외할 최근 출제 개수. 역케이스까지 함께 잠그므로 실제로 막히는 것은 최대 2배다.
 *
 * 20 은 pool 이 378 일 때 역쌍을 합쳐도 10.6% 만 잠그는 값이다. 이보다 크게 잡으면
 * 남은 후보가 줄어 "안 나온 것" 을 역으로 추측할 수 있게 되고, 작게 잡으면 애초의
 * 체감이 남는다.
 */
export const RECENT_LIMIT = 20;

/** 케이스 코드로 역케이스를 찾는 함수. 없으면 undefined. */
export type InverseOf = (code: CaseCode) => CaseCode | undefined;

/** 역케이스를 안 막던 시절의 동작. 인자를 안 넘기면 이것이 쓰인다. */
const NO_INVERSE: InverseOf = () => undefined;

function pickFrom(candidates: readonly CaseCode[], rand: () => number): CaseCode {
	return candidates[Math.floor(rand() * candidates.length)];
}

/**
 * 다음 문제를 고른다. pool 이 비면 null.
 *
 * 제외는 세 단계로 물러선다. pool 이 작아지면(= "암기한 것만 출제") 제외를 그대로
 * 걸었다가는 후보가 0이 되어 출제가 멈추기 때문이다.
 *
 *   1. 최근 k 개와 그 역케이스를 막는다. k 를 RECENT_LIMIT 부터 1까지 줄여가며
 *      후보가 남는 첫 지점을 쓴다.
 *   2. 그래도 없으면 역케이스 제외를 포기하고 직전 문제만 막는다 (0.4.1 의 하한).
 *   3. 그래도 없으면 pool 전체에서 뽑는다. pool 이 하나뿐이거나, 그 하나와 역쌍인
 *      둘뿐인 경우다 — 어느 쪽도 만족시킬 수 없다.
 *
 * recent 에 pool 밖 코드가 섞여 있어도 안전하다 (필터가 그냥 지나친다).
 */
export function pickNext(
	pool: readonly CaseCode[],
	recent: readonly CaseCode[],
	inverseOf: InverseOf = NO_INVERSE,
	rand: () => number = Math.random
): CaseCode | null {
	if (pool.length === 0) return null;
	if (pool.length === 1) return pool[0];

	// 1. 역케이스까지 막으면서 창을 좁힌다
	for (let k = Math.min(recent.length, RECENT_LIMIT); k >= 1; k--) {
		const blocked = new Set<CaseCode>();
		for (const code of recent.slice(recent.length - k)) {
			blocked.add(code);
			const inv = inverseOf(code);
			if (inv !== undefined) blocked.add(inv);
		}
		const candidates = pool.filter((c) => !blocked.has(c));
		if (candidates.length > 0) return pickFrom(candidates, rand);
	}

	// 2. 역케이스 제외를 포기한다. 직전 문제만은 끝까지 막는다.
	const last = recent[recent.length - 1];
	if (last !== undefined) {
		const candidates = pool.filter((c) => c !== last);
		if (candidates.length > 0) return pickFrom(candidates, rand);
	}

	// 3. 막을 수 있는 것이 없다
	return pickFrom(pool, rand);
}

/** 출제 이력에 한 건 밀어 넣는다. 앞쪽 오래된 것부터 버린다. */
export function pushRecent(recent: readonly CaseCode[], code: CaseCode): CaseCode[] {
	return [...recent, code].slice(-RECENT_LIMIT);
}
