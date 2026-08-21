<!--
  2지선다 세그먼티드 토글.

  단일 버튼으로 상태만 보여주면 "누르면 무엇이 되는지"를 알 수 없다.
  선택지를 나란히 두고 활성 쪽을 강조한다.

  선택지는 둘 또는 셋이다. 넷을 넘으면 모바일 폭에서 글자가 잘리기 시작하므로
  그때는 이 컨트롤이 아니라 목록이 맞다.

  설명은 항상 보이는 한 줄로 둔다. 모바일에는 hover 가 없어서
  title 툴팁에만 의존하면 정작 주 사용처에서 안 보인다.
-->
<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
		/** 항상 보이는 짧은 설명 */
		hint: string;
		/** 데스크탑 hover 툴팁 */
		title: string;
	}

	let {
		name,
		value = $bindable(),
		options
	}: { name: string; value: T; options: Option[] } = $props();

	let active = $derived(options.find((o) => o.value === value) ?? options[0]);
</script>

<div class="wrap">
	<div
		class="seg"
		data-toggle={name}
		data-value={value}
		role="group"
		aria-label={name}
		style="--cols: {options.length}"
	>
		{#each options as o (o.value)}
			<button
				type="button"
				data-option={o.value}
				class:on={value === o.value}
				aria-pressed={value === o.value}
				title={o.title}
				onclick={() => (value = o.value)}
			>
				{o.label}
			</button>
		{/each}
	</div>
	<p class="hint" data-hint={name} title={active.title}>{active.hint}</p>
</div>

<style>
	.wrap {
		min-width: 0;
	}
	.seg {
		display: grid;
		/* 선택지 개수는 호출부가 정한다. 인라인 변수로 받아 CSS 를 갈라두지 않는다. */
		grid-template-columns: repeat(var(--cols, 2), 1fr);
		gap: 2px;
		padding: 2px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 9px;
	}
	button {
		min-height: 40px;
		padding: 0 0.15rem;
		font-family: var(--mono);
		font-size: 0.78rem;
		letter-spacing: -0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--muted);
		background: transparent;
		border: none;
		border-radius: 7px;
		cursor: pointer;
		touch-action: manipulation;
	}
	button.on {
		color: var(--bg);
		background: var(--fg);
		font-weight: 600;
	}
	.hint {
		margin: 0.3rem 0 0;
		font-size: 0.72rem;
		line-height: 1.35;
		color: var(--muted);
		text-align: center;
	}
</style>
