/**
 * 스크램블 Worker 의 빌드 산출물·소스 검사 (NFR-TR-1).
 *
 * 지키려는 것은 하나다 — **`Cube.initSolver()` 가 메인 스레드에서 불리지 않는다.**
 * 실측 1695ms / heap +37MB / RSS +102MB 이고, 조회·퀴즈만 쓰는 사용자가 그것을 떠안으면 안 된다.
 *
 * **번들 크기를 재지 않는다.** `solve.js` 는 gzip 7.1KB 라 메인 청크에 섞여도 실패가 아니다
 * (SPEC NFR-TR-1 개정). 보는 것은 "워커가 별도 청크로 갈라졌는가" 와 "호출이 워커에만 있는가" 다.
 *
 * 빌드가 없으면 skip 하지 않는다 — 조용히 빠지는 검사는 검사가 아니다
 * (`tests/unit/e2e-tags.test.ts:3-9` 와 같은 규율). 다만 CI 는 `pnpm build` 보다 `pnpm test` 를
 * 먼저 돌리므로(.github/workflows/ci.yml), 산출물이 없거나 소스보다 오래됐으면 **직접
 * 빌드한다**(`ensure-build.ts`). 빠지지도 않고, 낡은 산출물로 통과하지도 않는다.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { ensureBuild } from './ensure-build.js';
import { join } from 'node:path';

const BUILD = 'build';
const IMMUTABLE = join(BUILD, '_app', 'immutable');
const WORKER_SRC = 'src/lib/cube/scramble.worker.ts';

/** `solve.js` 에만 있는 식별자. `cube.js` 에는 없다 — 풀이기가 그 청크에 있다는 표시다. */
const MARKER = 'initSolver';

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
	);
}

/**
 * 주석과 타입 선언(`.d.ts`)을 걷어낸 소스에서 `pattern` 을 포함한 파일 경로.
 *
 * 단순 `grep -rn initSolver src/` 로는 안 된다 — 워커를 쓰는 **이유** 를 적은 주석과
 * `cubejs.d.ts` 의 `static initSolver(): void` 선언이 걸린다. 둘 다 호출이 아니고, 오히려
 * 있어야 하는 것들이다. 검사가 보는 것은 "실행되는 코드에서 부르는가" 다.
 */
function sourcesContaining(pattern: string): string[] {
	return walk('src')
		.filter((f) => /\.(ts|js|svelte)$/.test(f) && !f.endsWith('.d.ts'))
		.filter((f) => stripComments(readFileSync(f, 'utf8')).includes(pattern));
}

/** 블록 주석과 주석만 있는 줄을 지운다. 줄 끝 주석은 문자열 안의 `//` 를 삼킬 수 있어 두 종류만 본다. */
function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.filter((l) => !/^\s*(\/\/|\*)/.test(l))
		.join('\n');
}

let clientFiles: string[] = [];
let entryScripts = '';

beforeAll(() => {
	ensureBuild();
	clientFiles = walk(IMMUTABLE).filter((f) => f.endsWith('.js'));
	entryScripts = readFileSync(join(BUILD, 'index.html'), 'utf8');
}, 180_000);

describe('소스 규약', () => {
	it('initSolver 호출은 워커 파일 한 곳뿐이다', () => {
		expect(sourcesContaining(MARKER)).toEqual([WORKER_SRC]);
	});

	it("앱 코드는 `cubejs` 진입점을 import 하지 않는다 — 계속 `cubejs/lib/cube.js` 를 쓴다", () => {
		expect(sourcesContaining("from 'cubejs'")).toEqual([WORKER_SRC]);
	});

	it('워커 생성은 Vite 표준 패턴 한 줄이다 — 수동 청크 설정을 넣지 않는다', () => {
		const src = readFileSync('src/lib/ui/scramble.svelte.ts', 'utf8');
		expect(src).toContain("new URL('../cube/scramble.worker.ts', import.meta.url)");
		expect(readFileSync('vite.config.ts', 'utf8')).not.toContain('manualChunks');
	});

	it('자체 풀이기·pruning table 이 저장소에 없다 (FR-TR-1)', () => {
		expect(sourcesContaining('kociemba')).toEqual([]);
		expect(walk('src').filter((f) => /prun|moveTable/i.test(f))).toEqual([]);
	});
});

describe('빌드 산출물', () => {
	/**
	 * 워커 청크는 워커를 import 하는 모듈이 라우트 그래프에 닿아야 나온다.
	 * `/trace` 라우트는 Phase 3 이 만든다 — 그때까지 `ScrambleSource` 는 어디서도 import 되지
	 * 않으므로 청크가 생길 수 없다. 그래서 분기 조건을 "청크가 있는가"(자기충족적)가 아니라
	 * **"라우트가 워커에 닿는가"** 라는 소스 사실에 둔다. Phase 3 이 붙는 순간 자동으로 뒤집힌다.
	 */
	const wired = walk('src/routes').some(
		(f) => /\.(svelte|ts)$/.test(f) && readFileSync(f, 'utf8').includes('scramble')
	);

	it('풀이기 초기화가 앱 진입 스크립트에 섞이지 않는다', () => {
		const initial = [...entryScripts.matchAll(/_app\/immutable\/[^"']+\.js/g)].map((m) => m[0]);
		const leaked = initial.filter((rel) =>
			readFileSync(join(BUILD, rel), 'utf8').includes(`.${MARKER}=`)
		);
		expect(leaked).toEqual([]);
	});

	it(
		wired
			? '워커가 별도 청크로 갈라져 있고 PWA 가 그것을 precache 한다'
			: '(Phase 3 이전) 라우트가 워커에 닿지 않으므로 클라이언트 번들에 풀이기가 없다',
		() => {
			const withSolver = clientFiles.filter((f) => readFileSync(f, 'utf8').includes(MARKER));
			if (!wired) {
				expect(withSolver).toEqual([]);
				return;
			}
			expect(withSolver.length).toBeGreaterThan(0);
			// 오프라인에서 스크램블 생성이 죽지 않아야 한다 (NFR-TR-3).
			const sw = readFileSync(join(BUILD, 'sw.js'), 'utf8');
			for (const f of withSolver) {
				expect(sw, f).toContain(f.slice(BUILD.length + 1));
			}
		}
	);
});
