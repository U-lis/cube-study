/**
 * 서랍 메뉴·라벨 매핑 (#46 이후, 하단 탭바가 제거된 뒤).
 *
 * 하단 탭바(0.4.3~0.8.0)는 #46 에서 제거됐다. `tabsFor` · `NavTab` · `staticSegments`
 * 는 이 파일에서 함께 사라졌다. 서랍(`Drawer.svelte`)이 쓰는 `menuFor` ·
 * `siblingGroups` · `labelFor` · `menuGroups` 는 남는다.
 *
 * **라벨 매핑은 남는다.** 기능 칸(`lookup`)을 사람이 읽는 말(`조회`)로 옮기는 표는
 * 어차피 어딘가 있어야 한다. 그것은 FR-NAV-23 이 금지한 "카테고리 배열" 이 아니다 —
 * 소속도 순서도 정하지 않는다. #15(i18n)가 오는 날 이 자리가 번역표의 자리가 된다.
 *
 * 룬을 쓰지 않는 순수 함수다. `pathname` 만 받으므로 `localStorage` 나 브라우저
 * 상태에 닿지 않는다 — 서버가 그린 서랍과 하이드레이션한 서랍이 같아야 한다
 * (NFR-NAV-1).
 */

/** 기능 칸 → 화면 이름. */
const FEATURE_LABELS: Record<string, string> = {
	lookup: '조회',
	algs: '기준공식',
	quiz: '퀴즈',
	daily: '매일',
	exam: '시험',
	trace: '트레이싱'
};

/**
 * 묶음별 라벨 덮어쓰기 (#19, SPEC FR-LT-24).
 *
 * 경로 칸 이름은 세트가 달라도 같은 것을 쓴다(`SVELTE.md` 규칙 3). 그런데 같은
 * `lookup` 이라도 화면이 하는 일이 다르면 사람이 부르는 이름이 다르다 — 3-style 은
 * 케이스를 찾는 "조회" 이고, 스티커 문자는 문자를 익히는 "외우기" 다. 경로는 그대로
 * 두고 이름만 묶음별로 덮는다. 없으면 `FEATURE_LABELS` 로 떨어진다.
 */
const GROUP_LABELS: Record<string, Partial<Record<string, string>>> = {
	'/3x3/bld/letters': { lookup: '외우기' }
};

/**
 * 형제 묶음. 키는 **기능 칸을 뺀 경로**, 값은 그 아래 실재하는 기능 칸이다.
 *
 * 하단 탭바가 있던 시절(0.4.3~0.8.0)에는 "형제 탭의 소속" 이었다. 지금은 **서랍의
 * 아코디언 묶음**이다 — `menuFor` 가 이 표에서 각 묶음의 링크 목록을 읽는다.
 *
 * `/3x3/bld/trace` 는 묶음에 안 들어가는 화면이라 여기 없다. 서랍이 그것을 바로
 * 링크로 뽑는다 (`MENU_3BLD` 의 `{ href, label }` 쪽).
 *
 * #19(스티커 문자)는 처음에 `/3x3/bld/letters` 한 화면으로 잡혀 있었다. 외우기·퀴즈
 * 두 화면이 되면서 `letters` 는 이름 공간이 됐고 자기 묶음을 갖는다 (2026-10-12).
 * 트레이싱은 여전히 혼자다. #21(메모)·#23(타이머)이 들어올 때 `/3x3/bld` 묶음을 다시
 * 본다.
 */
const SIBLING_GROUPS: Record<string, readonly string[]> = {
	'/3x3/bld/3style/corner': ['lookup', 'algs', 'quiz', 'daily', 'exam'],
	'/3x3/bld/letters': ['lookup', 'quiz'],
	'/3x3/bld/m2/edge': ['lookup', 'quiz'],
	'/3x3/bld/op/corner': ['lookup', 'quiz']
};

/** 그 묶음에서 기능 칸을 부르는 이름. */
export const labelFor = (group: string, feature: string): string =>
	GROUP_LABELS[group]?.[feature] ?? FEATURE_LABELS[feature] ?? feature;

/** 홈인가. 홈에는 탭바가 없다 — 홈이 곧 지도다 (FR-NAV-6). */
export function isHome(pathname: string): boolean {
	return pathname === '/';
}

/**
 * 서랍 메뉴 (#42, SPEC FR-DR-3 ~ 7).
 *
 * 묶음의 기능 칸은 `SIBLING_GROUPS` 에서 읽는다 — 하단 탭과 같은 표다. 서랍이 손으로
 * 적는 것은 **묶음의 이름과 순서**, 그리고 묶음이 없는 화면(트레이싱) 하나뿐이다.
 * 이름은 사람이 부르는 말이라 어차피 어딘가 적어야 하고, 순서는 외우는 순서(문자 →
 * 공식 → 실전)라 경로에서 나오지 않는다.
 *
 * 묶음 키는 `SIBLING_GROUPS` 의 키여야 한다. 아니면 빈 아코디언이 생긴다 —
 * `tests/unit/nav.test.ts` 가 잡는다.
 */
const MENU_3BLD: readonly ({ group: string; label: string } | { href: string; label: string })[] = [
	{ group: '/3x3/bld/letters', label: '스티커 문자' },
	{ group: '/3x3/bld/3style/corner', label: '3-style 코너' },
	{ group: '/3x3/bld/m2/edge', label: 'M2 엣지' },
	{ group: '/3x3/bld/op/corner', label: 'OP 코너' },
	{ href: '/3x3/bld/trace', label: '트레이싱' }
];

export interface MenuLink {
	href: string;
	label: string;
	current: boolean;
}

export type MenuEntry =
	| { kind: 'link'; link: MenuLink }
	| { kind: 'group'; id: string; label: string; links: MenuLink[]; containsCurrent: boolean };

/** 지금 화면인가. 상세(`…/algs/GC`)는 목록 항목이 지금 화면이다 — 하단 탭과 같은 판정. */
function isCurrent(href: string, pathname: string): boolean {
	return pathname === href || pathname.startsWith(href + '/');
}

/**
 * 서랍의 3BLD 묶음.
 *
 * 룬을 쓰지 않는 순수 함수다. 펼침 상태는 여기서 정하지 않는다 — `containsCurrent` 만
 * 내고, 서랍이 열릴 때 그것으로 초기값을 잡는다 (FR-DR-5, 펼침은 저장하지 않는다).
 */
export function menuFor(pathname: string): MenuEntry[] {
	return MENU_3BLD.map((item): MenuEntry => {
		if ('href' in item) {
			return {
				kind: 'link',
				link: { href: item.href, label: item.label, current: isCurrent(item.href, pathname) }
			};
		}
		const links = (SIBLING_GROUPS[item.group] ?? []).map((f) => {
			const href = `${item.group}/${f}`;
			return { href, label: labelFor(item.group, f), current: isCurrent(href, pathname) };
		});
		return {
			kind: 'group',
			id: item.group,
			label: item.label,
			links,
			containsCurrent: links.some((l) => l.current)
		};
	});
}

/** 서랍이 묶음으로 쓰는 키. 검사가 `SIBLING_GROUPS` 와 맞는지 본다. */
export const menuGroups = (): string[] =>
	MENU_3BLD.flatMap((item) => ('group' in item ? [item.group] : []));

/** 형제 묶음의 키. */
export const siblingGroups = (): string[] => Object.keys(SIBLING_GROUPS);
