/**
 * OP 코너 도메인 유닛 테스트 (SPEC §3 "검증").
 *
 * 데이터 공식의 효과를 54칸 facelet 문자열로 직접 확인한다. 센터까지 보는 이유는
 * `[Y]` 가 엣지 UB↔UL 부수효과를 내고(패리티 자리), setup 이 D·F·R 로만 되어 있다는
 * 제약을 코드가 놓치지 않게 하기 위함이다 — GLOBAL AD-1, SPEC FR-OP-D-1, FR-OP-D-4.
 *
 * 데이터 JSON 은 손대지 않는다 (CLAUDE.md). 테스트가 틀렸다는 결론이 나오면
 * 테스트를 고친다. 테스트 안에서 Y-perm 15수를 다시 적지 않는다 — 데이터의
 * `meta.yPerm` 을 쓴다.
 */
import { describe, it, expect } from 'vitest';
import {
	itemsOf,
	gradeOp,
	expandY,
	displayPartsOf,
	opVerdictText,
	parseOpChecked,
	serializeOpChecked,
	type OpDataSet,
	type OpItem
} from '../../src/lib/domain/op.js';
import { faceletsOf, stateFromFacelets } from '../../src/lib/cube/sim.js';
import {
	CORNER_FACELETS,
	CORNER_CUBIE,
	EDGE_FACELETS,
	EDGE_INDEX
} from '../../src/lib/cube/speffz.js';
import { splitMoves } from '../../src/lib/cube/notation.js';
import dataJson from '../../src/lib/data/corner-UBL-op.json';

const ds = dataJson as unknown as OpDataSet;
const items: OpItem[] = itemsOf(ds);
const SOLVED = faceletsOf('');

/** Y-perm 단독으로 돌린 facelet (기준상태). D-2, D-3 에서 참조한다. */
const Y_ONLY = faceletsOf(ds.meta.yPerm);

/** 센터 6칸의 색. */
const centerString = (f: string) => [4, 13, 22, 31, 40, 49].map((i) => f[i]).join('');

/** 코너 조각 전체의 facelet 들 (중복 없이). 엣지 무영향 검사에 쓴다. */
const CORNER_FACELET_SET: number[] = [...new Set(Object.values(CORNER_FACELETS).flat())];
/** 엣지 조각 전체의 facelet 들 (중복 없이). */
const EDGE_FACELET_SET: number[] = [...new Set(Object.values(EDGE_FACELETS).flat())];

describe('D-1. itemsOf 개수', () => {
	it('22 개 — Y + 21 타깃', () => {
		expect(items).toHaveLength(22);
	});

	it('첫 행은 Y (isYRow)', () => {
		expect(items[0].id).toBe('y');
		expect(items[0].letter).toBe('Y');
		expect(items[0].isYRow).toBe(true);
	});

	it('데이터 순서 그대로', () => {
		for (let k = 0; k < ds.rows.length; k++) {
			expect(items[k].id).toBe(ds.rows[k].id);
		}
	});

	it('P 행은 isYRow 아님, setup 빈 문자열, alg 는 yPerm', () => {
		const p = items.find((it) => it.id === 'p')!;
		expect(p.isYRow).toBe(false);
		expect(p.setup).toBe('');
		expect(p.alg).toBe(ds.meta.yPerm);
	});

	it('Y 행 alg 는 yPerm 그대로', () => {
		expect(items[0].alg).toBe(ds.meta.yPerm);
	});

	it('piece 는 UBL↔{타깃 코너}', () => {
		// Y·P: UBL↔DFR (meta.swapPiece)
		expect(items[0].piece).toBe('UBL↔DFR');
		expect(items.find((it) => it.id === 'p')!.piece).toBe('UBL↔DFR');
		// B → UBR, C → UFR, X → DBL (CORNER_CUBIE 에서 파생)
		expect(items.find((it) => it.id === 'b')!.piece).toBe(`UBL↔${CORNER_CUBIE.B}`);
		expect(items.find((it) => it.id === 'c')!.piece).toBe(`UBL↔${CORNER_CUBIE.C}`);
	});
});

