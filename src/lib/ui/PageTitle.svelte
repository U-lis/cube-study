<!--
  화면 이름 줄. 되돌아갈 곳과 `<h1>` 을 한 줄에 `홈 › 매일 퀴즈` 로 세운다.

  둘을 따로 세우면 상단 바 밑으로 두 줄(44px + 약 2.2rem)을 먹는다. 폰에서 본문이
  화면 6분의 1 아래에서 시작하던 것을 줄인다 (사용자 결정 2026-10-20).

  되돌아가기는 위치 기반이다. 히스토리를 쓰지 않는다.

  설치된 앱에서는 화면 이동이 히스토리를 쌓지 않고 교체한다 (+layout.svelte).
  뒤로가기는 "닫기" 하나만 뜻하므로 history.back() 이 되짚을 스택이 애초에 없다.

  스택이 있더라도 히스토리 기반은 쓰지 않는다. 조회와 기준을 오가다 보면
  "뒤로" 가 어디인지 눌러봐야 알게 된다. 갈 곳을 링크에 적어두면 누르기 전에 안다.

  출처는 히스토리가 아니라 링크의 쿼리(?from=)로 넘어온다. 그래서 새로고침해도,
  앱을 껐다 켜도 유지된다.

  `<h1>` 은 화면이 children 으로 넘긴다. 기준 상세처럼 `<h1>` 모양이 다른 화면이
  자기 스타일을 그대로 쓴다.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { href, label, children }: { href: string; label: string; children: Snippet } = $props();
</script>

<div class="title">
	<a class="up" {href} data-up-link={href}>{label}</a>
	<span class="sep" aria-hidden="true">›</span>
	{@render children()}
</div>

<style>
	.title {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		column-gap: 0.4rem;
		margin-bottom: 0.4rem;
	}
	/* 화면의 주인공이 아니다. 눈에 걸리되 시선을 끌지 않는 크기와 색으로 둔다. */
	.up {
		display: inline-flex;
		align-items: center;
		/* 터치 대상 44px (NFR). 보이는 크기는 그대로 두고 여백으로 채운다. */
		min-height: 44px;
		font-size: 0.95rem;
		color: var(--muted);
		text-decoration: none;
	}
	.sep {
		color: var(--muted);
		font-size: 1.1rem;
	}
</style>
