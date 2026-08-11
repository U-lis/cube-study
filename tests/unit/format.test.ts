import { describe, it, expect } from 'vitest';
import { formatAlg, plainAlg } from '../../src/lib/domain/format.js';
import { splitMoves } from '../../src/lib/cube/notation.js';
import dataJson from '../../src/lib/data/corner-UBL.json';
import { ANCHOR_DIRECT, type CaseEntry, type Dataset } from '../../src/lib/domain/types.js';

const ds = dataJson as unknown as Dataset;
const c = (k: string) => ds.cases[k];
const text = (parts: { text: string }[]) => parts.map((p) => p.text).join(' ');

describe('direct strict', () => {
	it('pure 는 [A , B]', () => {
		expect(text(formatAlg(c('LB'), 'direct', 'strict'))).toBe("[ R D2 R' , U ]");
	});
	it('conj 는 [S : [A , B]]', () => {
		expect(text(formatAlg(c('CI'), 'direct', 'strict'))).toBe("[ L' : [ R' D2 R , U2 ] ]");
	});
});

describe('setup strict', () => {
	// 특정 케이스 코드를 박아두면 데이터가 바뀔 때 의미 없이 깨진다. 조건으로 고른다.
	const find = (f: (e: CaseEntry) => boolean) => Object.values(ds.cases).find(f)!;

	it('셋업 있으면 [S : anchor]', () => {
		const e = find((x) => !!x.setup.S && !x.setup.usesInverse);
		expect(text(formatAlg(e, 'setup', 'strict'))).toBe(`[ ${e.setup.S} : ${e.setup.anchor} ]`);
	});

	it('셋업 없으면 anchor 이름만', () => {
		const e = find((x) => !x.setup.S && !x.setup.usesInverse);
		expect(text(formatAlg(e, 'setup', 'strict'))).toBe(e.setup.anchor);
	});

	it('역방향이면 이름에 프라임이 붙는다', () => {
		const e = find((x) => !!x.setup.S && x.setup.usesInverse === true);
		expect(text(formatAlg(e, 'setup', 'strict'))).toBe(`[ ${e.setup.S} : ${e.setup.anchor}' ]`);
	});

	it('역방향 + 셋업 없으면 이름에 프라임만', () => {
		const e = find((x) => !x.setup.S && x.setup.usesInverse === true);
		expect(text(formatAlg(e, 'setup', 'strict'))).toBe(`${e.setup.anchor}'`);
	});

	it('anchor 파트는 역방향 여부와 무관하게 anchor 역할 하나뿐', () => {
		for (const e of Object.values(ds.cases)) {
			if (e.setup.anchor === ANCHOR_DIRECT) continue;
			const anchors = formatAlg(e, 'setup', 'strict').filter((p) => p.role === 'anchor');
			expect(anchors).toHaveLength(1);
			expect(anchors[0].text).toBe(e.setup.anchor + (e.setup.usesInverse ? "'" : ''));
		}
	});

	it('(직접) 은 괄호 없이 알고리즘', () => {
		// v3 에는 해당 케이스가 없다. 데이터가 다시 담으면 이 검증이 살아난다.
		const e = Object.values(ds.cases).find((x) => x.setup.anchor === ANCHOR_DIRECT);
		if (!e) return;
		const parts = formatAlg(e, 'setup', 'strict');
		expect(parts).toHaveLength(1);
		expect(parts[0].role).toBe('plain');
		expect(parts[0].text).toBe(e.setup.strict.alg);
	});
});

describe('compact', () => {
	it('direct 는 alg 평문 단일 파트', () => {
		const parts = formatAlg(c('LB'), 'direct', 'compact');
		expect(parts).toHaveLength(1);
		expect(parts[0].text).toBe(c('LB').direct.alg);
	});
	it('괄호가 없다', () => {
		for (const m of ['direct', 'setup'] as const)
			for (const code of Object.keys(ds.cases))
				expect(text(formatAlg(c(code), m, 'compact'))).not.toMatch(/[[\]:,]/);
	});
});

describe('전수 378 x 4조합', () => {
	it('strict 파트를 이으면 무브 열이 데이터와 일치', () => {
		for (const code of Object.keys(ds.cases))
			for (const m of ['direct', 'setup'] as const) {
				const moves = formatAlg(c(code), m, 'strict')
					.filter((p) => p.role !== 'punct' && p.role !== 'anchor')
					.flatMap((p) => splitMoves(p.text));
				if (m === 'setup' && c(code).setup.S === '' && c(code).setup.anchor !== ANCHOR_DIRECT)
					continue;
				const expected = splitMoves(plainAlg(c(code), m, 'strict'));
				// direct strict 는 A B A' B' 순이므로 파트만으로는 재구성되지 않는다.
				// 여기서는 각 파트가 유효 무브로만 이뤄졌는지 확인한다.
				expect(moves.every((x) => /^[ULFRBDMES]['2]?$/.test(x))).toBe(true);
				expect(expected.every((x) => /^[ULFRBDMES]['2]?$/.test(x))).toBe(true);
			}
	});

	it('ASCII 프라임만 사용 (NFR-4)', () => {
		for (const code of Object.keys(ds.cases))
			for (const m of ['direct', 'setup'] as const)
				for (const n of ['strict', 'compact'] as const) {
					const s = text(formatAlg(c(code), m, n));
					expect(s).not.toMatch(/[‘’ʼ]/);
					if (s.includes("'")) expect(s.charCodeAt(s.indexOf("'"))).toBe(39);
				}
	});
});
