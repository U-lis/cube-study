/**
 * 퀴즈 채점.
 *
 * 데이터의 알고리즘 문자열과 비교하지 않는다. 같은 3-cycle 을 만드는 알고리즘은
 * 여러 개 존재하므로(HANDOFF.md:238), 문자열 비교는 올바른 풀이를 오답 처리한다.
 * identifyCase() 로 실제 효과를 판정하므로 데이터에 없는 변형도 정답이 된다.
 */

import type { CubeSim } from '../cube/sim.js';
import type { CaseCode, CaseEntry, Cubie, Dataset } from './types.js';

export type Verdict =
	| { kind: 'correct' }
	| { kind: 'edge-dirty'; cubies: Cubie[] }
	| { kind: 'twist' }
	| { kind: 'identity' }
	| { kind: 'wrong'; identified: CaseCode | null }
	| { kind: 'invalid-move'; token: string };

/** 케이스가 순환시키는 코너 큐비 3개 (버퍼 + 두 타깃). */
export function targetCubies(ds: Dataset, entry: CaseEntry): Cubie[] {
	return [ds.meta.buffer, entry.target1.cubie, entry.target2.cubie];
}

export function grade(sim: CubeSim, ds: Dataset, entry: CaseEntry, alg: string): Verdict {
	let cornerState;
	let edgeState;
	try {
		cornerState = sim.applyToCorners(sim.solvedCorners(), alg);
		edgeState = sim.applyToEdges(sim.solvedEdges(), alg);
	} catch (e) {
		const m = /Unknown move: (\S+)/.exec((e as Error).message);
		return { kind: 'invalid-move', token: m ? m[1] : '?' };
	}

	const cornersUntouched = sim.isSolved(cornerState);
	const edgesUntouched = sim.isSolved(edgeState);

	// 큐브가 전혀 바뀌지 않았다 (빈 입력, R R' 등)
	if (cornersUntouched && edgesUntouched) return { kind: 'identity' };

	const identified = sim.identifyCase(alg);

	if (identified === entry.case) {
		if (edgesUntouched) return { kind: 'correct' };
		return { kind: 'edge-dirty', cubies: sim.affectedCubies(edgeState, 'edge') };
	}

	// 코너 3큐비는 맞는데 방향이 어긋난 경우.
	// identifyCase 가 null 이면서 영향받은 코너 큐비 집합이 정답과 같은 상황이다.
	if (identified === null && edgesUntouched) {
		const got = sim.affectedCubies(cornerState, 'corner');
		const want = targetCubies(ds, entry);
		if (got.length === 3 && got.every((c) => want.includes(c))) return { kind: 'twist' };
	}

	return { kind: 'wrong', identified };
}

/** 판정 결과 문구. 사실만 적는다 (NFR-9). */
export function verdictText(v: Verdict): string {
	switch (v.kind) {
		case 'correct':
			return '정답';
		case 'edge-dirty':
			return `코너는 맞지만 엣지를 건드립니다: ${v.cubies.join(' ')}`;
		case 'twist':
			return '조각 위치는 맞지만 방향이 다릅니다';
		case 'identity':
			return '큐브가 바뀌지 않았습니다';
		case 'wrong':
			return v.identified ? `${v.identified} 케이스를 푸는 공식입니다` : '3-cycle이 아닙니다';
		case 'invalid-move':
			return `알 수 없는 무브: ${v.token}`;
	}
}