describe('D-2. Y 행 공식: 코너 UBL↔DFR + 엣지 UB↔UL (facelet 37·46) 교환만', () => {
	it('UBL 과 DFR 두 코너만 바뀐다 — 다른 6 코너는 제자리 색', () => {
		const movedCornerCubies = new Set<string>();
		for (const i of CORNER_FACELET_SET) {
			if (Y_ONLY[i] !== SOLVED[i]) {
				// 그 facelet 이 속한 큐비를 찾는다.
				for (const [cubie, idxs] of Object.entries(CORNER_FACELETS)) {
					if (idxs.includes(i)) {
						movedCornerCubies.add(cubie);
						break;
					}
				}
			}
		}
		expect(movedCornerCubies).toEqual(new Set(['UBL', 'DFR']));
	});

	it('엣지는 UB·UL 두 큐비만 바뀐다', () => {
		const movedEdgeCubies = new Set<string>();
		for (const i of EDGE_FACELET_SET) {
			if (Y_ONLY[i] !== SOLVED[i]) {
				for (const [cubie, idxs] of Object.entries(EDGE_FACELETS)) {
					if (idxs.includes(i)) {
						movedEdgeCubies.add(cubie);
						break;
					}
				}
			}
		}
		expect(movedEdgeCubies).toEqual(new Set(['UB', 'UL']));
	});

	it('구체적 facelet 37·46 교환', () => {
		// facelet 37 = UL 의 L 면 스티커 (e), 46 = UB 의 B 면 스티커 (q).
		expect(Y_ONLY[37]).toBe(SOLVED[46]);
		expect(Y_ONLY[46]).toBe(SOLVED[37]);
	});

	it('센터는 Y 로 바뀌지 않는다', () => {
		expect(centerString(Y_ONLY)).toBe(centerString(SOLVED));
	});
});

describe('D-3. 21 타깃 행 전수: setup [Y] setup\' 가 UBL↔타깃 코너 교환만', () => {
	const Y_PERM = ds.meta.yPerm;
	for (const row of ds.rows) {
		if (row.isYRow) continue;
		it(`${row.id} (${row.letter}): UBL + 타깃 코너 둘만 바뀐다`, () => {
			const item = items.find((it) => it.id === row.id)!;
			const f = faceletsOf(expandY(item.alg, Y_PERM));
			const state = stateFromFacelets(f, 'corner');
			// 바뀐 큐비 집합 — 코너 수준에서 센다.
			const movedCubies = new Set<string>();
			for (const [pos, s] of Object.entries(state)) {
				if (pos !== s) movedCubies.add(CORNER_CUBIE[pos]);
			}
			const target = CORNER_CUBIE[row.letter];
			expect(movedCubies).toEqual(new Set(['UBL', target]));
		});

		it(`${row.id} (${row.letter}): 엣지·센터는 Y 단독과 같다`, () => {
			const item = items.find((it) => it.id === row.id)!;
			const f = faceletsOf(expandY(item.alg, Y_PERM));
			// 엣지 facelet 들이 Y 단독과 같다.
			for (const i of EDGE_FACELET_SET) {
				expect(f[i], `edge facelet ${i} (row ${row.id})`).toBe(Y_ONLY[i]);
			}
			// 센터도 같다 (Y 는 센터를 안 건드리므로 solved).
			expect(centerString(f)).toBe(centerString(SOLVED));
		});
	}
});

describe('D-4. 각 행의 setup 에 U/B/L 무브가 없다 (버퍼 영역을 건드리지 않는다)', () => {
	for (const row of ds.rows) {
		it(`${row.id}: setup "${row.setup}" 에 U/B/L 계열 없음`, () => {
			const forbidden = /^[UBL]/;
			for (const token of splitMoves(row.setup)) {
				expect(forbidden.test(token), `${row.id}: ${token}`).toBe(false);
			}
		});
	}
});

