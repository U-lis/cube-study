/**
 * 하단 탭을 경로에서 계산한다 (FR-NAV-4·5·23).
 *
 * 0.4.2 까지는 `+layout.svelte` 안에 `const nav = [{ href, label }, ...]` 배열이
 * 있었다. 그 배열이 **소속·순서·라벨 셋을 한 곳에 섞어** 들고 있었고, 화면이 늘 때마다
 * 배열과 라우트 두 곳을 손으로 맞춰야 했다. 소속과 순서를 경로에서 읽으면 맞출 곳이
 * 하나다 — 그것이 이 파일이다.
 *
 * **라벨 매핑은 남는다.** 기능 칸(`lookup`)을 사람이 읽는 말(`조회`)로 옮기는 표는
 * 어차피 어딘가 있어야 한다. 그것은 FR-NAV-23 이 금지한 "카테고리 배열" 이 아니다 —
 * 소속도 순서도 정하지 않는다. #15(i18n)가 오는 날 이 자리가 번역표의 자리가 된다.
 *
 * 룬을 쓰지 않는 순수 함수다. `pathname` 과 `routeId` 만 받으므로 `localStorage` 나
 * 브라우저 상태에 닿지 않는다 — 서버가 그린 탭과 하이드레이션한 탭이 같아야 한다
 * (NFR-NAV-1).
 */

/** 기능 칸 → 화면 이름. */
const FEATURE_LABELS: Record<string, string> = {
	lookup: '조회',
	algs: '기준공식',
	quiz: '퀴즈',
	trace: '트레이싱'
};

/**
 * 형제 묶음. 키는 **기능 칸을 뺀 경로**, 값은 그 아래 실재하는 기능 칸이다.
 *
 * 형제는 "기능 칸만 다른 실재 화면" 이다 (FR-NAV-4). `/3x3/bld/trace` 는 그 관계에
 * 있는 화면이 없으므로 **여기 없다** — 없으면 탭바를 안 그린다 (FR-NAV-5).
 *
 * #19(스티커 외우기)·#21(메모 훈련)·#23(타이머)이 들어오면 `/3x3/bld` 키가 생기고
 * 트레이싱에 훈련 탭바가 붙는다. 그때 이 표에 한 줄이 늘 뿐 규칙은 안 바뀐다.
 */
const SIBLING_GROUPS: Record<string, readonly string[]> = {
	'/3x3/bld/3style/corner': ['lookup', 'algs', 'quiz']
};

export interface NavTab {
	href: string;
	label: string;
	feature: string;
	active: boolean;
}

/** 라우트 id 에서 동적 칸(`[code]`·`[...rest]`)을 걷어낸다. */
const staticSegments = (routeId: string): string[] =>
	routeId.split('/').filter((s) => s !== '' && !s.startsWith('['));

/**
 * 이 화면이 달 탭.
 *
 * **동적 세그먼트 화면은 부모의 탭을 물려받는다** (AD-NAV-B, 결정 4). 기준 상세
 * `/…/algs/[code]` 는 자기 형제가 없지만 목록의 항목이므로 목록의 탭 셋을 그대로
 * 단다. 라우트 id 에서 `[code]` 를 걷어내면 그 계산이 저절로 된다 — 상세마다 예외
 * 분기를 적지 않는다.
 *
 * 형제가 없으면 빈 배열이다. 자기 자신만 있는 탭바는 이동 수단이 아니라 장식이다.
 */
export function tabsFor(pathname: string, routeId: string | null): NavTab[] {
	const segments = staticSegments(routeId ?? pathname);
	if (segments.length === 0) return [];

	const feature = segments[segments.length - 1];
	const parent = '/' + segments.slice(0, -1).join('/');
	const siblings = SIBLING_GROUPS[parent];
	if (!siblings || !siblings.includes(feature)) return [];

	/*
	 * 활성 판정은 정확 일치가 아니라 **경로 안에 그 기능 칸이 있는가** 다 (AD-NAV-J).
	 * 정확 일치(`pathname === href`)로는 상세 화면에서 목록 탭이 꺼진다.
	 */
	const here = pathname.split('/').filter((s) => s !== '');
	return siblings.map((f) => ({
		href: `${parent}/${f}`,
		label: FEATURE_LABELS[f] ?? f,
		feature: f,
		active: here.includes(f)
	}));
}

/** 홈인가. 홈에는 탭바가 없다 — 홈이 곧 지도다 (FR-NAV-6). */
export function isHome(pathname: string): boolean {
	return pathname === '/';
}
