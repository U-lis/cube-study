/**
 * `three` 의 지연 로드 검사 (NFR-TR-2).
 *
 * 지키려는 것은 하나다 — **조회·기준공식·퀴즈만 쓰는 사용자가 gzip ~85KB 를 받지 않는다.**
 * 스크램블 워커(`bundle-worker.test.ts`)와 반대다. 그쪽은 번들 크기를 재지 않고 메인 스레드
 * 블로킹만 봤지만, 여기는 정확히 번들 크기가 이유다. 그래서 검사도 파일을 따로 둔다
 * (GLOBAL §4.5).
 *
 * 빌드가 없으면 skip 하지 않는다 — 조용히 빠지는 검사는 검사가 아니다. 산출물이 없거나
 * 소스보다 오래됐으면 직접 빌드한다 — 검사 파일이 둘이라 빌드는 `ensure-build.ts` 가
 * 잠금으로 한 번만 돌린다 (`bundle-worker.test.ts` 와 같은 규율).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { ensureBuild } from './ensure-build.js';
import { dirname, join, relative, resolve } from 'node:path';

const BUILD = 'build';
const IMMUTABLE = join(BUILD, '_app', 'immutable');
const VIEWER_SRC = 'src/lib/cube/cube3d.ts';

/** `three` 만 갖는 식별자. 우리 코드에도 다른 의존성에도 없다. */
const MARKER = 'THREE.WebGLRenderer';

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
	);
}

const sources = () =>
	walk('src').filter((f) => /\.(ts|js|svelte)$/.test(f) && !f.endsWith('.d.ts'));

let clientFiles: string[] = [];
let entryScripts = '';

beforeAll(() => {
	ensureBuild();
	clientFiles = walk(IMMUTABLE).filter((f) => f.endsWith('.js'));
	entryScripts = readFileSync(join(BUILD, 'index.html'), 'utf8');
}, 300_000);

