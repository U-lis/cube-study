<!-- 조회 (FR-3 ~ FR-10). sticky 결과: 입력이 줄어도 직전 결과를 지우지 않는다. -->
<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import CaseInput from '$lib/ui/CaseInput.svelte';
	import CaseView from '$lib/ui/CaseView.svelte';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { lookup, reasonText } from '$lib/domain/validate.js';
	import { loadDataset } from '$lib/data/loader.js';
	import type { CaseEntry, Dataset } from '$lib/domain/types.js';

	let ds = $state<Dataset | null>(null);
	let raw = $state('');
	let shown = $state<CaseEntry | null>(null);
	let caseInput: ReturnType<typeof CaseInput> | undefined = $state();

	/**
	 * 조회 화면은 입력으로 시작하는 화면이다. 들어오자마자 커서를 둔다.
	 *
	 * 모바일 키보드는 이걸로 올라올 수도, 안 올라올 수도 있다. iOS Safari 는
	 * 사용자 제스처 없는 focus() 로 키보드를 띄우지 않는다 — 브라우저 정책이라
	 * 우회할 방법이 없다. 안드로이드 크롬은 대체로 올라온다.
	 */
	$effect(() => {
		caseInput?.focus();
	});

	// page.url 은 컴포넌트 최상위에서 읽어야 한다 (비동기 콜백 안에서는 컨텍스트가 없다).
	let queryCase = $derived(page.url.searchParams.get('c'));

	/**
	 * 어느 기준에서 넘어왔는가. 기준 상세의 케이스 링크가 실어 보낸다.
	 * 하단 탭으로 직접 들어오면 from 이 없고, 그때는 링크도 없다.
	 *
	 * 이 화면은 프리렌더된다. 프리렌더 중에는 쿼리라는 것이 존재하지 않으므로
	 * searchParams 를 읽으면 빌드가 죽는다 — 브라우저에서만 읽는다.
	 * (queryCase 가 멀쩡한 것은 $effect 안에서만 쓰여 서버에서 평가되지 않기
	 * 때문이다. 마크업에서 쓰는 값은 그 보호를 못 받는다.)
	 *
	 * 데이터를 보고 실재하는 기준인지 확인하지는 않는다. 확인하려면 데이터셋
	 * 로드가 끝나야 하고, 그러면 링크가 한 박자 늦게 나타나며 화면을 민다.
	 * 주소를 손으로 고쳐 없는 기준을 적는 경우를 막자고 치를 값이 아니다.
	 */
	let from = $derived(browser ? page.url.searchParams.get('from') : null);
	let upLabel = $derived(from === 'direct' ? '기준 없음' : from);

	loadDataset().then((d) => (ds = d));

	$effect(() => {
		if (queryCase) raw = queryCase.toUpperCase().slice(0, 2);
	});

	let result = $derived(ds ? lookup(ds, raw) : ({ status: 'empty' } as const));

	$effect(() => {
		if (result.status === 'valid') {
			shown = result.entry;
			// 두 글자가 유효하게 차면 키보드를 내린다. 더 칠 것이 없는데 모바일에서는
			// 키보드가 화면 절반을 가려 정작 보러 온 공식이 안 보인다.
			//
			// 무효한 입력에서는 포커스를 유지한다. 볼 공식도 없고, 오타를 그 자리에서
			// 고치는 편이 낫다. 유효한 다른 케이스로 잘못 친 경우는 다시 탭하면
			// 값이 전체 선택되므로 두 글자만 다시 치면 된다 (CaseInput).
			caseInput?.blur();
		}
	});

	let stale = $derived(shown !== null && result.status !== 'valid');
</script>

<svelte:head><title>3-Style Corner — 조회</title></svelte:head>

{#if from}
	<UpLink href="/anchors/{from}" label={upLabel ?? ''} />
{/if}

<div class="top">
	<!-- X 는 결과까지 치운다. 포커스 초기화(다시 칠 준비)와 구분한다 -->
	<CaseInput bind:this={caseInput} bind:value={raw} onclear={() => (shown = null)} />
</div>

<!-- 보조 영역: 내용이 없으면 높이 0. 결과 블록을 밀어내지 않는다. -->
<div class="aux">
	{#if result.status === 'invalid'}
		<p class="reason" data-reason={result.reason.kind}>{reasonText(result.reason)}</p>
	{:else if result.status === 'partial'}
		<div class="candidates" data-count={result.candidates.length}>
			{#each result.candidates as c (c)}
				<button onclick={() => (raw = c)}>{c}</button>
			{/each}
		</div>
	{/if}
</div>

{#if shown && ds}
	<CaseView entry={shown} {ds} {stale} />
{:else if ds}
	<p class="hint">스티커 2글자를 입력하세요. 버퍼는 UBL (A/E/R)입니다.</p>
{/if}

<style>
	.top {
		position: sticky;
		top: 0;
		z-index: 2;
		padding: 0.9rem 0 0.6rem;
		background: var(--bg);
	}
	/* 후보 목록·무효 사유가 결과 블록을 밀어내지 않도록 높이를 항상 예약한다 (FR-4) */
	.aux {
		min-height: 3.5rem;
		margin-bottom: 0.4rem;
		overflow: hidden;
	}
	.reason {
		margin: 0;
		padding: 0.6rem 0.75rem;
		font-size: 0.9rem;
		color: var(--danger);
		background: var(--danger-bg);
		border-radius: 8px;
	}
	/* 18개를 한 줄 가로 스크롤로. 여러 줄이 되면 높이가 변한다. */
	.candidates {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		padding-bottom: 0.3rem;
		scrollbar-width: thin;
	}
	.candidates button {
		flex: 0 0 auto;
		min-width: 3rem;
		min-height: 40px;
		font-family: var(--mono);
		font-size: 0.95rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
	}
	.hint {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