describe('D-5. gradeOp: 정답', () => {
	const Y_PERM = ds.meta.yPerm;

	it('같은 공식 그대로 → correct', () => {
		const target = items.find((it) => it.id === 'b')!;
		expect(gradeOp(target.alg, target, items, Y_PERM)).toEqual({ kind: 'correct' });
	});

	it('`[Y]` 를 그대로 둬도 펼친 뒤 상태가 같으면 correct', () => {
		// B: 데이터의 alg 는 "R D' [Y] D R'". 사용자가 `[Y]` 토큰으로 입력한 그대로.
		const target = items.find((it) => it.id === 'b')!;
		expect(gradeOp("R D' [Y] D R'", target, items, Y_PERM)).toEqual({ kind: 'correct' });
	});

	it('Y 행: Y-perm 전체 입력 → correct', () => {
		const y = items[0];
		expect(gradeOp(Y_PERM, y, items, Y_PERM)).toEqual({ kind: 'correct' });
	});

	it('Y 행: `[Y]` 하나 입력 → correct (펼치면 Y-perm)', () => {
		const y = items[0];
		expect(gradeOp('[Y]', y, items, Y_PERM)).toEqual({ kind: 'correct' });
	});
});

describe('D-6. gradeOp: 다른 행과 같은 상태 → other', () => {
	const Y_PERM = ds.meta.yPerm;

	it('타깃 B 인데 C 공식 → other (C)', () => {
		const b = items.find((it) => it.id === 'b')!;
		const c = items.find((it) => it.id === 'c')!;
		const v = gradeOp(c.alg, b, items, Y_PERM);
		expect(v.kind).toBe('other');
		if (v.kind === 'other') expect(v.label).toBe('C');
	});

	it('타깃 Y 인데 P 공식 → other 또는 correct (둘은 공식이 같다)', () => {
		// P 와 Y 는 공식이 같다 (`[Y]`). correct 가 자연스럽다.
		const y = items[0];
		const p = items.find((it) => it.id === 'p')!;
		const v = gradeOp(p.alg, y, items, Y_PERM);
		expect(v.kind).toBe('correct');
	});
});

describe('D-7. gradeOp: 항등 → identity', () => {
	const Y_PERM = ds.meta.yPerm;

	it('빈 문자열 → identity', () => {
		const b = items.find((it) => it.id === 'b')!;
		expect(gradeOp('', b, items, Y_PERM)).toEqual({ kind: 'identity' });
	});

	it("R R' → identity", () => {
		const b = items.find((it) => it.id === 'b')!;
		expect(gradeOp("R R'", b, items, Y_PERM)).toEqual({ kind: 'identity' });
	});
});

describe('D-8. gradeOp: 완전히 다른 공식 → wrong', () => {
	const Y_PERM = ds.meta.yPerm;

	it("단순 sexy move R U R' U' 는 어느 행과도 다르다", () => {
		const b = items.find((it) => it.id === 'b')!;
		expect(gradeOp("R U R' U'", b, items, Y_PERM)).toEqual({ kind: 'wrong' });
	});
});

describe('D-9. gradeOp: 알 수 없는 무브 → invalid-move', () => {
	const Y_PERM = ds.meta.yPerm;

	it('Z 는 invalid-move', () => {
		const b = items.find((it) => it.id === 'b')!;
		const v = gradeOp('Z', b, items, Y_PERM);
		expect(v.kind).toBe('invalid-move');
		if (v.kind === 'invalid-move') expect(v.move).toBe('Z');
	});
});

describe('D-10. parse/serialize 라운드트립', () => {
	it('빈 Set 라운드트립', () => {
		const back = parseOpChecked(serializeOpChecked(new Set()));
		expect(back.size).toBe(0);
	});

	it('여러 id 라운드트립', () => {
		const original = new Set(['y', 'b', 'p']);
		const back = parseOpChecked(serializeOpChecked(original));
		expect(back).toEqual(original);
	});
});

