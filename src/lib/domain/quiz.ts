/**
 * 퀴즈 출제 선택 — 순수 함수.
 *
 * 0.4.0 까지는 균등 복원추출에 "직전 문제와 같지 않을 것" 하나만 걸려 있었다.
 * 378개나 되니 겹칠 일이 없어 보이지만 생일 문제라 그렇지 않다 — 50문항이면
 * 같은 케이스가 3.24회 다시 나오는 것이 기댓값이고, 한 번도 안 겹칠 확률은 3.9%다.
 * "고루 안 나온다" 는 체감은 정확했다.
 *
 * 그래서 최근 RECENT_LIMIT 개를 제외한다. 무작위성을 버리는 것이 아니라
 * 짧은 구간의 재출현만 막는 것이라, 어느 케이스가 다음에 나올지는 여전히 모른다.
 *
 * memorize.ts 와 같은 규칙을 따른다 — Svelte 를 import 하지 않고, 난수는 인자로
 * 받는다. 난수를 안에서 부르면 테스트가 확률에 기대게 된다.
 */

import type { CaseCode } from './types.js';

/**
 * 제외할 최근 출제 개수.
 *
 * 20 은 pool 이 378 일 때 5.3% 만 잠그는 값이다. 이보다 크게 잡으면 남은 후보가
 * 줄어 "안 나온 것" 을 역으로 추측할 수 있게 되고, 작게 잡으면 애초의 체감이 남는다.
 */
export const RECENT_LIMIT = 20;

/**
 * 다음 문제를 고른다. pool 이 비면 null.
 *
 * pool 이 RECENT_LIMIT 보다 작으면 제외 범위를 pool.length - 1 로 줄인다.
 * "암기한 것만 출제" 로 pool 이 20개 아래로 내려가는 것은 정상적인 사용이고,
 * 그때 20개를 그대로 제외하면 후보가 0이 되어 출제가 멈춘다. 줄여도 최소한
 * 직전 문제는 항상 제외되므로 예전 동작이 하한으로 보장된다.
 *
 * recent 에 pool 밖 코드가 섞여 있어도 안전하다 (필터가 그냥 지나친다).
 * 그래도 후보가 0이면 pool 전체에서 뽑는다 — 출제가 멈추는 것보다 낫다.
 */
export function pickNext(
	pool: readonly CaseCode[],
	recent: readonly CaseCode[],
	rand: () => number = Math.random
): CaseCode | null {
	if (pool.length === 0) return null;
	if (pool.length === 1) return pool[0];

	const keep = Math.min(recent.length, RECENT_LIMIT, pool.length - 1);
	const blocked = new Set(keep > 0 ? recent.slice(recent.length - keep) : []);
	const candidates = pool.filter((c) => !blocked.has(c));
	const from = candidates.length > 0 ? candidates : pool;
	return from[Math.floor(rand() * from.length)];
}

/** 출제 이력에 한 건 밀어 넣는다. 앞쪽 오래된 것부터 버린다. */
export function pushRecent(recent: readonly CaseCode[], code: CaseCode): CaseCode[] {
	return [...recent, code].slice(-RECENT_LIMIT);
}
