/**
 * M2 엣지 도메인 유닛 테스트 (SPEC §2 "검증").
 *
 * 데이터 공식의 효과를 54칸 facelet 문자열로 직접 확인한다. 스티커 치환이 아니라
 * 센터까지 보는 이유는 M2 의 부수효과(C↔W, I↔S, 센터 180°)를 코드가 놓치지 않게
 * 하기 위함이다 — GLOBAL AD-2.
 *
 * 데이터 JSON 은 손대지 않는다 (CLAUDE.md). 테스트가 틀렸다는 결론이 나오면
 * 테스트를 고친다.
 */
import { describe, it, expect } from 'vitest';
import {
	itemsOf,
	gradeM2,
	displayParts,
	expandDisplay,
	parseM2Checked,
	serializeM2Checked,
	type M2DataSet,
	type M2Item
} from '../../src/lib/domain/m2.js';
import { faceletsOf, stateFromFacelets } from '../../src/lib/cube/sim.js';
import {
	EDGE_INDEX,
	EDGE_FACELETS,
	EDGE_AT,
	CORNER_FACELETS
} from '../../src/lib/cube/speffz.js';
import dataJson from '../../src/lib/data/edge-DF-m2.json';

const ds = dataJson as unknown as M2DataSet;
const items: M2Item[] = itemsOf(ds);
const SOLVED = faceletsOf('');

/** 센터 6칸의 색 — 풀린 큐브에서 각 면의 중앙은 그 면의 색이다. */
const centerString = (f: string) =>
	[4, 13, 22, 31, 40, 49].map((i) => f[i]).join('');
const SOLVED_CENTER = centerString(SOLVED);

/** 코너 조각 전체의 facelet 들. 코너 무영향 검사에 쓴다. */
const CORNER_FACELET_SET: number[] = Object.values(CORNER_FACELETS).flat();

/** 각 큐비를 이루는 두 스티커 문자 (예: `UF: ['c', 'i']`). */
const EDGE_LETTERS_OF: Record<string, string[]> = Object.fromEntries(
	Object.entries(EDGE_FACELETS).map(([piece, idxs]) => [piece, idxs.map((i) => EDGE_AT[i])])
);

describe('D-1. itemsOf', () => {
	it('27개 — 26 타깃 + 패리티', () => {
		expect(items).toHaveLength(27);
	});

	it('마지막은 패리티', () => {
		expect(items[26].order).toBe('parity');
		expect(items[26].id).toBe('parity');
	});

	it('데이터 순서 그대로', () => {
		for (let k = 0; k < ds.rows.length; k++) {
			expect(items[k].id).toBe(ds.rows[k].id);
		}
	});

	it('order 는 데이터 그대로 — null 은 null, odd/even 은 데이터 값', () => {
		// A (짝이 버퍼) 는 데이터가 null 이므로 코드도 null 로 둔다.
		const a = items.find((it) => it.id === 'a')!;
		expect(a.order).toBeNull();
		// c (M 슬라이스 홀수 번째) 는 데이터가 'odd'.
		const c = items.find((it) => it.id === 'c')!;
		expect(c.order).toBe('odd');
		const c2 = items.find((it) => it.id === 'c2')!;
		expect(c2.order).toBe('even');
	});

	it('place 는 셋업으로 가져올 스티커 — piece 와 face 가 함께 선다', () => {
		// A 와 Q 는 piece 가 같지만 face 가 다르다 (스티커가 다르다).
		const a = items.find((it) => it.id === 'a')!;
		const q = items.find((it) => it.id === 'q')!;
		expect(a.place).toBe('UB 의 U 면');
		expect(q.place).toBe('UB 의 B 면');
	});

	it('패리티 place 는 UB↔UL 교환', () => {
		expect(items[26].place).toBe('UB↔UL 교환');
	});
});

