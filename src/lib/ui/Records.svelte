<!--
	최근 기록 모달 (FR-TR-23).

	`About.svelte` 와 **같은 방식** 이다 — `<dialog>` + `showModal()`. ESC 닫기와
	포커스 트랩을 브라우저에 맡기고, 바깥 클릭은 `e.target === dialog` 로 받는다.
	모달을 손으로 다시 만들면 그 세 가지 중 하나는 반드시 빠진다.

	본문에서 목록을 빼는 이유는 길이다. 기록이 50건까지 쌓이는데 화면에 늘어놓으면
	트레이싱 화면이 기록 화면이 된다.

	─── 톤 (NFR-TR-5) ─────────────────────────────────────────
	최고 기록 강조도 배지도 추이 그래프도 없다. 시간·조각·타깃 수·정오 네 칸을
	줄로 적는다. 정답과 오답의 배경색이 다르지도 않다.
	────────────────────────────────────────────────────────────
-->
<script lang="ts">
	import { tracing } from './tracing.svelte.js';
	import { formatMs, RECORD_KIND_LABELS } from '$lib/domain/tracing.js';

	let dialog: HTMLDialogElement | undefined = $state();

	export function open() {
		dialog?.showModal();
	}
</script>

<dialog bind:this={dialog} data-records-modal onclick={(e) => e.target === dialog && dialog.close()}>
	<div class="body">
		<h2>최근 기록</h2>
		{#if tracing.records.length === 0}
			<p class="empty" data-records-empty>아직 기록이 없습니다</p>
		{:else}
			<ul class="records" data-records>
				{#each tracing.records as r (r.at + '/' + r.pieceKind)}
					<li data-record>
						<span class="t">{formatMs(r.ms)}</span>
						<span>{RECORD_KIND_LABELS[r.pieceKind]}</span>
						<span>타깃 {r.targetCount}</span>
						<span>{r.correct ? '정답' : '오답'}</span>
					</li>
				{/each}
			</ul>
		{/if}
		<button type="button" data-records-close onclick={() => dialog?.close()}>닫기</button>
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
		font-size: 1.1rem;
	}
	.empty {
		margin: 0 0 1rem;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.records {
		display: grid;
		gap: 0.25rem;
		/* 50건까지 쌓인다. 모달이 화면을 넘기면 안쪽에서 스크롤한다. */
		max-height: min(50vh, 20rem);
		overflow-y: auto;
		margin: 0 0 1rem;
		padding: 0;
		list-style: none;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.records li {
		display: flex;
		gap: 0.6rem;
		font-family: var(--mono);
	}
	.records .t {
		font-variant-numeric: tabular-nums;
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
