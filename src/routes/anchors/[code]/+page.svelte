<script lang="ts">
	import { browser } from '$app/environment';
	import Alg from '$lib/ui/Alg.svelte';
	import { targetText } from '$lib/domain/validate.js';
	import { formatCommutator } from '$lib/domain/format.js';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { memorize } from '$lib/ui/memorize.svelte.js';
	import { settings } from '$lib/ui/settings.svelte.js';
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
	 * 역방향 케이스가 하나도 없는 기준(현재 데이터에는 없다)과 "기준 없음" 그룹에서는
	 * 토글을 내린다. 아무것도 가리지 못하는 스위치가 켜져 있으면 고장으로 읽힌다.
	 */
	let hasInverse = $derived(data.cases.some((c) => c.setup.usesInverse));

	/** 역공식 숨김을 적용하고 남는 케이스. 암기 숨김은 여기 넣지 않는다 (아래 주석). */
	let listedCases = $derived(
		settings.hideInverse ? data.cases.filter((c) => !c.setup.usesInverse) : data.cases
	);

	/**
	 * FR-MC-15 안내 조건. FR-MC-16: 진도 분모는 숨김과 무관하게 항상
	 * data.cases.length 를 쓴다 — allMemorized 는 안내 렌더 여부만 결정한다.
	 * 케이스가 0개인 기준을 "모두 암기" 로 오해하지 않게 length > 0 을 함께 본다.
	 *
	 * 판정 대상은 "지금 목록에 나올 수 있는 것" 이다. 역공식을 가린 상태에서 정방향을
	 * 다 외웠으면 목록은 비는데, 분모를 전체로 잡으면 안내가 안 나와 빈 목록만 남는다.
	 */
	let allMemorized = $derived(
		listedCases.length > 0 && listedCases.every((c) => memorize.isChecked('setup', c.case))
	);
</script>

<svelte:head><title>3-Style Corner — {data.code}</title></svelte:head>

<!--
	목록을 훑는 동안 기준공식이 화면 밖으로 나가지 않게 상단에 고정한다. 이 화면은
	기준을 보며 셋업을 익히는 화면이라, 기준이 사라지면 목록의 셋업이 무엇에 붙는
	셋업인지 알 수 없어 매번 위로 올라가 확인하게 된다.

	진도와 토글, 열 머리글까지 함께 고정한다. 머리글이 따라붙지 않으면 스크롤 뒤엔
	오른쪽 체크박스 열이 이름 없는 칸이 된다.