describe('소스 규약', () => {
	it("`three` 정적 import 는 뷰어 본체 한 곳뿐이다", () => {
		const hits = sources().filter((f) => /from\s+'three'/.test(readFileSync(f, 'utf8')));
		expect(hits).toEqual([VIEWER_SRC]);
	});

	it('`three` 의 addon 도 뷰어 본체에서만 들어온다', () => {
		const hits = sources().filter((f) => /from\s+'three\//.test(readFileSync(f, 'utf8')));
		expect(hits).toEqual([VIEWER_SRC]);
	});

	/**
	 * 뷰어 본체를 가리키는 곳은 전부 `await import(` 여야 한다. `import type` 은 예외다 —
	 * 타입은 컴파일에서 지워지므로 런타임 의존이 아니고, 오히려 래퍼가 `Mark` 를 쓰려면
	 * 있어야 한다 (PLAN "타입만 쓰는 곳도 import type 으로").
	 */
	it('뷰어 본체를 부르는 곳이 전부 동적 import 다', () => {
		const offenders: string[] = [];
		for (const f of sources()) {
			if (f === VIEWER_SRC) continue;
			for (const line of readFileSync(f, 'utf8').split('\n')) {
				if (!/['"][^'"]*cube3d\.js['"]/.test(line)) continue;
				if (/^\s*import\s+type\s/.test(line)) continue;
				if (/await\s+import\(/.test(line)) continue;
				offenders.push(`${f}: ${line.trim()}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('단위 테스트가 보는 순수부는 `three` 를 끌어오지 않는다', () => {
		const pure = readFileSync('src/lib/cube/cube3d-map.ts', 'utf8');
		expect(pure).not.toMatch(/from\s+'three/);
	});

	/** FR-TR-15. 반투명으로 뒷면을 새게 하지 않는다. */
	it('뷰어에 반투명이 없다', () => {
		const src = readFileSync(VIEWER_SRC, 'utf8');
		expect(src).not.toMatch(/transparent\s*:/);
		expect(src).not.toMatch(/opacity/);
	});

	/** AD-12. 뷰어는 "무슨 색을 어디에" 만 안다. */
	it('뷰어가 트레이싱 어휘를 모른다', () => {
		const src = readFileSync(VIEWER_SRC, 'utf8') + readFileSync('src/lib/cube/cube3d-map.ts', 'utf8');
		// 주석은 설계 근거를 적느라 이 단어들을 쓴다. 코드에서만 본다.
		const code = src
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.split('\n')
			.filter((l) => !/^\s*(\/\/|\*)/.test(l))
			.join('\n');
		for (const word of ['buffer', 'speffz', 'Speffz', 'scramble', 'target', 'trace']) {
			expect(code, word).not.toContain(word);
		}
	});
});

describe('빌드 산출물', () => {
	/**
	 * `three` 청크는 `Cube3D.svelte` 가 라우트 그래프에 닿아야 나온다. `/trace` 라우트는
	 * Phase 3 이 만들므로 그때까지 어디서도 import 되지 않고, 그러면 청크가 생길 수 없다.
	 * 그래서 분기 조건을 "청크가 있는가"(자기충족적)가 아니라 **"라우트가 뷰어에 닿는가"**
	 * 라는 소스 사실에 둔다 (`bundle-worker.test.ts` 와 같은 구조). Phase 3 이 붙는 순간
	 * 자동으로 뒤집힌다.
	 */
	const wired = walk('src/routes').some(
		(f) => /\.(svelte|ts)$/.test(f) && readFileSync(f, 'utf8').includes('Cube3D')
	);

	/**
	 * 진입 스크립트와 그것이 정적으로 끌어오는 청크 전부.
	 * `index.html` 이 참조하는 파일에서 시작해 `import ... from "..."` 을 따라간다 —
	 * 이것이 사용자가 첫 화면에서 실제로 받는 집합이다.
	 */
	function initialGraph(): string[] {
		const seen = new Set<string>();
		const queue = [...entryScripts.matchAll(/_app\/immutable\/[^"']+\.js/g)].map((m) => m[0]);
		while (queue.length) {
			const rel = queue.pop()!;
			if (seen.has(rel) || !existsSync(join(BUILD, rel))) continue;
			seen.add(rel);
			const src = readFileSync(join(BUILD, rel), 'utf8');
			// 상대 경로 import 를 그 파일의 위치 기준으로 푼다.
			for (const m of src.matchAll(/from\s*["'](\.[^"']+\.js)["']/g)) {
				queue.push(relative(BUILD, resolve(BUILD, dirname(rel), m[1])).replace(/\\/g, '/'));
			}
		}
		return [...seen];
	}

	it('초기 청크에 `three` 가 없다 (NFR-TR-2)', () => {
		const leaked = initialGraph().filter((rel) =>
			readFileSync(join(BUILD, rel), 'utf8').includes(MARKER)
		);
		expect(leaked).toEqual([]);
	});

	it('조회·기준공식·퀴즈 라우트의 스크립트에 `three` 가 없다', () => {
		const routeFiles = clientFiles.filter((f) => /[\\/]nodes[\\/]/.test(f));
		const leaked = routeFiles.filter((f) => readFileSync(f, 'utf8').includes(MARKER));
		expect(leaked).toEqual([]);
	});

	it(
		wired
			? '`three` 가 별도 청크로 갈라져 있고 PWA 가 그것을 precache 한다'
			: '(Phase 3 이전) 라우트가 뷰어에 닿지 않으므로 클라이언트 번들에 `three` 가 없다',
		() => {
			const withThree = clientFiles.filter((f) => readFileSync(f, 'utf8').includes(MARKER));
			if (!wired) {
				expect(withThree).toEqual([]);
				return;
			}
			expect(withThree.length).toBeGreaterThan(0);
			// 오프라인에서 3D 가 죽지 않아야 한다 (NFR-TR-3).
			const sw = readFileSync(join(BUILD, 'sw.js'), 'utf8');
			for (const f of withThree) expect(sw, f).toContain(f.slice(BUILD.length + 1));
		}
	);
});
