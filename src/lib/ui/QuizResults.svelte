<!--
	퀴즈 결과 그리드 (SPEC FR-EX-R, GLOBAL AD-12).

	매일 퀴즈·시험이 함께 쓴다. 데이터 속성(`data-summary`, `data-result-case`,
	`data-verdict`, `data-kind`, `data-result`)은 매일 퀴즈 E2E 가 그대로 보므로
	바꾸지 않는다. settings 싱글톤을 import 하지 않는다 — notation 은 호출자가
	넘긴다.
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import { refLabel } from '$lib/domain/anchor.js';
	import { formatAlg, type AlgPart, type Mode, type Notation } from '$lib/domain/format.js';
	import { verdictText } from '$lib/domain/grade.js';
	import type { QuizAnswer, QuizResultRow } from '$lib/domain/session.js';
	import { targetText } from '$lib/domain/validate.js';

	interface Props {
		results: QuizResultRow[];
		mode: Mode;
		notation: Notation;
	}
	let { results, mode: _mode, notation }: Props = $props();

	function partsOf(a: QuizAnswer): AlgPart[] {
		const parts: AlgPart[] = [];
		if (a.moves.length > 0) parts.push({ text: a.moves.join(' '), role: 'plain' });
		if (a.ref) parts.push({ text: refLabel(a.ref), role: 'anchor' });
		return parts;
	}

	let correctCount = $derived(results.filter((r) => r.verdict?.kind === 'correct').length);
</script>

<p class="summary" data-summary>
	{results.length}문제 중 {correctCount}개 정답
</p>
<ol>
	{#each results as r, i (i)}
		<li data-result-case={r.entry.case}>
			<div class="row-head">
				<span class="row-case">{r.entry.case}</span>
				<span class="row-targets"
					>{targetText(r.entry.target1)} → {targetText(r.entry.target2)}</span
				>
			</div>
			<div class="mine">
				{#if partsOf(r.answer).length > 0}
					<Alg parts={partsOf(r.answer)} size="sm" />
				{:else}
					<span class="placeholder">입력 없음</span>
				{/if}
			</div>
			<div
				class="verdict"
				data-verdict
				data-kind={r.verdict?.kind ?? 'blank'}
				data-result={r.verdict?.kind === 'correct' ? 'ok' : 'bad'}
			>
				{r.verdict ? verdictText(r.verdict) : '답을 내지 않았습니다'}
			</div>
			{#if r.verdict?.kind !== 'correct'}
				<dl class="answer">
					<dt>direct</dt>
					<dd><Alg parts={formatAlg(r.entry, 'direct', notation)} size="sm" /></dd>
					<dt>setup</dt>
					<dd><Alg parts={formatAlg(r.entry, 'setup', notation)} size="sm" /></dd>
				</dl>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.summary {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}
	ol {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.row-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
	}
	.row-case {
		font-family: var(--mono);
		font-size: 1.2rem;
		letter-spacing: 0.1em;
	}
	.row-targets {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--muted);
	}
	.verdict {
		padding: 0.4rem 0.6rem;
		font-size: 0.9rem;
		border-radius: 6px;
		border: 1px solid var(--border);
	}
	/* 색은 `data-result` 하나만 본다 (규약 4.1) */
	.verdict[data-result='ok'] {
		color: var(--ok);
		border-color: var(--ok);
	}
	.verdict[data-result='bad'] {
		color: var(--danger);
		border-color: var(--danger);
	}
	.answer {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 0.7rem;
		margin: 0;
		align-items: baseline;
	}
	.answer dt {
		font-family: var(--mono);
		font-size: 0.78rem;
		color: var(--muted);
	}
	.answer dd {
		margin: 0;
		min-width: 0;
	}
	.placeholder {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
