/**
 * facelet → 색 매핑. 자리가 어긋난 색은 그림으로 잘 안 잡히고, 트레이싱 훈련에서는
 * 그것이 곧 틀린 답이다.
 */
import { describe, expect, it } from 'vitest';
import Cube from 'cubejs/lib/cube.js';
import { loadDataset } from '../../src/lib/data/loader.js';
import { faceletColors, grayFacelets, GRAY } from '../../src/lib/ui/facelets.js';

const ds = await loadDataset();
const solved = new Cube().asString();

describe('faceletColors', () => {
	it('54칸을 낸다', () => {
		expect(faceletColors(ds.meta.colorScheme, solved)).toHaveLength(54);
	});

	it('풀린 큐브는 면마다 한 색으로 9칸씩이다', () => {
		const colors = faceletColors(ds.meta.colorScheme, solved);
		for (let f = 0; f < 6; f++) {
			expect(new Set(colors.slice(f * 9, f * 9 + 9)).size, `면 ${f}`).toBe(1);
		}
		expect(new Set(colors).size).toBe(6);
	});

	it('색이 자리를 바꾸지 않는다', () => {
		// 같은 면 문자는 어디에 있든 같은 색이다. 자리를 옮기는 변환이 끼면 깨진다.
		const c = new Cube();
		c.move("R U R' F2 L D");
		const s = c.asString();
		const colors = faceletColors(ds.meta.colorScheme, s);
		const byChar = new Map<string, string>();
		for (let i = 0; i < 54; i++) {
			const seen = byChar.get(s[i]);
			if (seen === undefined) byChar.set(s[i], colors[i]);
			else expect(colors[i], `${s[i]} @ ${i}`).toBe(seen);
		}
		expect(byChar.size).toBe(6);
	});

	it('모르는 색 이름은 회색으로 떨어진다 (화면이 죽지 않는다)', () => {
		const scheme = { ...ds.meta.colorScheme, U: 'ZZ' };
		expect(faceletColors(scheme, solved)[0]).toBe(GRAY);
	});

	it('54칸이 아니면 던진다', () => {
		expect(() => faceletColors(ds.meta.colorScheme, 'UUU')).toThrow();
	});
});

describe('grayFacelets', () => {
	it('54칸이 전부 같은 무채색이다', () => {
		const g = grayFacelets();
		expect(g).toHaveLength(54);
		expect(new Set(g).size).toBe(1);
		// 무채색 — R·G·B 가 같다. 채도가 있으면 "무슨 색인지" 를 짐작할 여지가 생긴다.
		const m = /^#(..)(..)(..)$/.exec(g[0])!;
		expect(m[1]).toBe(m[2]);
		expect(m[2]).toBe(m[3]);
	});

	it('큐브 색 어느 것과도 같지 않다', () => {
		const colors = new Set(faceletColors(ds.meta.colorScheme, solved));
		expect(colors.has(GRAY)).toBe(false);
	});
});