describe('D-2. 각 타깃 행: DF 버퍼에 타깃 조각이 온다 (M2 부수효과 포함)', () => {
	// M-슬라이스 타깃(C·W·I·S)은 공식 하나로 깔끔한 2-교환이 되지 않고
	// M-슬라이스 조각들끼리 3-cycle 을 만든다. 그래서 facelet-level 등식 대신
	// **조각 수준**(stateFromFacelets)으로 검사한다 — 타깃 큐비가 DF 자리에
	// 왔는지, 방향은 어느 쪽이든 상관없이.
	//
	// 짝수 번째 공식은 M2 가 한 번 들어간 상태에서 쓰도록 짜여 있다 (SPEC FR-M2-D-5).
	// 풀린 상태에서 혼자 돌리면 "타깃이 버퍼에 온다" 가 성립하지 않아, 테스트에서
	// M2 를 선행시켜 그 전제를 만든다.

	for (const row of ds.rows) {
		it(`${row.id} (${row.piece} ${row.face} 면): 타깃 큐비가 DF 자리에 온다`, () => {
			const prefix = row.order === 'even' ? 'M2 ' : '';
			const state = stateFromFacelets(faceletsOf(prefix + row.alg), 'edge');

			// DF 자리의 두 스티커 (u, k) 에 타깃 큐비의 두 스티커가 와 있어야 한다.
			const dfContents = [state.u, state.k].sort().join('');
			const expected = [...EDGE_LETTERS_OF[row.piece]].sort().join('');
			expect(dfContents).toBe(expected);
		});
	}

	// 센터 검사는 홀/짝/null 모두 "풀림 또는 180° 어긋남" 두 상태 중 하나다.
	// 180° 어긋남은 M-슬라이스가 홀수 번 돌아간 상태 — 데이터의 홀수-번째 공식과
	// 짝수-번째 공식 모두에 등장할 수 있다 (어떤 공식은 센터를 복원한다).
	for (const row of ds.rows) {
		it(`${row.id}: 센터가 풀림 또는 M-슬라이스 180° 어긋남 상태`, () => {
			const f = faceletsOf(row.alg);
			const centerAfterM2 = centerString(faceletsOf('M2'));
			const c = centerString(f);
			expect(c === SOLVED_CENTER || c === centerAfterM2).toBe(true);
		});
	}

	// M2 부수효과의 명시적 확인: 홀수 번째 M-슬라이스 공식과 그 짝의 짝수 번째
	// 공식은 같은 facelet 상태를 낸다 (C↔W, I↔S 가 되는 이유다).
	it('C↔W: c (홀수 번째) 와 w2 (짝수 번째) 는 같은 상태', () => {
		expect(faceletsOf('U2 M\' U2 M\'')).toBe(faceletsOf(ds.rows.find((r) => r.id === 'w2')!.alg));
	});
	it('W↔C: w (홀수 번째) 와 c2 (짝수 번째) 는 같은 상태', () => {
		const c2 = ds.rows.find((r) => r.id === 'c2')!;
		const w = ds.rows.find((r) => r.id === 'w')!;
		expect(faceletsOf(c2.alg)).toBe(faceletsOf(w.alg));
	});
	it('I↔S: i (홀수 번째) 와 s2 (짝수 번째) 는 같은 상태', () => {
		const i = ds.rows.find((r) => r.id === 'i')!;
		const s2 = ds.rows.find((r) => r.id === 's2')!;
		expect(faceletsOf(i.alg)).toBe(faceletsOf(s2.alg));
	});
	it('S↔I: s (홀수 번째) 와 i2 (짝수 번째) 는 같은 상태', () => {
		const s = ds.rows.find((r) => r.id === 's')!;
		const i2 = ds.rows.find((r) => r.id === 'i2')!;
		expect(faceletsOf(s.alg)).toBe(faceletsOf(i2.alg));
	});
});

describe('D-3. 각 타깃 행: 코너 조각 무영향', () => {
	for (const row of ds.rows) {
		it(`${row.id}: 코너 스티커가 전부 제자리 색`, () => {
			const f = faceletsOf(row.alg);
			for (const i of CORNER_FACELET_SET) {
				expect(f[i]).toBe(SOLVED[i]);
			}
		});
	}
});