describe('D-11. 깨진 JSON / schemaVersion 불일치 → 빈 Set', () => {
	it('null → 빈 Set', () => {
		expect(parseOpChecked(null).size).toBe(0);
	});
	it('빈 문자열 → 빈 Set', () => {
		expect(parseOpChecked('').size).toBe(0);
	});
	it('JSON 아닌 문자열 → 빈 Set', () => {
		expect(parseOpChecked('not json!').size).toBe(0);
	});
	it('필드가 없는 JSON → 빈 Set', () => {
		expect(parseOpChecked('{}').size).toBe(0);
	});
	it('checked 가 배열이 아님 → 빈 Set', () => {
		expect(parseOpChecked('{"schemaVersion":1,"checked":"y"}').size).toBe(0);
	});
	it('schemaVersion 이 다름 → 빈 Set', () => {
		expect(parseOpChecked('{"schemaVersion":99,"checked":["y"]}').size).toBe(0);
	});
	it('schemaVersion 이 없음 → 빈 Set', () => {
		expect(parseOpChecked('{"checked":["y"]}').size).toBe(0);
	});
});

describe('D-12. expandY', () => {
	const Y_PERM = ds.meta.yPerm;

	it('`[Y]` 를 yPerm 으로 치환', () => {
		expect(expandY('[Y]', Y_PERM)).toBe(Y_PERM);
	});

	it('setup 사이의 `[Y]` 를 치환', () => {
		expect(expandY("R D' [Y] D R'", Y_PERM)).toBe(`R D' ${Y_PERM} D R'`);
	});

	it('`[Y]` 가 여러 번 있으면 전부 치환', () => {
		expect(expandY('[Y] [Y]', Y_PERM)).toBe(`${Y_PERM} ${Y_PERM}`);
	});

	it('`[Y]` 가 없으면 원본 그대로', () => {
		expect(expandY("R U R' U'", Y_PERM)).toBe("R U R' U'");
	});

	it('빈 문자열은 빈 문자열 그대로', () => {
		expect(expandY('', Y_PERM)).toBe('');
	});
});

describe('D-13. displayPartsOf', () => {
	const Y_PERM = ds.meta.yPerm;

	it('setup 있는 행: [plain, anchor, plain]', () => {
		const b = items.find((it) => it.id === 'b')!;
		const parts = displayPartsOf(b, Y_PERM);
		expect(parts).toEqual([
			{ text: "R D'", role: 'plain' },
			{ text: '[Y]', role: 'anchor' },
			{ text: "D R'", role: 'plain' }
		]);
	});

	it('setup 빈 행 (P, isYRow 아님): [anchor] 하나 (`[Y]` 단독)', () => {
		const p = items.find((it) => it.id === 'p')!;
		expect(p.isYRow).toBe(false);
		expect(displayPartsOf(p, Y_PERM)).toEqual([{ text: '[Y]', role: 'anchor' }]);
	});

	it('Y 행: yPerm 15 수 전체를 plain 으로 돌려 Alg 가 쪼갠다 (FR-OP-L-1)', () => {
		const y = items[0];
		expect(y.isYRow).toBe(true);
		expect(displayPartsOf(y, Y_PERM)).toEqual([{ text: Y_PERM, role: 'plain' }]);
	});
});

describe('D-14. opVerdictText — 사실 문구', () => {
	it('각 kind 문구가 존재한다', () => {
		expect(opVerdictText({ kind: 'correct' })).toBe('정답');
		expect(opVerdictText({ kind: 'other', label: 'C' })).toContain('C');
		expect(opVerdictText({ kind: 'identity' })).toContain('바뀌지');
		expect(opVerdictText({ kind: 'wrong' })).toContain('다릅니다');
		expect(opVerdictText({ kind: 'invalid-move', move: 'Z' })).toContain('Z');
	});

	it('백분율·게이미피케이션 없음 (NFR-9)', () => {
		const texts = [
			opVerdictText({ kind: 'correct' }),
			opVerdictText({ kind: 'other', label: 'C' }),
			opVerdictText({ kind: 'identity' }),
			opVerdictText({ kind: 'wrong' }),
			opVerdictText({ kind: 'invalid-move', move: 'Z' })
		];
		for (const t of texts) {
			expect(t.includes('%'), t).toBe(false);
		}
	});
});

// EDGE_INDEX 사용은 D-2 내부에서 facelet 37·46 비교를 검증한 자리에서 간접 검증된다.
// 여기 노출만 유지해 import 가 불필요한 린트 경고를 내지 않게 한다.
void EDGE_INDEX;
