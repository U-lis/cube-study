<!-- 조회 결과 표시 (FR-6 ~ FR-10). 암기 체크박스는 FR-MC-3(a). -->
<script lang="ts">
	import Alg from './Alg.svelte';
	import SegToggle from './SegToggle.svelte';
	import { settings } from './settings.svelte.js';
	import { memorize } from './memorize.svelte.js';
	import { formatAlg, displayMoves } from '$lib/domain/format.js';
	import { targetText } from '$lib/domain/validate.js';
	import { anchorOrder, anchorRef, refAlg, refLabel } from '$lib/domain/anchor.js';
	import {
		altRoutes,
		learnedAnchors,
		shouldOfferAlternatives,
		type Alternatives
	} from '$lib/domain/alternatives.js';
	import { loadAlternatives } from '$lib/data/loader.js';
	import { type CaseEntry, type Dataset } from '$lib/domain/types.js';

	/**
	 * from: 어느 기준을 거쳐 이 화면에 왔는가. 역케이스 링크에 그대로 실어 보낸다.
	 * 안 실어 보내면 역케이스를 한 번 타는 순간 돌아갈 길이 사라진다.
	 * 역케이스는 378/378 이 같은 기준에 속하므로(tests/unit/data-regression) 목적지는
	 * 여전히 지금 보는 케이스를 담고 있는 페이지다.
	 */
	let {
		entry,
		ds,
		stale = false,
		from = null
	}: { entry: CaseEntry; ds: Dataset; stale?: boolean; from?: string | null } = $props();

	let mode = $derived(settings.mode);
	let notation = $derived(settings.notation);
	let parts = $derived(formatAlg(entry, mode, notation));
	let moves = $derived(displayMoves(entry, mode, notation));
	let ref = $derived(anchorRef(entry));
	let anchorData = $derived(ref ? ds.anchors[ref.name] : null);
	/** 역방향이면 뒤집은 무브열을 보여준다. 원문을 보여주면 반대로 돌리게 된다. */
	let anchorAlg = $derived(ref ? refAlg(ds, ref) : '');
	let anchorCount = $derived(anchorOrder(ds).length);

	/**
	 * 지금 보고 있는 표기(setup / direct=optimized) 의 암기 상태.
	 * mode 가 바뀌면 값도 갈아탄다 — 라벨을 함께 갈아 사용자가 이유를 안다.
	 * SSR/CSR 모두 memorize 스토어의 초기값이 빈 Set 이라 SSR 은 항상 false 로
	 * 렌더된다 (AD-4). 하이드레이션 후 localStorage 값이 들어와도 요소 개수·크기가
	 * 그대로라 레이아웃이 밀리지 않는다.
	 */
	let isMemorized = $derived(memorize.isChecked(mode, entry.case));
	let memorizeLabel = $derived(mode === 'setup' ? 'setup 암기' : 'optimized 암기');

	/**
	 * "아는 기준으로 풀기". 배정된 기준을 아직 안 배웠을 때만 뜬다.
	 *
	 * 배운 기준은 자기 케이스 2개의 암기 체크에서 유추한다 (alternatives.ts).
	 * 데이터는 필요할 때만 부른다 — 아무 기준도 안 배운 사용자(기본 상태)는
	 * 이 조건에 걸리지 않으므로 파일을 받지 않는다.
	 */
	let learned = $derived(learnedAnchors(ds, memorize.setupChecked));
	let offer = $derived(mode === 'setup' && !!ref && shouldOfferAlternatives(entry, learned));
	let alt = $state<Alternatives | null>(null);
	$effect(() => {
		if (offer && !alt) loadAlternatives().then((a) => (alt = a));
	});
	let routes = $derived(offer && alt ? altRoutes(ds, alt, entry, learned) : []);
</script>

