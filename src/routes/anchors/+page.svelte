<!--
	기준공식 브라우저 (FR-11). 담당 케이스 수는 숫자만. 백분율·우선순위 문구
	금지 (NFR-9, NFR-MC-5).

	FR-MC-11: 각 카드에 `{setup 체크}/{전체}` 진도를 병기한다. 데이터셋은
	컴포넌트에서 loadDataset() 으로 얻는다 — +page.ts 반환값을 키우면
	프리렌더 산출물이 커지고, loader.ts:24-29 캐시 덕에 재호출은 사실상 무비용.
	SSR 에서는 ds 가 undefined 라 progressMap 이 비고 `0/{count}` 로 렌더된다 (AD-4).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Alg from '$lib/ui/Alg.svelte';
	import { targetText } from '$lib/domain/validate.js';
	import { formatCommutator } from '$lib/domain/format.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { anchorProgress } from '$lib/domain/memorize.js';
	import { memorize } from '$lib/ui/memorize.svelte.js';
	import { ANCHOR_DIRECT, type Dataset } from '$lib/domain/types.js';

	let { data } = $props();
	let rows = $derived(data.rows);
	let directCount = $derived(data.directCount);

	/**
	 * ds 는 CSR 에서만 채운다. onMount 는 브라우저 전용이라 프리렌더에서
	 * loadDataset 이 실행되지 않는다. 로더는 캐시가 있어 다른 라우트에서
	 * 이미 데이터를 불러왔다면 파싱 없이 즉시 리턴한다 (loader.ts:24-29).
	 */
	let ds = $state<Dataset | undefined>(undefined);
	onMount(async () => {
		ds = await loadDataset();
	});

	/**
	 * 기준별 setup 체크 수. Map 은 항상 anchors 의 모든 키를 담고 있어
	 * (memorize.ts 의 anchorProgress 초기화) `?? 0` 이 없어도 안전하지만
	 * ds 가 아직 undefined 인 SSR·초기 CSR 구간을 위해 방어를 유지한다.
	 */
	let progressMap = $derived(
		ds ? anchorProgress(ds, memorize.setupChecked) : new Map<string, number>()
	);

	/**
	 * "기준 없음" 카드용 별도 집계. anchorProgress 는 Dataset.anchors 키
	 * (ANCHOR_DIRECT 아님) 만 순회하므로 이 그룹은 여기서 직접 계산한다.
	 * setupChecked 순회량이 렌더당 최대 378 이라 O(N) 로 충분하다.
	 */
	let directCheckedCount = $derived.by(() => {
		if (!ds) return 0;
		const cases = ds.cases;
		let n = 0;
		for (const code of memorize.setupChecked) {
			const entry = cases[code];
			if (entry?.setup.anchor === ANCHOR_DIRECT) n++;
		}
		return n;
	});
</script>

<svelte:head><title>3-Style Corner — 기준공식</title></svelte:head>

<h1>기준공식</h1>

<ul>
	{#each rows as r (r.name)}
		<!--
			[A, B] 를 무브열 위에 둔다. 이 화면만 켜두고 기준 여섯 개를 외우는
			용도라, 구조를 먼저 보고 무브로 확인하는 순서가 맞다.
			분해되지 않는 기준은 이 줄을 통째로 걸러 빈 대괄호를 만들지 않는다.
		-->
		{@const comm = formatCommutator(r.alg)}
		<li>
			<a href="/anchors/{r.name}" data-anchor={r.name}>
				<div class="head">
					<span class="name">{r.name}</span>
					<!--
						FR-MC-11: `{setup 체크}/{전체}`. `.checked-num` 에 자릿수 min-width
						를 예약해 값 변화로 카드 폭이 밀리지 않는다 (AD-4).
					-->
					<span class="count" data-count={r.count} data-progress>
						<span class="checked-num" style="min-width: {String(r.count).length}ch"
							>{progressMap.get(r.name) ?? 0}</span
						>/{r.count}
					</span>
				</div>
				{#if comm}
					<Alg parts={comm} size="sm" />
				{/if}
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
					<span class="count" data-count={directCount} data-progress>
						<span class="checked-num" style="min-width: {String(directCount).length}ch"
							>{directCheckedCount}</span
						>/{directCount}
					</span>
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
		/*
		 * FR-MC-11: tabular-nums 로 자릿수 폭을 통일하고, `.checked-num` 에
		 * min-width 를 자릿수로 예약해 값이 늘어도 우측 `/{전체}` 위치가
		 * 그대로다 (T3-6, AD-4).
		 */
		font-variant-numeric: tabular-nums;
	}
	.count .checked-num {
		display: inline-block;
		text-align: right;
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
