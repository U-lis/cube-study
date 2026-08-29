/**
 * T1-1 — 하단 탭 계산 (FR-NAV-4·5·6·23).
 *
 * 문자열만 다루는 순수 함수라 브라우저가 필요 없다. 이 검사가 지키는 것은 **탭의
 * 소속을 손으로 적지 않는다** 는 규칙이다 — 경로가 정하고, 그 계산이 여기 있다.
 */
import { describe, it, expect } from 'vitest';
import { tabsFor, isHome } from '../../src/lib/ui/nav.js';

const CORNER = '/3x3/bld/3style/corner';

describe('tabsFor', () => {
	it('홈에는 탭이 없다', () => {
		expect(tabsFor('/', '/')).toEqual([]);
	});

	it('조회·기준공식·퀴즈는 서로 형제다', () => {
		for (const feature of ['lookup', 'algs', 'quiz']) {
			const tabs = tabsFor(`${CORNER}/${feature}`, `${CORNER}/${feature}`);
			expect(tabs.map((t) => t.feature), feature).toEqual(['lookup', 'algs', 'quiz']);
			expect(tabs.filter((t) => t.active).map((t) => t.feature), feature).toEqual([feature]);
		}
	});

	it('기준 상세는 목록의 탭을 물려받고 기준공식이 켜진다', () => {
		// 동적 칸을 걷어낸 경로로 계산한다 (AD-NAV-B). 상세마다 예외 분기가 없다.
		const tabs = tabsFor(`${CORNER}/algs/GC`, `${CORNER}/algs/[code]`);
		expect(tabs.map((t) => t.feature)).toEqual(['lookup', 'algs', 'quiz']);
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
			`${CORNER}/quiz`
		]);
	});

	it('탭의 라벨은 화면 이름이다', () => {
		const tabs = tabsFor(`${CORNER}/quiz`, `${CORNER}/quiz`);
		expect(tabs.map((t) => t.label)).toEqual(['조회', '기준공식', '퀴즈']);
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
			'quiz'
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
