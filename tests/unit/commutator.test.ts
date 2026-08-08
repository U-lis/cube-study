import { describe, it, expect } from 'vitest';
import { decomposeCommutator } from '../../src/lib/domain/anchor.js';
import { formatCommutator } from '../../src/lib/domain/format.js';
import { invertAlg } from '../../src/lib/cube/notation.js';
import dataJson from '../../src/lib/data/corner-UBL.json';
import { type Dataset } from '../../src/lib/domain/types.js';

const ds = dataJson as unknown as Dataset;
const text = (parts: { text: string }[]) => parts.map((p) => p.text).join(' ');

describe('기준 무브열 분해', () => {
	/**
	 * 기준의 개수·이름을 적지 않는다. 데이터에 있는 것 전부를 훑는다.
	 * 데이터가 교체되어 기준이 늘거나 줄어도 이 테스트는 따라간다.
	 */
	it('데이터의 모든 기준이 [A, B] 로 분해된다', () => {
		const names = Object.keys(ds.anchors);
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) {
			expect(decomposeCommutator(ds.anchors[name].alg), name).not.toBeNull();
		}
	});

	it('분해한 것을 다시 이어붙이면 원본과 문자까지 같다', () => {
		for (const [name, a] of Object.entries(ds.anchors)) {
			const d = decomposeCommutator(a.alg)!;
			expect(`${d.A} ${d.B} ${invertAlg(d.A)} ${invertAlg(d.B)}`, name).toBe(a.alg);
		}
	});

	/**
	 * 기준을 셋업 없이 정방향으로 쓰는 케이스가 있으면 그 케이스의 direct.A/B 가
	 * 곧 이 기준의 A/B 다. 데이터가 스스로 답을 들고 있는 경우이므로 대조한다.
	 * 그런 케이스가 없는 기준은 대조할 것이 없어 건너뛴다 (현재 6개 중 3개).
	 */
	it('데이터가 A/B 를 들고 있는 기준은 그 값과 일치한다', () => {
		let checked = 0;
		for (const [name, a] of Object.entries(ds.anchors)) {
			const own = Object.values(ds.cases).find(
				(c) => c.setup.anchor === name && !c.setup.S && c.setup.usesInverse !== true
			);
			if (!own || own.direct.type !== 'pure') continue;
			const d = decomposeCommutator(a.alg)!;
			expect({ A: d.A, B: d.B }, name).toEqual({ A: own.direct.A, B: own.direct.B });
			checked++;
		}
		expect(checked).toBeGreaterThan(0);
	});
});

describe('커뮤테이터가 아닌 입력', () => {
	it('홀수 길이는 분해하지 않는다', () => {
		expect(decomposeCommutator("R U R'")).toBeNull();
	});
	it('A B A\' B\' 꼴이 아니면 분해하지 않는다', () => {
		expect(decomposeCommutator("R U R' U' R U R' U'")).toBeNull();
	});
	it('너무 짧으면 분해하지 않는다', () => {
		expect(decomposeCommutator('R U')).toBeNull();
		expect(decomposeCommutator('')).toBeNull();
	});
	it('분해되지 않으면 표기도 null 이다 — 빈 대괄호를 만들지 않는다', () => {
		expect(formatCommutator("R U R'")).toBeNull();
	});
});

describe('표기', () => {
	it('[A , B] 로 렌더된다', () => {
		const name = Object.keys(ds.anchors)[0];
		const parts = formatCommutator(ds.anchors[name].alg)!;
		expect(text(parts)).toMatch(/^\[ .+ , .+ \]$/);
	});

	it('색 역할은 조회 화면의 direct strict 와 같다', () => {
		const name = Object.keys(ds.anchors)[0];
		const parts = formatCommutator(ds.anchors[name].alg)!;
		expect(parts.map((p) => p.role)).toEqual(['punct', 'insert', 'punct', 'interchange', 'punct']);
	});
});
