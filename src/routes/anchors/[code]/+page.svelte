<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import { targetText } from '$lib/domain/validate.js';
	import { formatCommutator } from '$lib/domain/format.js';
	import UpLink from '$lib/ui/UpLink.svelte';
	let { data } = $props();

	let comm = $derived(data.anchor ? formatCommutator(data.anchor.alg) : null);
</script>

<svelte:head><title>3-Style Corner — {data.code}</title></svelte:head>

<UpLink href="/anchors" label="기준공식" />

<h1>{data.isDirect ? '기준 없음' : data.code}</h1>

{#if data.anchor}
	<div class="anchor">
		{#if comm}
			<Alg parts={comm} size="md" />
		{/if}
		<Alg parts={[{ text: data.anchor.alg, role: 'plain' }]} size="md" />
		<div class="entries">
			<span>{targetText(data.anchor.entry1)}</span>
			<span>{targetText(data.anchor.entry2)}</span>
		</div>
	</div>
{/if}

<p class="count" data-count={data.cases.length}>{data.cases.length}개 케이스</p>

<ul>
	{#each data.cases as c (c.case)}
		<li>
			<a href="/?c={c.case}&from={data.code}">
				<span class="code">{c.case}</span>
				{#if c.setup.S}
					<Alg parts={[{ text: c.setup.S, role: 'setup' }]} size="sm" />
				{:else}
					<span class="nosetup">셋업 없음</span>
				{/if}
				<!-- 이 기준을 거꾸로 돌리는 케이스. 표시하지 않으면 셋업만 보고 정방향으로 돌린다 -->
				{#if c.setup.usesInverse}
					<span class="inverse" data-anchor-inverse={c.case}>역</span>
				{:else}
					<span class="inverse"></span>
				{/if}
				<span class="moves">{c.setup.moves}수</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	h1 {
		font-family: var(--mono);
		font-size: 1.8rem;
		letter-spacing: 0.1em;
		color: var(--accent);
		margin: 0 0 0.6rem;
	}
	.anchor {
		padding: 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.entries {
		display: flex;
		flex-direction: column;
		margin-top: 0.4rem;
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--muted);
	}
	.count {
		font-size: 0.85rem;
		color: var(--muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	a {
		display: grid;
		grid-template-columns: 3.2rem 1fr 1.2rem auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.7rem;
		color: inherit;
		text-decoration: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.code {
		font-family: var(--mono);
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: 0.1em;
	}
	.nosetup,
	.moves {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--muted);
	}
	.inverse {
		font-size: 0.75rem;
		text-align: center;
		color: var(--insert);
	}
</style>
