<script lang="ts">
	import { browser } from '$app/environment';
	import Alg from '$lib/ui/Alg.svelte';
	import { targetText } from '$lib/domain/validate.js';
	import { formatCommutator } from '$lib/domain/format.js';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { memorize } from '$lib/ui/memorize.svelte.js';
	let { data } = $props();

	let comm = $derived(data.anchor ? formatCommutator(data.anchor.alg) : null);

	/**
	 * FR-MC-10: 이 화면은 setup 무브를 배우는 화면이라 진도도 setup 기준이다
	 * (체크박스와 같은 이유, FR-MC-3(b)). SSR 에서 memorize.setupChecked 는
	 * 빈 Set 이므로 checkedCount 는 언제나 0 으로 렌더되고, HTML 에 `0/{전체}`
	 * 가 이미 박힌 채 나간다 (AD-4). 자릿수 폭은 CSS 로 예약해 하이드레이션
	 * 후 값이 바뀌어도 컨테이너 폭이 바뀌지 않는다.
	 */
	let checkedCount = $derived(
		data.cases.filter((c) => memorize.isChecked('setup', c.case)).length
	);

	/**
	 * 진도 좌측 숫자의 min-width 로 쓸 자릿수. tabular-nums 와 결합해 어떤
	 * checkedCount 값이 와도 폭이 바뀌지 않게 한다 (T3-6, NFR-MC-2).
	 */
	let totalDigits = $derived(String(data.cases.length).length);

	/**
	 * FR-MC-15 안내 조건. FR-MC-16: 진도 분모는 숨김과 무관하게 항상
	 * data.cases.length 를 쓴다 — allMemorized 는 안내 렌더 여부만 결정한다.
	 * 케이스가 0개인 기준을 "모두 암기" 로 오해하지 않게 length > 0 을 함께 본다.
	 */
	let allMemorized = $derived(
		data.cases.length > 0 && checkedCount === data.cases.length
	);
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

<!--
	FR-MC-10: `{checked}/{전체}` 형식. NFR-MC-5: 진도바·퍼센트·문구 금지 — 숫자만.
	`.checked-num` 에 min-width 를 자릿수로 예약해 값이 0→2자리 로 늘어도
	오른쪽의 `/{전체}` 위치가 그대로다. tabular-nums 로 자릿수 폭도 통일한다.
-->
<p class="count" data-count={data.cases.length}>
	<span class="progress" data-progress>
		<span class="checked-num" style="min-width: {totalDigits}ch">{checkedCount}</span
		>/{data.cases.length}
	</span>
</p>

<!--
	FR-MC-13: "외운거 안보기" 토글. 판정은 setup 암기 상태.
	FR-MC-14: 상태는 memorize.hideMemorized 가 localStorage 에 자동 저장한다.
	AD-4: bind:checked 는 CSR 에서만 의미가 있다. SSR 은 memorize.hideMemorized
	기본값 false 로 unchecked 로 렌더된다.
-->
<label class="hide-toggle" data-hide-toggle>
	<input
		type="checkbox"
		checked={memorize.hideMemorized}
		onchange={(e) => (memorize.hideMemorized = e.currentTarget.checked)}
		data-hide-input
	/>
	<span>외운거 안보기</span>
</label>

<ul>
	{#each data.cases as c (c.case)}
		<!--
			FR-MC-3(b): 이 화면은 셋업 무브를 나열하는 화면이라 체크박스는 항상
			setup 기준으로 고정한다. 전역 mode 가 direct 여도 여기 표시는 setup.
			AD-7: 체크박스를 <a> 밖 형제로 둔다. <a> 안에 넣으면 클릭이 링크
			이동을 트리거하고 접근성도 깨진다.
			AD-4: 숨김은 반드시 class:hidden + CSS display:none. {#if} 로 <li> 를
			제거하면 SSR/CSR DOM 개수가 달라져 목록이 축소되며 밀린다.
		-->
		<li
			data-case-row={c.case}
			class:hidden={memorize.hideMemorized && memorize.isChecked('setup', c.case)}
		>
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

<!--
	FR-MC-15: 전부 숨겨져 목록이 비면 안내를 낸다. 빈 <ul> 만 남기지 않는다.
	AD-4: `browser` 이중 방어로 SSR 에서는 절대 렌더되지 않는다. 기본값이
	hideMemorized=false 이므로 조건상 안 나오지만 이중 방어를 둔다.
-->
{#if browser && memorize.hideMemorized && allMemorized}
	<p class="all-memorized" data-all-memorized>모두 암기 표시되어 있습니다</p>
{/if}

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
	/*
	 * FR-MC-10: 진도 숫자. tabular-nums 로 자릿수 폭을 통일하고, .checked-num 에
	 * min-width 를 자릿수로 예약해 값이 늘어도 우측 `/{전체}` 위치가 밀리지
	 * 않는다 (T3-6, NFR-MC-2, AD-4).
	 */
	.progress {
		font-variant-numeric: tabular-nums;
	}
	.checked-num {
		display: inline-block;
		text-align: right;
	}
	/*
	 * FR-MC-13, FR-MC-4: "외운거 안보기" 토글. 터치 대상 44px 이상.
	 * <ul> 과 진도 표시 사이의 별도 컨트롤이라 라벨 전체를 클릭 영역으로 만든다.
	 */
	.hide-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		margin: 0.2rem 0 0.4rem;
		font-size: 0.9rem;
		color: var(--muted);
		cursor: pointer;
	}
	.hide-toggle input[type='checkbox'] {
		width: 20px;
		height: 20px;
		margin: 0;
		cursor: pointer;
	}
	/*
	 * AD-4: 숨김은 반드시 display:none 만. visibility:hidden 은 공간을 잡아
	 * 남겨 gap 이 이중으로 붙는다.
	 */
	.hidden {
		display: none;
	}
	/*
	 * FR-MC-15: 안내 문구. dry 한 톤을 유지한다 (NFR-MC-5).
	 */
	.all-memorized {
		margin-top: 0.6rem;
		font-size: 0.9rem;
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
