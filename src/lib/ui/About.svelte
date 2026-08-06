<!-- 앱 정보 모달. <dialog> 를 써서 ESC 닫기와 포커스 트랩을 브라우저에 맡긴다. -->
<script lang="ts">
	let dialog: HTMLDialogElement | undefined = $state();

	const APP_NAME = 'CubeStudy';

	const info = [
		{ label: '제작자', value: 'ulismoon' },
		{ label: '버전', value: __APP_VERSION__ },
		{ label: '커밋', value: __COMMIT_HASH__ }
	];

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
	.copyright {
		margin: 1rem 0 0.9rem;
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
