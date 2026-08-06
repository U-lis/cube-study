/**
 * 큐브 표기 유틸. 시뮬레이터 없이도 쓸 수 있다.
 *
 * 원본: .dc_workspace/handoff/sim/cube-sim.js — 로직을 그대로 옮겼다.
 */

const AMOUNT: Record<string, number> = { '': 1, "'": 3, '2': 2 };
const SUFFIX: Record<number, string> = { 1: '', 2: '2', 3: "'" };

function tokens(alg: string): string[] {
	const t = alg.trim();
	return t ? t.split(/\s+/) : [];
}

/**
 * 알고리즘 뒤집기 = 순서 거꾸로 + 각 무브 토글.
 * 둘 다 해야 한다. `2` 가 붙은 무브는 토글해도 그대로다.
 *
 *   invertAlg("R U R' U'") === "U R U' R'"
 *   invertAlg("B' D2 B")   === "B' D2 B"   ← self-inverse (버그가 아니다)
 */
export function invertAlg(alg: string): string {
	return tokens(alg)
		.reverse()
		.map((t) => {
			if (t.endsWith("'")) return t.slice(0, -1);
			if (t.endsWith('2')) return t;
			return t + "'";
		})
		.join(' ');
}

/** 인접한 같은 면 무브를 mod 4 로 합산한다. "R R' U" → "U", "F' F' U" → "F2 U" */
export function cancelMoves(alg: string): string {
	let toks = tokens(alg);
	let changed = true;
	while (changed) {
		changed = false;
		const out: string[] = [];
		for (let i = 0; i < toks.length; i++) {
			const cur = toks[i];
			const next = toks[i + 1];
			if (next !== undefined && cur[0] === next[0]) {
				const n = (AMOUNT[cur.slice(1)] + AMOUNT[next.slice(1)]) % 4;
				if (n !== 0) out.push(cur[0] + SUFFIX[n]);
				i++;
				changed = true;
			} else {
				out.push(cur);
			}
		}
		toks = out;
	}
	return toks.join(' ');
}

export function moveCount(alg: string): number {
	return tokens(alg).length;
}

export { tokens as splitMoves };
