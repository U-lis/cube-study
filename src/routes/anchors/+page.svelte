<!-- 기준공식 브라우저 (FR-11). 담당 케이스 수는 숫자만. 백분율·우선순위 문구 금지 (NFR-9). -->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import { targetText } from '$lib/domain/validate.js';

	let { data } = $props();
	let rows = $derived(data.rows);
	let directCount = $derived(data.directCount);
</script>

<svelte:head><title>3-Style Corner — 기준공식</title></svelte:head>

<h1>기준공식</h1>

<ul>
	{#each rows as r (r.name)}
		<li>
			<a href="/anchors/{r.name}" data-anchor={r.name}>
				<div class="head">
					<span class="name">{r.name}</span>
					<span class="count" data-count={r.count}>{r.count}</span>
				</div>
				<Alg parts={[{ text: r.alg, role: 'plain' }]} size="sm" />
				<div class="entries">
					<span>{targetText(r.entry1)}</span>
					<span>{targetText(r.entry2)}</span>
				</div>
			</a>
		</li>
	{/each}
	{#if directCount > 0}
		<li>
			<a href="/anchors/direct" data-anchor="direct">
				<div class="head">
					<span class="name">기준 없음</span>
					<span class="count" data-count={directCount}>{directCount}</span>
				</div>
				<div class="note">셋업으로 어느 기준에도 닿지 않아 전용 알고리즘을 씁니다</div>
			</a>
		</li>
	{/if}
</ul>

<style>
	h1 {
		font-size: 1.3rem;
		margin: 1rem 0 0.8rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	a {
		display: block;
		padding: 0.75rem;
		color: inherit;
		text-decoration: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.4rem;
	}
	.name {
		font-family: var(--mono);
		font-size: 1.35rem;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.1em;
	}
	.count {
		font-family: var(--mono);
		font-size: 1.05rem;
		color: var(--muted);
	}
	.entries {
		display: flex;
		flex-direction: column;
		margin-top: 0.35rem;
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--muted);
	}
	.note {
		font-size: 0.85rem;
		color: var(--muted);
	}
</style>
