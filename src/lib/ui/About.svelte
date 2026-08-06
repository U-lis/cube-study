<!-- 앱 정보 모달. <dialog> 를 써서 ESC 닫기와 포커스 트랩을 브라우저에 맡긴다. -->
<script lang="ts">
	import { browser } from '$app/environment';
	import { sw } from './sw.svelte.js';
	import { backGuard } from './backguard.svelte.js';

	let dialog: HTMLDialogElement | undefined = $state();

	const APP_NAME = 'CubeStudy';

	const info = [
		{ label: '제작자', value: 'ulismoon' },
		{ label: '버전', value: __APP_VERSION__ },
		{ label: '커밋', value: __COMMIT_HASH__ }
	];

	/**
	 * 뒤로가기 가드 진단.
	 *
	 * 실기기에서만 나는 문제라 개발 환경에서 재현이 안 된다. 화면에서 상태를
	 * 읽을 수 있어야 어디가 어긋났는지 안다.
	 */
	let diag = $derived([
		{ label: '표시 모드', value: backGuard.active ? 'standalone' : 'browser' },
		{
			label: '감시 항목',
			value: backGuard.planted ? '있음' : `없음 (시도 ${backGuard.attempts}회)`
		},
		{ label: 'history', value: browser ? String(history.length) : '-' },
		...(backGuard.lastError ? [{ label: '오류', value: backGuard.lastError }] : [])
	]);

	export function open() {
		dialog?.showModal();
	}
</script>

<dialog bind:this={dialog} data-about onclick={(e) => e.target === dialog && dialog.close()}>
	<div class="body">
		<h2 data-info="이름">{APP_NAME}</h2>
		<dl>
			{#each info as row (row.label)}
				<dt>{row.label}</dt>
				<dd data-info={row.label}>{row.value}</dd>
			{/each}
		</dl>
		<dl class="diag" data-diag>
			{#each diag as row (row.label)}
				<dt>{row.label}</dt>
				<dd data-diag={row.label}>{row.value}</dd>
			{/each}
		</dl>

		<!-- 자동 갱신이 막혔을 때 빠져나올 구멍. 새 버전이 있으면 화면이 새로고침된다. -->
		<button
			type="button"
			class="check"
			data-check-update
			onclick={() => sw.checkNow()}
			disabled={sw.checking}
		>
			{sw.checking ? '확인 중' : '업데이트 확인'}
		</button>
		{#if sw.message}
			<p class="msg" data-update-message>{sw.message}</p>
		{/if}

		<p class="copyright">MIT License · © 2026 ulismoon</p>
		<button type="button" data-about-close onclick={() => dialog?.close()}>닫기</button>
	</div>
</dialog>

<style>
	dialog {
		width: min(22rem, calc(100vw - 2rem));
		padding: 0;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}
	.body {
		padding: 1.1rem;
	}
	h2 {
		margin: 0 0 0.8rem;
		font-family: var(--mono);
		font-size: 1.3rem;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 0.9rem;
		margin: 0;
	}
	dt {
		font-size: 0.82rem;
		color: var(--muted);
	}
	dd {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.9rem;
		word-break: break-all;
	}
	.diag {
		margin-top: 0.9rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--border);
	}
	.diag dd {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.check {
		margin-top: 1rem;
		color: var(--fg);
		background: transparent;
		border: 1px solid var(--border);
	}
	.check:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.msg {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.copyright {
		margin: 0.9rem 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
	button {
		width: 100%;
		min-height: 44px;
		font-size: 0.95rem;
		color: var(--bg);
		background: var(--fg);
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
</style>
