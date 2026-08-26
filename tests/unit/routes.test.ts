/**
 * 라우트 축과 버튼 이름의 정적 검사 (FR-NAV-17, 21).
 *
 * 파일 이름과 파일 텍스트만 본다. 화면을 열 필요가 없으므로 E2E 가 아니라 여기 있다 —
 * 프리뷰 서버를 띄우고 페이지를 로드하는 값을 치를 이유가 없다.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES = 'src/routes';

/** `src/routes` 아래 `+page.svelte` 들의 라우트 경로. */
function routePaths(dir = ROUTES, prefix = ''): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...routePaths(full, `${prefix}/${name}`));
		else if (name === '+page.svelte') out.push(prefix === '' ? '/' : prefix);
	}
	return out.sort();
}

describe('라우트 축 (FR-NAV-21)', () => {
	const paths = routePaths();

	it('홈 말고 한 칸짜리 라우트가 없다', () => {
		// 축은 `/{퍼즐}/{종목}/{방법}/{세트}/{기능}` 이다. 한 칸짜리가 생겼다는 것은
		// 누군가 축 밖에 화면을 세웠다는 뜻이다. 정본은 `.dc_workspace/SVELTE.md`.
		const shallow = paths.filter((p) => p !== '/' && p.split('/').filter(Boolean).length < 2);
		expect(shallow).toEqual([]);
	});

	it('기능 화면이 모두 퍼즐 칸 아래에 있다', () => {
		const outside = paths.filter((p) => p !== '/' && !p.startsWith('/3x3/'));
		expect(outside).toEqual([]);
	});

	it('중간 경로에 화면을 만들지 않는다', () => {
		// 경로의 앞 칸들은 이름 공간이지 화면이 아니다 (AD-NAV-1). `/3x3` 이나
		// `/3x3/bld` 에 페이지가 생기면 홈이 이미 낸 정보를 되풀이하게 된다.
		expect(paths).not.toContain('/3x3');
		expect(paths).not.toContain('/3x3/bld');
		expect(paths).not.toContain('/3x3/bld/3style');
		expect(paths).not.toContain('/3x3/bld/3style/corner');
	});

	it('지금 서 있는 화면은 여섯이다', () => {
		// 개수를 못 박아 두면 화면이 늘 때 이 검사가 먼저 걸린다 — 새 화면이 축을
		// 따르는지 보라는 신호다.
		expect(paths).toEqual([
			'/',
			'/3x3/bld/3style/corner/algs',
			'/3x3/bld/3style/corner/algs/[code]',
			'/3x3/bld/3style/corner/lookup',
			'/3x3/bld/3style/corner/quiz',
			'/3x3/bld/trace'
		]);
	});
});

describe('진행 버튼 이름 (FR-NAV-13)', () => {
	const sources = routePaths().map((p) =>
		readFileSync(join(ROUTES, p === '/' ? '' : p, '+page.svelte'), 'utf8')
	);

	it('화면의 진행 버튼에 data-action 을 쓰지 않는다', () => {
		// 화면의 진행은 `data-{동작}`, 자판 안의 편집은 `data-action="…"` 이다.
		// 둘이 섞이면 "이 버튼이 어느 부류인가" 를 눌러봐야 알게 된다.
		for (const src of sources) {
			expect(src).not.toMatch(/data-action="(submit|next|start|grade)"/);
		}
	});

	it('자판의 편집 버튼 이름은 그대로 둔다', () => {
		// 반대 방향의 검사다. `data-action` 자체를 금지한 것이 아니다 —
		// 그 카테고리의 이름이므로 패드 컴포넌트에는 남아 있어야 한다.
		const pad = readFileSync('src/lib/ui/StickerPad.svelte', 'utf8');
		expect(pad).toMatch(/data-action="(undo|clear|back|separator)"/);
	});
});
