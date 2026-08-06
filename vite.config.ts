import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

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
	plugins: [
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
				name: '3-Style Corner Trainer',
				short_name: '3style',
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
