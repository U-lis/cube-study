<!--
	서랍 메뉴 (#42, SPEC FR-DR).

	모달 `<dialog>` 다 (D-1). ESC · 포커스 가두기를 브라우저에 맡기고, Android Chrome 은
	모달 dialog 를 뒤로가기로 닫는다. 히스토리를 건드리지 않으므로 `backguard` 의 감시
	항목과 부딪히지 않는다 — shallow routing 으로 만들었다면 정면으로 부딪혔다
	(`.dc_workspace/SVELTE.md` 9절).

	아코디언 내용은 언제나 DOM 에 있다. 접기는 `hidden` 이다 (`{#if}` 금지 규약).
	펼침은 저장하지 않는다 — 열 때마다 지금 경로의 묶음만 편다 (FR-DR-5).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { menuFor } from './nav.js';
	import { settings } from './settings.svelte.js';
	import { push } from './push.svelte.js';

	let { onabout }: { onabout: () => void } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let menu = $derived(menuFor(page.url.pathname));
	let expanded = $state<Record<string, boolean>>({});

	const THEME_LABEL = { system: '시스템', light: '라이트', dark: '다크' } as const;
	const NOTIFY = '/settings/notify';

	export function open() {
		expanded = Object.fromEntries(
			menu.flatMap((e) => (e.kind === 'group' ? [[e.id, e.containsCurrent]] : []))
		);
		dialog?.showModal();
	}

	export function close() {
		dialog?.close();
	}

	function about() {
		close();
		onabout();
	}

	let notifyValue = $derived(push.assumedOn ? `매일 ${push.daily}` : '꺼짐');
</script>

<dialog
	bind:this={dialog}
	data-drawer
	aria-label="메뉴"
	onclick={(e) => e.target === dialog && close()}
>
	<div class="sheet">
		<div class="head">
			<div class="name">
				<strong>CubeStudy</strong>
				<span data-drawer-version>{__APP_VERSION__}</span>
			</div>
			<button type="button" class="x" data-drawer-close aria-label="메뉴 닫기" onclick={close}>
				<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg>
			</button>
		</div>

		<!--
			`<nav>` 가 아니라 `<div class="list">` 다. 서랍은 그 자체가 이름 붙은
			dialog 다 (aria-label="메뉴"). #46 에서 하단 탭바가 제거되면서 앱 전체에
			`<nav>` 가 사라졌고, `conventions.spec.ts` 가 그것을 지킨다.
		-->
		<div class="list">
			<a href="/" class="row" data-drawer-link="/" aria-current={page.url.pathname === '/' ? 'page' : undefined} onclick={close}>
				<span>홈</span>
				{#if page.url.pathname === '/'}<span class="here">지금 화면</span>{/if}
			</a>

			<h2>3BLD</h2>
			{#each menu as entry (entry.kind === 'group' ? entry.id : entry.link.href)}
				{#if entry.kind === 'link'}
					<a
						href={entry.link.href}
						class="row"
						class:current={entry.link.current}
						data-drawer-link={entry.link.href}
						aria-current={entry.link.current ? 'page' : undefined}
						onclick={close}
					>
						<span>{entry.link.label}</span>
						{#if entry.link.current}<span class="here">지금 화면</span>{/if}
					</a>
				{:else}
					<button
						type="button"
						class="row group"
						data-drawer-group={entry.id}
						aria-expanded={!!expanded[entry.id]}
						aria-controls="drawer-{entry.id.replaceAll('/', '-')}"
						onclick={() => (expanded[entry.id] = !expanded[entry.id])}
					>
						<span>{entry.label}</span>
						<svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
							<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
					<div
						id="drawer-{entry.id.replaceAll('/', '-')}"
						class="links"
						data-drawer-panel={entry.id}
						hidden={!expanded[entry.id]}
					>
						{#each entry.links as l (l.href)}
							<a
								href={l.href}
								class="row sub"
								class:current={l.current}
								data-drawer-link={l.href}
								aria-current={l.current ? 'page' : undefined}
								onclick={close}
							>
								<span>{l.label}</span>
								{#if l.current}<span class="here">지금 화면</span>{/if}
							</a>
						{/each}
					</div>
				{/if}
			{/each}

			<h2 class="sep">설정</h2>
			<a
				href={NOTIFY}
				class="row"
				class:current={page.url.pathname === NOTIFY}
				data-drawer-link={NOTIFY}
				aria-current={page.url.pathname === NOTIFY ? 'page' : undefined}
				onclick={close}
			>
				<span class="label">
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
					</svg>
					알림
				</span>
				<span class="value" data-drawer-value="알림">{notifyValue}</span>
			</a>
			<button
				type="button"
				class="row"
				data-theme-toggle
				data-theme={settings.theme}
				onclick={() => settings.cycleTheme()}
				aria-label={`테마 전환 (현재 ${THEME_LABEL[settings.theme]})`}
			>
				<span class="label">
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
						<path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
					</svg>
					테마
				</span>
				<span class="value" data-drawer-value="테마">{THEME_LABEL[settings.theme]}</span>
			</button>
			<button type="button" class="row" data-about-open onclick={about}>
				<span class="label">
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
						<circle cx="12" cy="7.6" r="1.2" fill="currentColor" />
						<path d="M12 11v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
					</svg>
					앱 정보
				</span>
			</button>
		</div>
	</div>
</dialog>

<style>
	dialog {
		/* 왼쪽 서랍. 기본 dialog 의 가운데 배치를 걷어낸다 */
		position: fixed;
		inset: 0 auto 0 0;
		width: min(19rem, calc(100vw - 3.5rem));
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		color: var(--fg);
		background: var(--bg);
		border: none;
		border-radius: 0 16px 16px 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 0.4rem 0.6rem 1.2rem;
		background: var(--surface);
	}
	.name {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.name strong {
		font-size: 1.1rem;
	}
	.name span {
		font-family: var(--mono);
		font-size: 0.75rem;
		color: var(--muted);
	}
	.x {
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.list {
		display: flex;
		flex-direction: column;
		padding: 0.5rem 0 1.5rem;
	}
	h2 {
		margin: 0.9rem 0 0.2rem;
		padding: 0 1.2rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--muted);
	}
	h2.sep {
		margin-top: 0.7rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
		margin-inline: 1.2rem;
		padding-inline: 0;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		min-height: 48px;
		padding: 0 1.2rem;
		font: inherit;
		font-size: 1rem;
		color: var(--fg);
		text-align: left;
		text-decoration: none;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.row.sub {
		min-height: 44px;
		padding-left: 2.4rem;
		font-size: 0.95rem;
	}
	.row.current {
		color: var(--accent);
		font-weight: 600;
	}
	.here {
		font-size: 0.75rem;
		font-weight: 400;
	}
	.label {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
	}
	.value {
		font-size: 0.88rem;
		color: var(--muted);
	}
	.chev {
		color: var(--muted);
		transition: transform 0.15s;
	}
	.group[aria-expanded='true'] .chev {
		transform: rotate(180deg);
	}
	.links {
		display: flex;
		flex-direction: column;
	}
	.links[hidden] {
		display: none;
	}
</style>
