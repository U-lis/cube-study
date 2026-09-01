<!--
	최근 기록 모달 (FR-TR-23).

	`About.svelte` 와 **같은 방식** 이다 — `<dialog>` + `showModal()`. ESC 닫기와
	포커스 트랩을 브라우저에 맡기고, 바깥 클릭은 `e.target === dialog` 로 받는다.
	모달을 손으로 다시 만들면 그 세 가지 중 하나는 반드시 빠진다.

	본문에서 목록을 빼는 이유는 길이다. 기록이 50건까지 쌓이는데 화면에 늘어놓으면
	트레이싱 화면이 기록 화면이 된다.

	─── 표로 적는다 (요구 7) ───────────────────────────────────
	줄마다 폭이 달라 자릿수가 어긋나면 두 기록을 비교할 수 없다 — 기록을 남기는
	이유가 비교인데 그 일을 읽는 사람이 눈으로 해야 했다. 네 칸을 `<table>` 의 열로
	세우고 숫자 칸은 `tabular-nums` + 오른쪽 정렬로 자릿수를 맞춘다.

	`<ul>` 이 아니라 `<table>` 인 이유는 머리글이다. 열이 무엇인지 한 번 적어두면
	"초/타깃" 같은 꼬리표를 50줄에 되풀이하지 않아도 된다.
	────────────────────────────────────────────────────────────

	─── 톤 (NFR-TR-5) ─────────────────────────────────────────
	최고 기록 강조도 배지도 추이 그래프도 없다. 시간·조각·초당 타깃·정오 네 칸을
	사실로 적는다. 정답과 오답의 배경색이 다르지도 않다.

	원시 타깃 개수 대신 **초/타깃** 을 적는다. `ms` 하나로는 판끼리 비교가 안 되기
	때문이다 — 8타깃 20초와 12타깃 20초는 다른 성적인데 표에서는 같은 줄로 보인다.
	나눠 놓으면 그 열을 훑는 것으로 빨라지고 있는지가 읽힌다. 평균도 추세선도 여전히
	없다 — 통계는 범위 밖이다 (#23).
	────────────────────────────────────────────────────────────
-->
<script lang="ts">
	import { tracing } from './tracing.svelte.js';
	import { formatMs, msPerTarget, recordKindLabel } from '$lib/domain/tracing.js';

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
			<div class="records" data-records>
				<table>
					<thead>
						<tr>
							<th scope="col" class="num">시간</th>
							<th scope="col">조각</th>
							<th scope="col" class="num">초/타깃</th>
							<th scope="col">판정</th>
						</tr>
					</thead>
					<tbody>
						{#each tracing.records as r (r.at + '/' + r.pieceKind)}
							<tr data-record>
								<td class="num">{formatMs(r.ms)}</td>
								<td>{recordKindLabel(r)}</td>
								<td class="num" data-per-target>{msPerTarget(r.ms, r.targetCount)}</td>
								<td>{r.correct ? '정답' : '오답'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
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
		/* 50건까지 쌓인다. 모달이 화면을 넘기면 안쪽에서 스크롤한다. */
		max-height: min(50vh, 20rem);
		overflow-y: auto;
		margin: 0 0 1rem;
		font-size: 0.78rem;
		color: var(--muted);
	}
	table {
		width: 100%;
		/* 열 폭을 내용이 아니라 표가 정한다. 줄마다 칸이 흔들리면 비교가 안 된다. */
		table-layout: fixed;
		border-collapse: collapse;
		font-family: var(--mono);
	}
	/* 머리글이 스크롤을 따라 남는다 — 50줄을 내려가도 열 이름이 보인다. */
	th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0 0.4rem 0.3rem 0;
		font-weight: 600;
		text-align: left;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	td {
		padding: 0.15rem 0.4rem 0.15rem 0;
		color: var(--fg);
	}
	th:last-child,
	td:last-child {
		padding-right: 0;
	}
	/*
	 * 숫자 칸. `tabular-nums` 가 글자 폭을 고르게 하고 오른쪽 정렬이 자릿수를
	 * 세로로 맞춘다 (요구 7). 둘 중 하나만 있으면 여전히 어긋나 보인다.
	 */
	.num {
		font-variant-numeric: tabular-nums;
		text-align: right;
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
