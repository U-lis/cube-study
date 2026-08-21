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
				navigateFallback: '/'
			}
		})
	]
});
