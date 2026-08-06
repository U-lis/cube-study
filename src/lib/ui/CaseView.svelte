<!-- 조회 결과 표시 (FR-6 ~ FR-10) -->
<script lang="ts">
	import Alg from './Alg.svelte';
	import SegToggle from './SegToggle.svelte';
	import { settings } from './settings.svelte.js';
	import { formatAlg, displayMoves } from '$lib/domain/format.js';
	import { targetText } from '$lib/domain/validate.js';
	import { anchorOrder, anchorRef, refAlg, refLabel } from '$lib/domain/anchor.js';
	import { type CaseEntry, type Dataset } from '$lib/domain/types.js';

	let { entry, ds, stale = false }: { entry: CaseEntry; ds: Dataset; stale?: boolean } = $props();

	let mode = $derived(settings.mode);
	let notation = $derived(settings.notation);
	let parts = $derived(formatAlg(entry, mode, notation));
	let moves = $derived(displayMoves(entry, mode, notation));
	let ref = $derived(anchorRef(entry));
	let anchorData = $derived(ref ? ds.anchors[ref.name] : null);
	/** 역방향이면 뒤집은 무브열을 보여준다. 원문을 보여주면 반대로 돌리게 된다. */
	let anchorAlg = $derived(ref ? refAlg(ds, ref) : '');
	let anchorCount = $derived(anchorOrder(ds).length);
</script>

<section class="case" class:stale data-case={entry.case}>
	<header>
		<h1>{entry.case}</h1>
		<div class="targets">
			<span>{targetText(entry.target1)}</span>
			<span>{targetText(entry.target2)}</span>
		</div>
	</header>

	<div class="toggles">
		<SegToggle
			name="mode"
			bind:value={settings.mode}
			options={[
				{
					value: 'setup',
					label: 'setup',
					hint: '기준공식 + 셋업',
					title: `기준공식 ${anchorCount}개만 외우고 셋업으로 푼다`
				},
				{
					value: 'direct',
					label: 'optimized',
					hint: '전용 최적 공식',
					title: '이 케이스 전용 알고리즘. 378개를 다 외워야 한다'
				}
			]}
		/>
		<SegToggle
			name="notation"
			bind:value={settings.notation}
			options={[
				{
					value: 'strict',
					label: 'structural',
					hint: '구조 · 상쇄 전',
					title: '커뮤테이터 구조를 드러낸 표기. 외울 때 쓴다'
				},
				{
					value: 'compact',
					label: 'compact',
					hint: '실행 · 상쇄 후',
					title: '실제로 돌리는 무브 열. 상쇄가 적용되어 더 짧다'
				}
			]}
		/>
	</div>

	{#if mode === 'setup'}
		<div class="block">
			{#if !ref}
				<div class="badge" data-badge="direct-anchor">기준공식 없음 — 전용 알고리즘</div>
			{:else}
				<!-- data-inverse 는 아래 역 케이스 링크가 쓰고 있어 이름을 나눈다 -->
				<div class="anchor-name" data-anchor={ref.name} data-anchor-inverse={ref.inverse}>
					{refLabel(ref)}
				</div>
				<dl>
					{#if entry.setup.S}
						<dt>셋업</dt>
						<dd><Alg parts={[{ text: entry.setup.S, role: 'setup' }]} size="sm" /></dd>
					{/if}
					<dt>기준공식</dt>
					<dd>
						<Alg parts={[{ text: anchorAlg, role: 'plain' }]} size="sm" />
						{#if ref.inverse}
							<span class="inverse-note" data-inverse-note>{ref.name} 의 역방향</span>
						{/if}
					</dd>
					<dt>입구</dt>
					<dd class="entries">
						<span>{targetText(anchorData!.entry1)}</span>
						<span>{targetText(anchorData!.entry2)}</span>
					</dd>
				</dl>
			{/if}
		</div>
	{:else}
		<div class="block">
			<dl>
				<dt>인서트 (A)</dt>
				<dd><Alg parts={[{ text: entry.direct.A, role: 'insert' }]} size="sm" /></dd>
				<dt>교환 (B)</dt>
				<dd><Alg parts={[{ text: entry.direct.B, role: 'interchange' }]} size="sm" /></dd>
				<dt>종류</dt>
				<dd class="plain">{entry.direct.type}</dd>
			</dl>
		</div>
	{/if}

	<div class="main">
		<Alg {parts} size="lg" />
		<div class="meta">
			<span>{moves}수</span>
			{#if notation === 'compact' && entry.sameAlg}
				<span class="badge" data-badge="same-alg">최종 무브 열이 같습니다</span>
			{/if}
		</div>
	</div>

	<footer>
		<a href="/?c={entry.inverse}" data-inverse={entry.inverse}>역 케이스 {entry.inverse}</a>
	</footer>
</section>

<style>
	.case {
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1rem;
		background: var(--surface);
		transition: opacity 160ms ease;
	}
	.case.stale {
		opacity: 0.45;
	}
	header {
		text-align: center;
	}
	h1 {
		margin: 0;
		font-family: var(--mono);
		font-size: 2.6rem;
		letter-spacing: 0.15em;
	}
	.targets {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-top: 0.35rem;
		font-size: 0.9rem;
		color: var(--muted);
		font-family: var(--mono);
	}
	.toggles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		margin: 0.9rem 0;
	}
	.block {
		padding: 0.75rem;
		background: var(--bg);
		border-radius: 8px;
	}
	.anchor-name {
		font-family: var(--mono);
		font-size: 1.9rem;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.1em;
	}
	.inverse-note {
		display: block;
		font-size: 0.75rem;
		color: var(--muted);
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 0.8rem;
		margin: 0.5rem 0 0;
		align-items: baseline;
	}
	dt {
		font-size: 0.8rem;
		color: var(--muted);
		white-space: nowrap;
	}
	dd {
		margin: 0;
		min-width: 0;
	}
	dd.plain {
		font-family: var(--mono);
		font-size: 0.9rem;
	}
	.entries {
		display: flex;
		flex-direction: column;
		font-family: var(--mono);
		font-size: 0.85rem;
	}
	.main {
		margin-top: 0.9rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.badge {
		padding: 0.15rem 0.5rem;
		font-size: 0.78rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
	}
	footer {
		margin-top: 0.9rem;
		text-align: right;
	}
	footer a {
		font-family: var(--mono);
		font-size: 0.9rem;
		color: var(--accent);
	}
</style>
