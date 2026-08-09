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
<!--
	진도(왼쪽)와 "외운거 안보기"(오른쪽)를 한 줄에 둔다. 목록 바로 위에서
	두 줄을 잡아먹을 내용이 아니다.
-->
<div class="list-head">
	<p class="count" data-count={data.cases.length}>
		<span class="progress" data-progress>
			<span class="checked-num" style="min-width: {totalDigits}ch">{checkedCount}</span
			>/{data.cases.length}
		</span>
	</p>

	<!--
		FR-MC-13: "외운거 안보기" 토글. 판정은 setup 암기 상태.
		FR-MC-14: 상태는 memorize.hideMemorized 가 localStorage 에 자동 저장한다.
		AD-4: SSR 은 기본값 false 라 항상 unchecked 로 렌더된다.

		상태를 글자 대신 눈 아이콘으로 알린다 — 켜면 눈이 감긴다(가림).
		두 아이콘의 viewBox 와 크기가 같아 상태가 바뀌어도 폭이 흔들리지 않는다.
		글자가 없으므로 aria-label/title 로 이름을 남긴다.
	-->
	<label
		class="hide-toggle"
		data-hide-toggle
		title={memorize.hideMemorized ? '외운 것을 가리는 중' : '외운 것도 보이는 중'}
	>
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<!-- 눈: 두 상태 공통 -->
			<path
				d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linejoin="round"
			/>
			<circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8" />
			{#if memorize.hideMemorized}
				<!-- 가리는 중일 때만 사선. 위치·크기는 그대로라 폭이 안 바뀐다 -->
				<path
					d="M4 20L20 4"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			{/if}
		</svg>
		<input
			type="checkbox"
			role="switch"
			aria-label="외운거 안보기"
			checked={memorize.hideMemorized}
			onchange={(e) => (memorize.hideMemorized = e.currentTarget.checked)}
			data-hide-input
		/>
	</label>
</div>

<ul>
	{#each data.cases as c (c.case)}
		<!--
			FR-MC-3(b): 이 화면은 셋업 무브를 나열하는 화면이라 체크박스는 항상
			setup 기준으로 고정한다. 전역 mode 가 direct 여도 여기 표시는 setup.
			AD-7: 체크박스는 <a> 밖 형제다. 회색 칸 안(수 오른쪽)에 있는 것처럼
			보이지만 배경·테두리를 <li> 가 갖고 있어서 그렇다. <a> 안에 넣으면
			체크 클릭이 링크 이동을 트리거하고 접근성도 깨진다.
			AD-4: 숨김은 반드시 class:hidden + CSS display:none. {#if} 로 <li> 를
			제거하면 SSR/CSR DOM 개수가 달라져 목록이 축소되며 밀린다.
		-->
		<li
			data-case-row={c.case}
			class:hidden={memorize.hideMemorized && memorize.isChecked('setup', c.case)}
		>
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
			<label class="memo" data-memorize-setup={c.case}>
				<input
					type="checkbox"
					checked={memorize.isChecked('setup', c.case)}
					onchange={() => memorize.toggle('setup', c.case)}
					data-memorize-input
				/>
			</label>
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
	/* 진도는 왼쪽, 토글은 오른쪽. 목록 바로 위 한 줄. */
	.list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin: 0.2rem 0 0.4rem;
	}
	.list-head .count {
		margin: 0;
	}
	/*
	 * FR-MC-13, FR-MC-4: "외운거 안보기". 터치 대상 44px 이상.
	 * 글자가 없으므로 라벨 전체를 클릭 영역으로 두고 이름은 aria-label 이 갖는다.
	 */
	.hide-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 44px;
		color: var(--muted);
		cursor: pointer;
	}
	.hide-toggle svg {
		flex: none;
	}
	/*
	 * 스위치. input 자체를 트랙으로 그리고 ::before 를 손잡이로 쓴다.
	 * 요소를 숨기지 않으므로 클릭 대상과 접근성 트리가 그대로 남는다.
	 */
	.hide-toggle input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		position: relative;
		width: 38px;
		height: 22px;
		margin: 0;
		flex: none;
		background: var(--border);
		border-radius: 999px;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.hide-toggle input[type='checkbox']::before {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		background: var(--bg);
		border-radius: 50%;
		transition: transform 0.15s ease;
	}
	.hide-toggle input[type='checkbox']:checked {
		background: var(--accent);
	}
	.hide-toggle input[type='checkbox']:checked::before {
		transform: translateX(16px);
	}
	/* 켜진 상태는 아이콘 색으로도 알린다. 아이콘만 보고도 상태가 읽혀야 한다. */
	.hide-toggle:has(input:checked) {
		color: var(--accent);
	}
	.hide-toggle input[type='checkbox']:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* 애니메이션을 원치 않는 사용자에게는 즉시 전환한다. */
	@media (prefers-reduced-motion: reduce) {
		.hide-toggle input[type='checkbox'],
		.hide-toggle input[type='checkbox']::before {
			transition: none;
		}
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
	/*
	 * 회색 칸은 <li> 가 그린다. 체크박스를 칸 안에 넣어 보이게 하면서도
	 * <a> 밖 형제로 유지하기 위한 구조다 (AD-7). <a> 는 배경 없이 칸을 채운다.
	 */
	li {
		display: flex;
		align-items: stretch;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	/*
	 * FR-MC-4: 터치 대상 44px 이상.
	 * 수 오른쪽, 칸 안쪽 끝에 놓는다. 폭이 고정이라 <a> 그리드가 밀리지 않는다.
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
		padding: 0.55rem 0 0.55rem 0.7rem;
		color: inherit;
		text-decoration: none;
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
