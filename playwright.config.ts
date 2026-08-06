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
		command: 'pnpm run preview -- --port 4174',
		port: 4174,
		reuseExistingServer: true,
		timeout: 60_000
	}
});
