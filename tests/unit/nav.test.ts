/**
 * T1-1 — 하단 탭 계산 (FR-NAV-4·5·6·23).
 *
 * 문자열만 다루는 순수 함수라 브라우저가 필요 없다. 이 검사가 지키는 것은 **탭의
 * 소속을 손으로 적지 않는다** 는 규칙이다 — 경로가 정하고, 그 계산이 여기 있다.
 */
import { describe, it, expect } from 'vitest';
import { tabsFor, isHome, menuFor, menuGroups, siblingGroups } from '../../src/lib/ui/nav.js';

const CORNER = '/3x3/bld/3style/corner';

describe('tabsFor', () => {
	it('홈에는 탭이 없다', () => {
		expect(tabsFor('/', '/')).toEqual([]);
	});

	it('조회·기준공식·퀴즈·매일은 서로 형제다', () => {
		for (const feature of ['lookup', 'algs', 'quiz', 'daily']) {
			const tabs = tabsFor(`${CORNER}/${feature}`, `${CORNER}/${feature}`);
			expect(tabs.map((t) => t.feature), feature).toEqual(['lookup', 'algs', 'quiz', 'daily']);
			expect(tabs.filter((t) => t.active).map((t) => t.feature), feature).toEqual([feature]);
		}
	});

	it('기준 상세는 목록의 탭을 물려받고 기준공식이 켜진다', () => {
		// 동적 칸을 걷어낸 경로로 계산한다 (AD-NAV-B). 상세마다 예외 분기가 없다.
		const tabs = tabsFor(`${CORNER}/algs/GC`, `${CORNER}/algs/[code]`);
		expect(tabs.map((t) => t.feature)).toEqual(['lookup', 'algs', 'quiz', 'daily']);
		expect(tabs.find((t) => t.active)?.feature).toBe('algs');
	});

	it('트레이싱은 형제가 없어 탭이 없다', () => {
		expect(tabsFor('/3x3/bld/trace', '/3x3/bld/trace')).toEqual([]);
	});

	it('탭의 href 는 형제 경로 전체다', () => {
		const tabs = tabsFor(`${CORNER}/lookup`, `${CORNER}/lookup`);
		expect(tabs.map((t) => t.href)).toEqual([
			`${CORNER}/lookup`,
			`${CORNER}/algs`,
			`${CORNER}/quiz`,
			`${CORNER}/daily`
		]);
	});

	it('탭의 라벨은 화면 이름이다', () => {
		const tabs = tabsFor(`${CORNER}/quiz`, `${CORNER}/quiz`);
		expect(tabs.map((t) => t.label)).toEqual(['조회', '기준공식', '퀴즈', '매일']);
	});

	it('스티커 문자는 외우기·퀴즈 둘이 형제이고 lookup 의 이름이 외우기다 (#19)', () => {
		const tabs = tabsFor('/3x3/bld/letters/lookup', '/3x3/bld/letters/lookup');
		expect(tabs.map((t) => [t.label, t.href, t.active])).toEqual([
			['외우기', '/3x3/bld/letters/lookup', true],
			['퀴즈', '/3x3/bld/letters/quiz', false]
		]);
	});

	it('3-style 의 lookup 은 그대로 조회다 (묶음별 라벨이 새지 않는다)', () => {
		const tabs = tabsFor('/3x3/bld/3style/corner/lookup', '/3x3/bld/3style/corner/lookup');
		expect(tabs[0].label).toBe('조회');
	});

	it('모르는 경로에는 탭이 없다', () => {
		// 축 밖의 주소로 잘못 들어와도 빈 탭바를 그리지 않는다.
		expect(tabsFor('/3x3/speed/cfop/oll/lookup', '/3x3/speed/cfop/oll/lookup')).toEqual([]);
		expect(tabsFor('/nope', null)).toEqual([]);
	});

	it('routeId 가 없으면 pathname 으로 계산한다', () => {
		// 하이드레이션 전이나 오류 화면에서 routeId 가 비는 경우.
		expect(tabsFor(`${CORNER}/algs`, null).map((t) => t.feature)).toEqual([
			'lookup',
			'algs',
			'quiz',
			'daily'
		]);
	});
});

describe('isHome', () => {
	it('루트만 홈이다', () => {
		expect(isHome('/')).toBe(true);
		expect(isHome('/3x3/bld/trace')).toBe(false);
		expect(isHome(`${CORNER}/lookup`)).toBe(false);
	});
});

describe('menuFor (서랍, #42)', () => {
	it('3BLD 는 스티커 문자 → 3-style 코너 → 트레이싱 순이다', () => {
		const menu = menuFor('/');
		expect(menu.map((e) => (e.kind === 'group' ? e.label : e.link.label))).toEqual([
			'스티커 문자',
			'3-style 코너',
			'트레이싱'
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
			[CORNER, true]
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
