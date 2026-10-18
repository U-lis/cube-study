/**
 * 앱 서비스워커 — vite-pwa `injectManifest` 소스 (#33, SPEC FR-SW).
 *
 * 0.6.0 까지는 `generateSW` 가 이 파일을 만들었다. 릴레이 `sw.js` 를 `importScripts`
 * 할 자리가 없어서 옮겼다. 그때의 옵션을 코드로 같은 동작으로 다시 만든다:
 *
 *   globPatterns                  → vite.config.ts `injectManifest.globPatterns`
 *   ignoreURLParametersMatching   → (2) precacheAndRoute 인자
 *   navigateFallback: '/'         → (3) NavigationRoute
 *   registerType: 'autoUpdate'    → (4) skipWaiting + clients.claim
 *
 * push · notificationclick 은 이 파일이 갖지 않는다 — 릴레이 `sw.js` 가 맡는다
 * (연동 문서 §3). 두 쪽이 다 핸들러를 가지면 알림이 두 번 뜬다.
 */
/// <reference lib="webworker" />
import { PUBLIC_PUSH_RELAY_URL } from '$env/static/public';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

/*
 * (1) 릴레이 조각. 맨 위에서 부른다 — 릴레이가 자기 push 리스너를 먼저 건다.
 *
 * 실패해도 앱 SW 설치는 성공해야 한다 (FR-SW-4). 릴레이가 꺼져 있거나 오프라인에서
 * 처음 설치되면 여기서 던진다. 그때는 알림만 안 될 뿐 앱은 오프라인으로 돈다.
 *
 * ES 모듈 SW 에서는 `importScripts` 가 없다. SvelteKit 은 빌드에서 classic 으로 내고
 * dev 에서는 SW 를 쓰지 않으므로(`sw.svelte.ts`) 상관없다.
 */
try {
	importScripts(PUBLIC_PUSH_RELAY_URL + '/sw.js');
} catch {
	// 알림 없이 돈다
}

/*
 * (2) 프리캐시. **쿼리를 전부 무시한다.**
 *
 * 프리캐시 키는 `…/lookup.html` 인데 이동 요청은 `…/lookup?c=LB` 로 온다. 기본값
 * (`utm_*`·`fbclid` 만 무시)으로는 둘이 안 맞아 폴백 `/` 로 떨어지고, 홈이 뜬다 —
 * 설치한 사람의 북마크가 통째로 죽는다. 0.5.0 에서 `notation.spec.ts` 가 잡았다.
 * 알림이 여는 `quiz?c=KG` 도 같은 길을 탄다.
 */
precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] });
cleanupOutdatedCaches();

// (3) 프리캐시에 없는 이동 요청은 `/` 로 — SPA 가 라우팅을 이어받는다.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/')));

// (4) autoUpdate. `sw.svelte.ts` 의 controllerchange 새로고침이 여기서 시작된다.
self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
