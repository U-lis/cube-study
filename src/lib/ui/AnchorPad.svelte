<!--
  기준공식 선택 패드 (퀴즈 setup 입력).

  이름만 찍는다. 알고리즘을 같이 보여주면 판정 전 DOM 에 정답이 노출되고
  외우는 대상 자체를 화면이 대신 기억해 준다.

  기준마다 정·역 두 칸이다. v3 는 역트릭을 접어 기준 수를 줄였고 378 중 188
  케이스가 기준을 거꾸로 돌리므로, 방향을 못 고르면 그 188개를 표현할 수 없다.
  개수는 데이터에서 오므로 기준이 몇 개든 짝이 한 줄 안에 붙어 있게만 한다.
-->
<script lang="ts">
	import type { AnchorRef } from '$lib/domain/anchor.js';
	import { refLabel } from '$lib/domain/anchor.js';

	let {
		refs,
		onpick,
		disabled = false
	}: { refs: AnchorRef[]; onpick: (ref: AnchorRef) => void; disabled?: boolean } = $props();

	// 정·역이 한 쌍이므로 열 수는 짝수여야 짝이 갈라지지 않는다.
	let cols = $derived(Math.min(4, Math.max(2, refs.length)));
</script>

<div class="pad" data-anchor-pad={refs.length} style="--cols: {cols}">
	{#each refs as ref (refLabel(ref))}
		<button
			type="button"
			data-anchor-pick={refLabel(ref)}
			data-anchor-name={ref.name}
			data-inverse={ref.inverse}
			{disabled}
			onclick={() => onpick(ref)}
		>
			{refLabel(ref)}
		</button>
	{/each}
</div>

<style>
	.pad {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: 0.4rem;
		width: 100%;
	}
	button {
		min-height: 48px;
		font-family: var(--mono);
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--accent);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		touch-action: manipulation;
	}
	/* 역방향 칸은 한 단계 눌러서 정방향과 짝으로 읽히게 한다 */
	button[data-inverse='true'] {
		background: var(--bg);
	}
	button:active {
		background: var(--border);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
