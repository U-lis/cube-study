import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	reporter: [['list']],
	use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure' },
	/*
	 * desktop 이 전부를 돌고, mobile 은 뷰포트에 실제로 의존하는 것만 돈다.
	 *
	 * 170개 중 뷰포트가 결과를 바꾸는 것은 19개뿐이다 — 44px 터치 타깃(FR-MC-4)과
	 * 레이아웃 밀림(NFR-MC-2) 검사다. 나머지 151개를 두 번 돌리는 것은 같은 결과를
	 * 두 번 확인하는 것이고, E2E 가 CI 시간의 80% 를 쓰는 원인이었다.
	 *
	 * 태그를 빠뜨리면 그 테스트가 조용히 mobile 에서 빠진다. tests/unit/e2e-tags.test.ts
	 * 가 "뷰포트 신호를 쓰는데 @viewport 가 없는 테스트" 를 잡는다.
	 */
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@viewport/ },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }
	],
	webServer: {
		// pnpm 은 `--` 를 스크립트에 그대로 넘긴다. `pnpm run preview -- --port 4174` 는
		// `vite preview -- --port 4174` 가 되어 포트 지정이 먹지 않고 기본 4173 에 뜬다.
		// 그러면 여기서 4174 를 기다리다 60초 뒤에 죽는다. 빌드와 서빙을 나눠 부른다.
		/*
		 * 릴레이 주소를 이 서버의 `/__relay` 로 바꿔 빌드한다 (#33). E2E 가 바깥 릴레이에
		 * 기대지 않게 하려는 것이다 — 앱 SW 는 릴레이 `sw.js` 를 `importScripts` 하고,
		 * **업데이트 검사도 그 파일을 다시 받는다.** CI 러너에서 릴레이에 못 닿아
		 * "업데이트 확인" 이 실패했다. 빈 `sw.js` 를 빌드 뒤에 놓으므로 프리캐시에 안 든다.
		 * `client.js` 는 검사마다 `page.route` 로 가짜를 끼운다 (`notify.spec.ts`).
		 */
		command:
			'PUBLIC_PUSH_RELAY_URL=http://localhost:4174/__relay pnpm run build && mkdir -p build/__relay && : > build/__relay/sw.js && pnpm run preview:only --port 4174',
		port: 4174,
		reuseExistingServer: true,
		timeout: 60_000
	}
});
