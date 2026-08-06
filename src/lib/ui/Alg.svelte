<!--
  알고리즘 렌더. NFR-4(ASCII 프라임)와 NFR-5(무브 단위 줄바꿈)의 유일한 책임 지점.

  {@html} 을 절대 쓰지 않는다.

  토큰 사이에 실제 공백 텍스트 노드를 넣는다. flex gap 으로 시각적 간격만 주면
  복사했을 때 "RD2R'U..." 처럼 무브 구분이 사라진다.
  줄바꿈 제어는 각 토큰의 white-space: nowrap 이 담당한다.
-->
<script lang="ts">
	import type { AlgPart } from '$lib/domain/format.js';
	import { splitMoves } from '$lib/cube/notation.js';

	let { parts, size = 'md' }: { parts: AlgPart[]; size?: 'sm' | 'md' | 'lg' } = $props();

	interface Token {
		text: string;
		cls: string;
	}

	// 파트를 토큰 단위로 평탄화한다. punct/anchor 는 통째로, 무브는 하나씩.
	let tokens = $derived.by((): Token[] => {
		const out: Token[] = [];
		for (const part of parts) {
			if (part.role === 'punct' || part.role === 'anchor') {
				out.push({ text: part.text, cls: part.role });
			} else {
				for (const mv of splitMoves(part.text)) out.push({ text: mv, cls: `mv ${part.role}` });
			}
		}
		return out;
	});
</script>

<span class="alg {size}"
	>{#each tokens as t, i (i)}{#if i > 0}{' '}{/if}<span class={t.cls}>{t.text}</span>{/each}</span
>

<style>
	/* 인라인 흐름을 쓴다. 공백에서만 줄바꿈되고 토큰 내부에서는 끊기지 않는다. */
	.alg {
		display: block;
		font-family: var(--mono);
		font-variant-ligatures: none;
		font-feature-settings: normal;
		text-align: left;
		line-height: 1.7;
	}
</style>