-->
<div class="head" data-anchor-head>
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

		아이콘이 **무엇을 가리는지** 를 스스로 말해야 한다. 둘 다 눈이면 나란히
		놓였을 때 글자를 읽어야 구분되고, 나중에 "아이콘만 보기" 를 만들면 통째로
		구분이 사라진다. 그래서 암기는 뇌, 역공식은 되돌이 화살표다.

		가리는 중인가는 두 아이콘 공통으로 **사선** 이 말한다 — 0.3.0 에서 눈이
		감기던 자리다. 그림의 viewBox 와 크기가 같아 상태가 바뀌어도 폭이 흔들리지
		않는다. 글자가 없어도 읽히도록 aria-label/title 로 이름을 남긴다.
	-->
	<div class="toggles">
	<label
		class="hide-toggle"
		data-hide-toggle
		title={memorize.hideMemorized ? '외운 것을 가리는 중' : '외운 것도 보이는 중'}
	>
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<!--
				뇌: 왼쪽 반쪽만 그리고 오른쪽은 거울로 뒤집는다. 반쪽만 맞으면 대칭이
				보장되고, 두 반쪽을 따로 적으면 한쪽만 고치는 날이 온다.
				가운데 세로선(고랑)이 없으면 이 그림은 구름으로 읽힌다.
			-->
			<g
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path
					d="M12 5.4C10.9 4.1 8.6 4.3 7.8 5.8 6.2 5.4 4.7 6.7 5 8.3 3.7 9 3.6 10.9 4.8 11.8 4.1 13 4.7 14.7 6.1 15.2 6.3 16.8 8 17.8 9.4 17 10 18.1 11.2 18.5 12 18.1"
				/>
				<g transform="translate(24,0) scale(-1,1)">
					<path
						d="M12 5.4C10.9 4.1 8.6 4.3 7.8 5.8 6.2 5.4 4.7 6.7 5 8.3 3.7 9 3.6 10.9 4.8 11.8 4.1 13 4.7 14.7 6.1 15.2 6.3 16.8 8 17.8 9.4 17 10 18.1 11.2 18.5 12 18.1"
					/>
				</g>
				<path d="M12 5.4v12.7" />
			</g>
			{#if memorize.hideMemorized}
				<!-- 가리는 중일 때만 사선. 위치·크기는 그대로라 폭이 안 바뀐다 -->
				<path d="M4 20L20 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
			{/if}
		</svg>
		<span class="hide-label">암기 숨김</span>
		<input
			type="checkbox"
			role="switch"
			aria-label="암기 숨김"
			checked={memorize.hideMemorized}
			onchange={(e) => (memorize.hideMemorized = e.currentTarget.checked)}
			data-hide-input
		/>
	</label>

	<!--
		"역공식 숨김". 역쌍 XY/YX 는 같은 기준에 속하고 한쪽은 기준을 거꾸로 돌리는
		것이라, 정방향만 훑으며 외울 때 목록이 두 배로 길어 보인다. 줄에 붙는 "역"
		배지가 가려지는 대상이다.

		아이콘은 되돌이 화살표다 — 역공식이 정공식을 거꾸로 돌리는 것이라는 뜻을
		그림이 직접 맡는다. 상태(가리는 중인가)는 암기 숨김과 같은 사선이다.
	-->
	{#if hasInverse}
		<label
			class="hide-toggle"
			data-inverse-toggle
			title={settings.hideInverse ? '역공식을 가리는 중' : '역공식도 보이는 중'}
		>
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
				<!--
					되돌이 화살표. 오른쪽에서 올라가 위를 돌아 왼쪽으로 내려오고, 내려온
					끝에 화살촉이 선다 — 방향이 뒤집힌다는 뜻이 그림 하나로 읽힌다.
				-->
				<g
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M17 17.5V11a5 5 0 0 0-10 0v6.5" />
					<path d="M4 14.5l3 3 3-3" />
				</g>
				{#if settings.hideInverse}
					<path d="M4 20L20 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
				{/if}
			</svg>
			<span class="hide-label">역공식 숨김</span>
			<input
				type="checkbox"
				role="switch"
				aria-label="역공식 숨김"
				checked={settings.hideInverse}
				onchange={(e) => (settings.hideInverse = e.currentTarget.checked)}
				data-inverse-input
			/>
		</label>
	{/if}
	</div>
</div>

<!--
	체크박스 열의 머리글. 줄마다 "암기" 를 붙이면 112번 반복되어 배경 소음이 된다.
	표에서 하듯 열 이름을 한 번만 적고, 각 줄은 체크박스만 갖는다.
	폭·정렬을 아래 .memo 와 맞춰야 열 위에 정확히 선다.
-->
<p class="col-head" aria-hidden="true"><span>암기</span></p>
</div>

<ul>
	{#each data.cases as c (c.case)}
		<!--
			무브 수는 싣지 않는다. 옆에 보이는 것은 셋업뿐인데 수는 셋업+기준+역셋업을
			상쇄까지 적용한 최종 길이라 단위가 다르다. 셋업 3수 옆에 8수가 적혀 있으면
			"3수인데 왜 8수" 가 된다 (CP 가 실제로 그렇다: 3+8+3=14 → 상쇄 6 → 8).
			데이터의 setup.breakdown 이 그 과정을 들고 있으니, 설명이 필요해지면
			상세 쪽에서 꺼내 쓴다.

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
			class:hidden={(memorize.hideMemorized && memorize.isChecked('setup', c.case)) ||
				(settings.hideInverse && c.setup.usesInverse)}
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
			</a>
			<label class="memo" data-memorize-setup={c.case}>
				<input
					type="checkbox"
					aria-label="{c.case} 암기"
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
	/*
	 * 고정 머리. 배경은 반드시 불투명해야 한다 — 투명하면 아래 <li> 가 비쳐
	 * 지나간다. 좌우는 main 의 padding 안이라 목록과 폭이 같아 새어 나오지 않는다.
	 * <li> 가 배경을 갖고 있으므로 z-index 로 위에 세운다.
	 */
	.head {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--bg);
	}
	/*
	 * 낮은 화면(가로 방향 폰 등)에서는 고정하지 않는다. 이 머리는 170px 남짓이라
	 * 세로 400px 화면에서 절반을 먹고 목록이 서너 줄만 남는다 — 고정의 목적이
	 * 목록을 훑기 위한 것인데 훑을 자리가 없어진다.
	 */
	@media (max-height: 560px) {
		.head {
			position: static;
		}
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
	 * 진도는 왼쪽, 토글은 오른쪽. 목록 바로 위 한 줄.
	 * 토글이 둘이라 좁은 화면에서는 줄바꿈을 허용한다 — 320px 에서 한 줄에 넣으면
	 * 라벨이 잘리는데, 이 화면에서 잘려서는 안 되는 것이 정확히 그 라벨이다.
	 * 아이콘(뇌·되돌이 화살표)이 무엇을 가리는지 말하지만, 라벨이 잘려 반만 남으면
	 * 그 줄이 무슨 스위치인지 되레 헷갈린다.
	 */
	.list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0 0.6rem;
		margin: 0.2rem 0 0.4rem;
	}
	.toggles {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		margin-left: auto;
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
	.hide-label {
		font-size: 0.8rem;
		white-space: nowrap;
	}
	/*
	 * 체크박스 열 머리글. 오른쪽 44px 열 위에 세운다 (.memo 와 같은 폭).
	 * <li> 테두리 1px 만큼 안쪽으로 들어가야 눈으로 맞는다.
	 * 스크린리더에는 각 체크박스의 aria-label 이 있으므로 중복 낭독을 막는다.
	 */
	.col-head {
		display: flex;
		justify-content: flex-end;
		margin: 0 0 0.25rem;
		padding-right: 1px;
		font-size: 0.7rem;
		color: var(--muted);
	}
	.col-head span {
		width: 44px;
		text-align: center;
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
		grid-template-columns: 3.2rem 1fr 1.2rem;
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
	.nosetup {
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
