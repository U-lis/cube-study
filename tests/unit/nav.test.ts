/**
 * T1-1 — 서랍 메뉴 계산 (FR-DR-*, FR-NAV-23).
 *
 * 문자열만 다루는 순수 함수라 브라우저가 필요 없다. 이 검사가 지키는 것은 **서랍의
 * 소속을 손으로 적지 않는다** 는 규칙이다 — 경로가 정하고, 그 계산이 여기 있다.
 *
 * 0.8.0 까지는 하단 탭바의 `tabsFor` 검사가 이 자리에 있었다. #46 에서 탭바가
 * 제거되면서 검사도 함께 사라졌다 — 서랍 쪽 검사만 남는다.
 */
import { describe, it, expect } from 'vitest';
import { isHome, menuFor, menuGroups, siblingGroups } from '../../src/lib/ui/nav.js';

const CORNER = '/3x3/bld/3style/corner';

describe('isHome', () => {
	it('루트만 홈이다', () => {
		expect(isHome('/')).toBe(true);
		expect(isHome('/3x3/bld/trace')).toBe(false);
		expect(isHome(`${CORNER}/lookup`)).toBe(false);
	});
});

describe('menuFor (서랍, #42)', () => {
	it('3BLD 는 스티커 문자 → 3-style 코너 → M2 엣지 → OP 코너 → 트레이싱 순이다', () => {
		const menu = menuFor('/');
		expect(menu.map((e) => (e.kind === 'group' ? e.label : e.link.label))).toEqual([
			'스티커 문자',
			'3-style 코너',
			'M2 엣지',
			'OP 코너',
			'트레이싱'
		]);
	});

	it('M2 엣지 묶음은 조회·퀴즈 둘이다', () => {
		const menu = menuFor('/');
		const m2 = menu.find((e) => e.kind === 'group' && e.id === '/3x3/bld/m2/edge');
		expect(m2?.kind === 'group' && m2.links.map((l) => l.label)).toEqual(['조회', '퀴즈']);
		expect(m2?.kind === 'group' && m2.links.map((l) => l.href)).toEqual([
			'/3x3/bld/m2/edge/lookup',
			'/3x3/bld/m2/edge/quiz'
		]);
	});

	it('OP 코너 묶음은 조회·퀴즈 둘이다 (#18)', () => {
		const menu = menuFor('/');
		const opc = menu.find((e) => e.kind === 'group' && e.id === '/3x3/bld/op/corner');
		expect(opc?.kind === 'group' && opc.links.map((l) => l.label)).toEqual(['조회', '퀴즈']);
		expect(opc?.kind === 'group' && opc.links.map((l) => l.href)).toEqual([
			'/3x3/bld/op/corner/lookup',
			'/3x3/bld/op/corner/quiz'
		]);
	});

	it('묶음의 항목은 하단 탭과 같은 표에서 나온다', () => {
		const menu = menuFor('/');
		const corner = menu.find((e) => e.kind === 'group' && e.id === CORNER);
		expect(corner?.kind === 'group' && corner.links.map((l) => l.label)).toEqual([
			'조회',
			'기준공식',
			'퀴즈',
			'매일'
		]);
		const letters = menu.find((e) => e.kind === 'group' && e.id === '/3x3/bld/letters');
		expect(letters?.kind === 'group' && letters.links.map((l) => l.label)).toEqual([
			'외우기',
			'퀴즈'
		]);
	});

	it('서랍의 묶음은 모두 형제 묶음이다 — 빈 아코디언이 없다', () => {
		for (const g of menuGroups()) expect(siblingGroups()).toContain(g);
	});

	it('형제 묶음은 모두 서랍에 있다 — 서랍에서 못 가는 묶음이 없다', () => {
		for (const g of siblingGroups()) expect(menuGroups()).toContain(g);
	});

	it('지금 화면이 든 묶음만 containsCurrent 다', () => {
		const menu = menuFor(`${CORNER}/quiz`);
		const flags = menu.flatMap((e) => (e.kind === 'group' ? [[e.id, e.containsCurrent]] : []));
		expect(flags).toEqual([
			['/3x3/bld/letters', false],
			[CORNER, true],
			['/3x3/bld/m2/edge', false],
			['/3x3/bld/op/corner', false]
		]);
	});

	it('M2 조회에 있으면 M2 묶음만 containsCurrent 다', () => {
		const menu = menuFor('/3x3/bld/m2/edge/lookup');
		const flags = menu.flatMap((e) => (e.kind === 'group' ? [[e.id, e.containsCurrent]] : []));
		expect(flags).toEqual([
			['/3x3/bld/letters', false],
			[CORNER, false],
			['/3x3/bld/m2/edge', true],
			['/3x3/bld/op/corner', false]
		]);
	});

	it('OP 조회에 있으면 OP 묶음만 containsCurrent 다 (#18)', () => {
		const menu = menuFor('/3x3/bld/op/corner/lookup');
		const flags = menu.flatMap((e) => (e.kind === 'group' ? [[e.id, e.containsCurrent]] : []));
		expect(flags).toEqual([
			['/3x3/bld/letters', false],
			[CORNER, false],
			['/3x3/bld/m2/edge', false],
			['/3x3/bld/op/corner', true]
		]);
	});

	it('기준 상세에서는 기준공식이 지금 화면이다', () => {
		const menu = menuFor(`${CORNER}/algs/GC`);
		const corner = menu.find((e) => e.kind === 'group' && e.id === CORNER);
		expect(corner?.kind === 'group' && corner.links.filter((l) => l.current).map((l) => l.label)).toEqual([
			'기준공식'
		]);
	});

	it('트레이싱은 바로 링크이고 그 화면에서 지금 화면이다', () => {
		const trace = menuFor('/3x3/bld/trace').find((e) => e.kind === 'link');
		expect(trace?.kind === 'link' && trace.link.current).toBe(true);
	});

	it('홈에서는 지금 화면이 없다', () => {
		const menu = menuFor('/');
		const any = menu.some((e) =>
			e.kind === 'link' ? e.link.current : e.links.some((l) => l.current)
		);
		expect(any).toBe(false);
	});
});