describe('D-4. 패리티 행: UB↔UL 교환 + 센터 복원 (1506판 확인)', () => {
	// 패리티 공식은 **홀수 번째 M2 후** 상태에서 센터를 복원하도록 짜여 있다.
	// 풀린 상태에서 혼자 돌리면 M2 가 한 번 들어가므로 M-슬라이스가 180° 어긋난
	// 상태가 남고, UF·DB 가 그 부수효과로 교환된다 (SPEC FR-M2-D-6).
	//
	// 그래서 D-4 는 두 가지로 검사한다:
	//   (1) 패리티 하나만: a↔d, q↔e 교환 성립 · 코너 무영향
	//   (2) `M2 + 패리티`: 센터 복원 (= 홀수 번째의 끝에서 모든 것이 돌아온다)

	it('(1) 패리티 하나만: UB (a, q) ↔ UL (d, e) 스티커 교환', () => {
		const f = faceletsOf(ds.parity.alg);
		const a = EDGE_INDEX.a;
		const q = EDGE_INDEX.q;
		const d = EDGE_INDEX.d;
		const e = EDGE_INDEX.e;

		expect(f[a]).toBe(SOLVED[d]);
		expect(f[d]).toBe(SOLVED[a]);
		expect(f[q]).toBe(SOLVED[e]);
		expect(f[e]).toBe(SOLVED[q]);
	});

	it('(1) 패리티는 코너를 건드리지 않는다', () => {
		const f = faceletsOf(ds.parity.alg);
		for (const i of CORNER_FACELET_SET) {
			expect(f[i]).toBe(SOLVED[i]);
		}
	});

	// 홀수 번째의 끝에서 센터가 180° 어긋나 있고 M-슬라이스 조각들이 UF↔DB 로
	// 교환되어 있다. 거기에 패리티를 더하면 이 둘이 모두 풀리고 UB↔UL 교환만 남는다.
	it('(2) M2 + 패리티: 센터 복원', () => {
		const f = faceletsOf(`M2 ${ds.parity.alg}`);
		expect(centerString(f)).toBe(SOLVED_CENTER);
	});

	it('(2) M2 + 패리티: 코너 무영향', () => {
		const f = faceletsOf(`M2 ${ds.parity.alg}`);
		for (const i of CORNER_FACELET_SET) {
			expect(f[i]).toBe(SOLVED[i]);
		}
	});
});

describe('D-5. gradeM2: 정답', () => {
	it('같은 공식 그대로 입력 → correct', () => {
		const target = items[0]; // a: M2
		expect(gradeM2(target.alg, target.alg, items)).toEqual({ kind: 'correct' });
	});

	it('같은 효과의 다른 순서 공식 → correct (M2 ≡ M M)', () => {
		const target = items[0]; // a: M2
		expect(gradeM2('M M', target.alg, items)).toEqual({ kind: 'correct' });
	});

	it('동치 다른 공식: c (odd) 와 w2 (even) 는 같은 상태 → correct', () => {
		const c = items.find((it) => it.id === 'c')!;
		const w2 = items.find((it) => it.id === 'w2')!;
		expect(gradeM2(c.alg, w2.alg, items)).toEqual({ kind: 'correct' });
	});
});

describe('D-6. gradeM2: 다른 행과 같은 상태 → other', () => {
	it('순번과 무관한 줄의 라벨은 문자뿐: 타깃 a 인데 b 공식 → other (B)', () => {
		// b 는 order=null (짝이 버퍼가 아니지만 M 슬라이스가 아니라 짝수/홀수 구분이 없다).
		const a = items.find((it) => it.id === 'a')!;
		const b = items.find((it) => it.id === 'b')!;
		const v = gradeM2(b.alg, a.alg, items);
		expect(v.kind).toBe('other');
		if (v.kind === 'other') expect(v.label).toBe('B');
	});

	it('짝수 번째 라벨: 타깃 a 인데 c2 공식 → other (C (짝수 번째))', () => {
		const a = items.find((it) => it.id === 'a')!;
		const c2 = items.find((it) => it.id === 'c2')!;
		const v = gradeM2(c2.alg, a.alg, items);
		expect(v.kind).toBe('other');
		// c2 는 w (odd) 와 효과가 같다. items 순서는 데이터 순서라 c2 가 w 보다 먼저다.
		if (v.kind === 'other') expect(v.label).toBe('C (짝수 번째)');
	});

	it('홀수 번째 라벨: 타깃 a 인데 c 공식 → other (C (홀수 번째))', () => {
		// c 는 order='odd'. c 는 w2 (even) 와 효과가 같다. items 순서상 c 가 w2 보다 먼저다.
		const a = items.find((it) => it.id === 'a')!;
		const c = items.find((it) => it.id === 'c')!;
		const v = gradeM2(c.alg, a.alg, items);
		expect(v.kind).toBe('other');
		if (v.kind === 'other') expect(v.label).toBe('C (홀수 번째)');
	});
});

