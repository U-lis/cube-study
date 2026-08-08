import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	reporter: [['list']],
	use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure' },
	projects: [
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }
	],
	webServer: {
		// pnpm 은 `--` 를 스크립트에 그대로 넘긴다. `pnpm run preview -- --port 4174` 는
		// `vite preview -- --port 4174` 가 되어 포트 지정이 먹지 않고 기본 4173 에 뜬다.
		// 그러면 여기서 4174 를 기다리다 60초 뒤에 죽는다. 빌드와 서빙을 나눠 부른다.
		command: 'pnpm run build && pnpm run preview:only --port 4174',
		port: 4174,
		reuseExistingServer: true,
		timeout: 60_000
	}
});
