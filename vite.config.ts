import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * `cubejs/lib/solve.js` 의 첫 줄을 고친다.
 *
 * 그 파일은 `Cube = this.Cube || require('./cube')` 로 시작한다. CommonJS 에서
 * 최상위 `this` 는 `exports` 지만, 이 파일에는 `module.exports` 대입이 없어서
 * 번들러가 ES 모듈로 보고 최상위 `this` 를 `undefined` 로 바꾼다. 그러면 첫 줄에서
 * `undefined.Cube` 를 읽다 죽고, **`require` 로 떨어지는 대비 경로에 닿지도 못한다.**
 *
 * 죽는 곳이 스크램블 워커라 증상이 조용하다 — 페이지는 멀쩡히 뜨고 "준비 중" 에서
 * 영원히 멈춘다. dev 서버는 esbuild 가 CJS 를 제대로 감싸서 멀쩡하고, 빌드만 깨진다.
 *
 * 그래서 대비 경로를 **유일한** 경로로 만든다. 라이브러리의 동작은 바뀌지 않는다 —
 * 우리 번들에는 `this.Cube` 를 심어주는 전역 스크립트 태그 같은 것이 애초에 없다.
 * `enforce: 'pre'` 라 CommonJS 변환보다 먼저 돈다. Worker 번들은 **별도 rollup 실행**
 * 이라 `plugins` 가 아니라 `worker.plugins` 로도 넣어야 한다 — 정작 이 파일이 필요한
 * 곳이 워커 쪽이다.
 */
function fixCubejsSolveThis() {
	const MARK = "this.Cube || require('./cube')";
	return {
		name: 'cubejs-solve-this',
		enforce: 'pre' as const,
		transform(code: string, id: string) {
			if (!id.includes('cubejs/lib/solve.js') || !code.includes(MARK)) return null;
			return { code: code.replace(MARK, "require('./cube')"), map: null };
		}
	};
}

/** 빌드 시점의 커밋 해시. git 이 없는 환경에서도 빌드가 깨지지 않게 한다. */
function commitHash(): string {
	try {
		return execSync('git rev-parse --short=8 HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return 'unknown';
	}
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__COMMIT_HASH__: JSON.stringify(commitHash())
	},
	worker: { plugins: () => [fixCubejsSolveThis()] },
	plugins: [
		fixCubejsSolveThis(),
		sveltekit({
			/*
			 * 자산 경로를 절대경로로 낸다 (`./_app/…` 대신 `/_app/…`).
			 *
			 * 기본값 `relative: true` 는 각 페이지가 자기 위치를 기준으로 자산을 가리키게
			 * 한다. 그 자체는 문제가 없는데, **서비스워커의 `navigateFallback: '/'` 와
			 * 겹치면 깊은 경로에서 깨진다** — SW 는 프리캐시에 없는 이동 요청(`/a/b/c/d`,
			 * 확장자가 없다)에 `index.html` 을 내주고, 그 HTML 의 `./_app/…` 은 브라우저가
			 * `/a/b/c/_app/…` 으로 푼다. 404 가 나고 화면은 홈에서 멈춘다.
			 *
			 * 0.4.2 까지는 라우트가 한 칸(`/quiz`)이라 `./_app/…` 이 우연히 `/_app/…` 과
			 * 같아서 드러나지 않았다. 라우트를 축으로 옮기면서 실제로 깨졌다 —
			 * `notation.spec.ts` 가 두 번째 이동에서 잡았다 (SW 가 그때 제어를 잡는다).
			 *
			 * 이 앱은 언제나 도메인 루트에서 서비스되므로 절대경로로 잃는 것이 없다.
			 */
			paths: { relative: false },
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ strict: true })
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				// 홈 화면 라벨은 short_name 이 쓰인다. 앱 이름은 정보 모달과 맞춘다.
				name: 'CubeStudy',
				short_name: 'CubeStudy',
				description: '코너 3-style (UBL 버퍼) 조회 및 퀴즈',
				lang: 'ko',
				start_url: '/',
				display: 'standalone',
				background_color: '#111113',
				theme_color: '#111113',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icon-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// json 을 빠뜨리면 오프라인에서 데이터 로드가 통째로 죽는다 (NFR-8)
				globPatterns: ['**/*.{js,css,html,json,svg,png,woff2}'],
				/*
				 * 프리캐시를 찾을 때 **쿼리를 전부 무시한다.**
				 *
				 * 프리캐시 키는 `…/lookup.html` 인데 이동 요청은 `…/lookup?c=LB` 로 온다.
				 * 기본값(`utm_*`·`fbclid` 만 무시)으로는 이 둘이 안 맞아 `navigateFallback`
				 * 으로 떨어진다. 0.4.2 까지는 그 폴백이 `/` = **조회 화면 자신** 이라
				 * 사고가 드러나지 않았다 — 엉뚱한 HTML 을 받아도 같은 화면이었고, 쿼리는
				 * 어차피 클라이언트가 URL 에서 읽었다.
				 *
				 * 이제 `/` 는 홈이다. 그대로 두면 서비스워커가 잡은 뒤부터 `?c=` 가 붙은
				 * 모든 주소가 홈을 띄운다 — 설치한 사람의 북마크가 통째로 죽는다.
				 * `notation.spec.ts` 가 두 번째 이동에서 이것을 잡았다.
				 *
				 * 쿼리는 화면 상태일 뿐 다른 문서를 가리키지 않으므로(`?c=`·`?from=`)
				 * 무시해도 잃는 것이 없다.
				 */
				ignoreURLParametersMatching: [/.*/],
				navigateFallback: '/'
			}
		})
	]
});
