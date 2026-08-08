<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import { targetText } from '$lib/domain/validate.js';
	import { formatCommutator } from '$lib/domain/format.js';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { memorize } from '$lib/ui/memorize.svelte.js';
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
		<!--
			FR-MC-3(b): 이 화면은 셋업 무브를 나열하는 화면이라 체크박스는 항상
			setup 기준으로 고정한다. 전역 mode 가 direct 여도 여기 표시는 setup.
			AD-7: 체크박스를 <a> 밖 형제로 둔다. <a> 안에 넣으면 클릭이 링크
			이동을 트리거하고 접근성도 깨진다.
		-->
		<li data-case-row={c.case}>
			<label class="memo" data-memorize-setup={c.case}>
				<input
					type="checkbox"
					checked={memorize.isChecked('setup', c.case)}
					onchange={() => memorize.toggle('setup', c.case)}
					data-memorize-input
				/>
			</label>
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
	li {
		display: flex;
		align-items: stretch;
		gap: 0.4rem;
	}
	/*
	 * FR-MC-4: 터치 대상 44px 이상. 라벨 너비도 고정해 <a> 그리드가 밀리지 않는다.
	 * AD-7: <a> 밖 형제이므로 클릭 이벤트가 링크와 독립이다.
	 */
	.memo {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		min-height: 44px;
		flex: 0 0 44px;
		cursor: pointer;
	}
	.memo input[type='checkbox'] {
		width: 20px;
		height: 20px;
		margin: 0;
		cursor: pointer;
	}
	a {
		flex: 1 1 auto;
		min-width: 0;
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
