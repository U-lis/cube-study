<!-- 조회 (FR-3 ~ FR-10). sticky 결과: 입력이 줄어도 직전 결과를 지우지 않는다. -->
<script lang="ts">
	import { page } from '$app/state';
	import CaseInput from '$lib/ui/CaseInput.svelte';
	import CaseView from '$lib/ui/CaseView.svelte';
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

	loadDataset().then((d) => (ds = d));

	$effect(() => {
		if (queryCase) raw = queryCase.toUpperCase().slice(0, 2);
	});

	let result = $derived(ds ? lookup(ds, raw) : ({ status: 'empty' } as const));

	$effect(() => {
		if (result.status === 'valid') shown = result.entry;
		// 입력이 완전히 비면 직전 결과를 버린다. 한 글자만 남은 상태(stale)와 달리
		// 다 지운 것은 "그만 보겠다"는 뜻이다. X 버튼도 값을 비우므로 같이 처리된다.
		else if (raw === '') shown = null;
	});

	let stale = $derived(shown !== null && result.status !== 'valid');
</script>

<svelte:head><title>3-Style Corner — 조회</title></svelte:head>

<div class="top">
	<CaseInput bind:this={caseInput} bind:value={raw} />
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