<section class="case" class:stale data-case={entry.case}>
	<header>
		<h1>{entry.case}</h1>
		<div class="targets">
			<span>{targetText(entry.target1)}</span>
			<span>{targetText(entry.target2)}</span>
		</div>
	</header>

	<!--
		FR-MC-3(a): 지금 보는 표기 기준의 암기 체크. 라벨에 어느 기준인지 명시해
		mode 토글을 바꿨을 때 체크가 함께 바뀌는 이유를 사용자가 안다.
		AD-6: SegToggle 재사용하지 않는다 (boolean on/off 에 세그먼티드는 맞지 않는다).
		FR-MC-4: 라벨 전체를 클릭 영역으로 두고 min-height 44px.
	-->
	<label class="memorize" data-memorize={mode}>
		<input
			type="checkbox"
			checked={isMemorized}
			onchange={() => memorize.toggle(mode, entry.case)}
			data-memorize-input
		/>
		<span data-memorize-label>{memorizeLabel}</span>
	</label>

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

		<!--
			배정된 기준을 아직 안 배웠을 때만 붙는 블록. 배우면 사라진다.
			주된 답(위 블록)은 건드리지 않는다 — 여기가 답을 갈아치우면 "setup 암기"
			체크가 무엇을 외웠다는 표시인지 흔들린다.

			무브 수와 증가분을 함께 적는다. 아는 공식으로 푸는 대가가 몇 수인지
			모르면 이 목록이 그냥 "더 나은 답" 처럼 보인다.
		-->
		{#if routes.length > 0}
			<div class="block alt" data-alt-block>
				<p class="alt-head">
					아직 <b>{ref!.name}</b> 를 안 배웠다면 — 아는 기준으로
				</p>
				<ul>
					{#each routes as r (r.name + String(r.inverse))}
						<li data-alt-route={r.name}>
							<span class="alt-anchor">{refLabel(r)}</span>
							{#if r.setup}
								<Alg parts={[{ text: r.setup, role: 'setup' }]} size="sm" />
							{:else}
								<span class="nosetup">셋업 없음</span>
							{/if}
							<span class="alt-moves">
								{r.moves}수<span class="alt-extra">
									{r.extraMoves > 0 ? `+${r.extraMoves}` : r.extraMoves === 0 ? '±0' : r.extraMoves}
								</span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
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
		<a href="/?c={entry.inverse}{from ? `&from=${from}` : ''}" data-inverse={entry.inverse}
			>역 케이스 {entry.inverse}</a
		>
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
	/*
	 * NFR-MC-2: 이 블록의 높이·폭이 상태에 따라 흔들리면 안 된다.
	 * min-height 로 44px 를 확보하고, 체크박스 크기는 CSS 로 고정한다.
	 * mode 가 바뀌면서 라벨 문자열이 바뀌지만 justify-content:center 로 좌우가
	 * 흔들려도 아래 블록의 top 은 min-height 로 잠긴다.
	 */
	.memorize {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 44px;
		margin-top: 0.6rem;
		font-size: 0.9rem;
		color: var(--fg);
		cursor: pointer;
		user-select: none;
	}
	.memorize input[type='checkbox'] {
		width: 20px;
		height: 20px;
		margin: 0;
		flex: 0 0 auto;
		cursor: pointer;
	}
	.block {
		padding: 0.75rem;
		background: var(--bg);
		border-radius: 8px;
	}
	/*
	 * "아는 기준으로" 블록. 주된 답과 같은 상자를 쓰되 한 단계 낮춰 보이게 한다 —
	 * 테두리만 두고 배경을 비운다. 같은 무게로 놓으면 답이 둘로 보인다.
	 */
	.alt {
		margin-top: 0.5rem;
		background: none;
		border: 1px solid var(--border);
	}
	.alt-head {
		margin: 0 0 0.45rem;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.alt-head b {
		font-family: var(--mono);
		font-weight: 600;
		color: var(--fg);
	}
	.alt ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.alt li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.alt-anchor {
		font-family: var(--mono);
		font-weight: 600;
		color: var(--accent);
		min-width: 2.6em;
	}
	/* 무브 수는 오른쪽 끝에 붙이고 자릿수 폭을 고정한다 (NFR-MC-2). */
	.alt-moves {
		margin-left: auto;
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.alt-extra {
		display: inline-block;
		min-width: 2.4em;
		text-align: right;
	}
	.alt .nosetup {
		font-size: 0.8rem;
		color: var(--muted);
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
