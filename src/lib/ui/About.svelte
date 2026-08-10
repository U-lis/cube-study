<!-- 앱 정보 모달. <dialog> 를 써서 ESC 닫기와 포커스 트랩을 브라우저에 맡긴다. -->
<script lang="ts">
	import { sw } from './sw.svelte.js';
	import { memorize } from './memorize.svelte.js';

	let dialog: HTMLDialogElement | undefined = $state();

	const APP_NAME = 'CubeStudy';

	const info = [
		{ label: '제작자', value: 'ulismoon' },
		{ label: '버전', value: __APP_VERSION__ },
		{ label: '커밋', value: __COMMIT_HASH__ }
	];

	/**
	 * FR-MC-22: 전체 해제는 되돌릴 수 없어 2단계 확인을 거친다.
	 * idle → 첫 클릭 → confirming → 두 번째 클릭 → 실행 후 idle.
	 * <dialog> onclose 에서도 idle 로 리셋 — 모달을 닫았다 열면 확인 상태가
	 * 남아 있어 다음에 열었을 때 오해를 부른다 (AD-8).
	 */
	let clearState = $state<'idle' | 'confirming'>('idle');

	function askClear() {
		clearState = 'confirming';
	}

	function confirmClear() {
		memorize.clearAll();
		clearState = 'idle';
	}

	export function open() {
		dialog?.showModal();
	}
</script>

<dialog
	bind:this={dialog}
	data-about
	onclick={(e) => e.target === dialog && dialog.close()}
	onclose={() => (clearState = 'idle')}
>
	<div class="body">
		<h2 data-info="이름">{APP_NAME}</h2>
		<dl>
			{#each info as row (row.label)}
				<dt>{row.label}</dt>
				<dd data-info={row.label}>{row.value}</dd>
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

		<!--
			FR-MC-21, 22: 암기 표시 전체 해제. 되돌릴 수 없다.
			2단계 확인 — 브라우저 confirm() 을 쓰지 않고 인라인 문구 전환으로 처리한다.
			두 상태 모두 min-height 44px, 색상 대비를 살려 파괴적 동작임을 알린다.
		-->
		{#if clearState === 'idle'}
			<button
				type="button"
				class="clear"
				data-clear-memorize="idle"
				onclick={askClear}
			>
				암기 표시 전체 해제
			</button>
		{:else}
			<button
				type="button"
				class="clear confirming"
				data-clear-memorize="confirming"
				onclick={confirmClear}
			>
				정말 해제합니다 (되돌릴 수 없음)
			</button>
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
	/*
	 * FR-MC-21, 22: 전체 해제 버튼. idle 은 업데이트 확인 버튼과 시각적으로
	 * 대등하되 파괴적 동작임을 알리도록 문구가 명확하다. confirming 상태는
	 * insert 색으로 경고를 준다.
	 */
	.clear {
		margin-top: 0.5rem;
		color: var(--fg);
		background: transparent;
		border: 1px solid var(--border);
	}
	.clear.confirming {
		color: var(--bg);
		background: var(--insert);
		border-color: var(--insert);
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