describe('D-7. gradeM2: 항등', () => {
	it('빈 문자열 → identity', () => {
		const target = items[0];
		expect(gradeM2('', target.alg, items)).toEqual({ kind: 'identity' });
	});

	it("R R' → identity", () => {
		const target = items[0];
		expect(gradeM2("R R'", target.alg, items)).toEqual({ kind: 'identity' });
	});
});

describe('D-8. gradeM2: 완전히 다른 공식 → wrong', () => {
	it("단순 sexy move R U R' U' 는 타깃과도 어느 행과도 다르다", () => {
		const target = items.find((it) => it.id === 'a')!;
		expect(gradeM2("R U R' U'", target.alg, items)).toEqual({ kind: 'wrong' });
	});
});

describe('D-9. gradeM2: 알 수 없는 무브', () => {
	it('Z 는 invalid-move', () => {
		const target = items[0];
		const v = gradeM2('Z', target.alg, items);
		expect(v.kind).toBe('invalid-move');
		if (v.kind === 'invalid-move') expect(v.move).toBe('Z');
	});
});

describe('D-10. parse/serialize 라운드트립', () => {
	it('빈 Set 라운드트립', () => {
		const s = serializeM2Checked(new Set());
		const back = parseM2Checked(s);
		expect(back.size).toBe(0);
	});

	it('여러 id 라운드트립', () => {
		const original = new Set(['a', 'c2', 'parity']);
		const s = serializeM2Checked(original);
		const back = parseM2Checked(s);
		expect(back).toEqual(original);
	});
});

describe('D-11. 깨진 JSON', () => {
	it('null → 빈 Set', () => {
		expect(parseM2Checked(null).size).toBe(0);
	});
	it('빈 문자열 → 빈 Set', () => {
		expect(parseM2Checked('').size).toBe(0);
	});
	it('JSON 아닌 문자열 → 빈 Set', () => {
		expect(parseM2Checked('not json!').size).toBe(0);
	});
	it('필드가 없는 JSON → 빈 Set', () => {
		expect(parseM2Checked('{}').size).toBe(0);
	});
	it('checked 가 배열이 아님 → 빈 Set', () => {
		expect(parseM2Checked('{"schemaVersion":1,"checked":"a"}').size).toBe(0);
	});
});

describe('D-12. 버전 불일치', () => {
	it('schemaVersion 이 다름 → 빈 Set', () => {
		expect(parseM2Checked('{"schemaVersion":99,"checked":["a"]}').size).toBe(0);
	});
	it('schemaVersion 이 없음 → 빈 Set', () => {
		expect(parseM2Checked('{"checked":["a"]}').size).toBe(0);
	});
});

describe('D-13. 화면 표기 (반복 묶음)', () => {
	it('펼친 표기는 데이터의 alg 와 무브 하나하나까지 같다', () => {
		for (const it of items) expect(expandDisplay(it.display), it.id).toBe(it.alg);
	});
	it('Q 는 반복을 묶어 보인다', () => {
		expect(items.find((x) => x.id === 'q')!.display).toBe("(U' M')×3 U' M (U' M')×4");
	});
	it('display 가 없는 줄은 alg 그대로', () => {
		expect(items.find((x) => x.id === 'b')!.display).toBe("R' U R U' M2 U R' U' R");
	});
	it('displayParts: 괄호와 )×n 은 punct, 무브는 plain', () => {
		expect(displayParts("(U' M')×3 U' M (U' M')×4")).toEqual([
			{ text: '(', role: 'punct' },
			{ text: "U' M'", role: 'plain' },
			{ text: ')×3', role: 'punct' },
			{ text: "U' M", role: 'plain' },
			{ text: '(', role: 'punct' },
			{ text: "U' M'", role: 'plain' },
			{ text: ')×4', role: 'punct' }
		]);
	});
	it('displayParts: 묶음 없는 표기는 plain 하나', () => {
		expect(displayParts('M2')).toEqual([{ text: 'M2', role: 'plain' }]);
	});
});
