<script lang="ts">
	import '$lib/styles/app.css';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { settings } from '$lib/ui/settings.svelte.js';
	import { sw } from '$lib/ui/sw.svelte.js';
	import About from '$lib/ui/About.svelte';
	import Toast from '$lib/ui/Toast.svelte';
	let { children } = $props();

	/**
	 * 서비스워커 등록.
	 *
	 * vite-pwa 가 만드는 registerSW.js 는 './sw.js' 상대경로를 써서 /anchors 같은
	 * 하위 경로로 첫 진입하면 /anchors/sw.js 를 찾아 404 가 난다. 절대경로로 직접 등록한다.
	 * SvelteKit 이 app.html 을 제어하므로 자동 주입도 되지 않는다.
	 *
	 * dev 서버에는 sw.js 자체가 없어 등록을 건너뛴다. 조건 없이 부르면 개발 중
	 * 콘솔에 404 가 계속 찍히고, 등록에 성공하더라도 SW 캐시가 HMR 을 가린다.
	 */
	// 등록·갱신 로직은 sw.svelte.ts 에 있다. 하이드레이션 시점이라 load 가 이미
	// 지나갔을 수 있으므로 그 경우 이벤트를 기다리지 않는다.
	if (browser) {
		if (document.readyState === 'complete') void sw.register();
		else window.addEventListener('load', () => void sw.register(), { once: true });
	}
	/**
	 * 설치 프롬프트.
	 *
	 * 브라우저는 설치 팝업을 스스로 띄우지 않는다. beforeinstallprompt 를 잡아
	 * 보관했다가 사용자가 버튼을 눌렀을 때 prompt() 를 불러야 한다.
	 * 조건 미달이거나 이미 설치됐으면 이벤트가 오지 않으므로 버튼도 안 나온다.
	 * iOS Safari 는 이 이벤트 자체가 없다 — 공유 시트로만 설치된다.
	 */
	let installPrompt = $state<{ prompt: () => Promise<unknown> } | null>(null);
	if (browser) {
		window.addEventListener('beforeinstallprompt', (e) => {
			e.preventDefault(); // 막지 않으면 브라우저가 제 타이밍에 처리해 버린다
			installPrompt = e as unknown as { prompt: () => Promise<unknown> };
		});
		window.addEventListener('appinstalled', () => (installPrompt = null));
	}

	async function install() {
		const p = installPrompt;
		if (!p) return;
		installPrompt = null; // prompt() 는 이벤트당 한 번만 쓸 수 있다
		await p.prompt();
	}

	let about: ReturnType<typeof About> | undefined = $state();
	const THEME_LABEL = { system: '시스템', light: '라이트', dark: '다크' } as const;
	const nav = [
		{ href: '/', label: '조회' },
		{ href: '/anchors', label: '기준공식' },
		{ href: '/quiz', label: '퀴즈' }
	];
</script>

<!--
	manifest 링크. SvelteKit 이 app.html 을 제어해서 vite-pwa 가 주입하지 못한다.
	이게 없으면 브라우저가 manifest 를 읽지 않아 설치 대상으로 인식조차 안 한다.
	dev 빌드에는 manifest 파일이 없으므로 건다.
-->
<svelte:head>
	{#if !dev}<link rel="manifest" href="/manifest.webmanifest" />{/if}
</svelte:head>

<div class="shell">
	<div class="bar">
		{#if installPrompt}
			<button type="button" data-install onclick={install}>설치</button>
		{/if}
		<button
			type="button"
			data-theme-toggle
			data-theme={settings.theme}
			onclick={() => settings.cycleTheme()}
			aria-label="테마 전환">{THEME_LABEL[settings.theme]}</button
		>
		<button type="button" data-about-open onclick={() => about?.open()} aria-label="앱 정보">
			<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
				<circle cx="12" cy="7.6" r="1.2" fill="currentColor" />
				<path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			</svg>
		</button>
	</div>
	<About bind:this={about} />

	{#if sw.justUpdated}
		<Toast text="새 버전으로 업데이트했습니다" onclose={() => sw.dismiss()} />
	{/if}
	<main>{@render children()}</main>
	<nav>
		{#each nav as item (item.href)}
			<a href={item.href} class:on={page.url.pathname === item.href}>{item.label}</a>
		{/each}
	</nav>
</div>

<style>
	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		max-width: 720px;
		margin: 0 auto;
	}
	.bar {
		display: flex;
		justify-content: flex-end;
		padding: 0.4rem 0.9rem 0;
	}
	.bar {
		gap: 0.4rem;
	}
	/* 설치 버튼은 설치 가능할 때만 나타난다. 눈에 띄어야 하지만 강요하지 않는다. */
	.bar button[data-install] {
		color: var(--accent);
		border-color: var(--accent);
	}
	.bar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 32px;
		padding: 0 0.6rem;
		font-size: 0.78rem;
		color: var(--muted);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
	}
	main {
		flex: 1;
		padding: 0 0.9rem 1rem;
	}
	nav {
		position: sticky;
		bottom: 0;
		display: flex;
		background: var(--surface);
		border-top: 1px solid var(--border);
	}
	nav a {
		flex: 1;
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		color: var(--muted);
		text-decoration: none;
	}
	nav a.on {
		color: var(--accent);
		font-weight: 600;
	}
</style>
