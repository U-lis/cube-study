<!--
  위치 기반 상위 이동. 히스토리를 쓰지 않는다.

  설치된 앱에서는 화면 이동이 히스토리를 쌓지 않고 교체한다 (+layout.svelte).
  뒤로가기는 "닫기" 하나만 뜻하므로 history.back() 이 되짚을 스택이 애초에 없다.

  스택이 있더라도 히스토리 기반은 쓰지 않는다. 조회와 기준을 오가다 보면
  "뒤로" 가 어디인지 눌러봐야 알게 된다. 갈 곳을 버튼에 적어두면 누르기 전에 안다.

  출처는 히스토리가 아니라 링크의 쿼리(?from=)로 넘어온다. 그래서 새로고침해도,
  앱을 껐다 켜도 유지된다.
-->
<script lang="ts">
	let { href, label }: { href: string; label: string } = $props();
</script>

<a class="up" {href} data-up-link={href}>
	<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
		<path
			d="M15 5l-7 7 7 7"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
	<span>{label}</span>
</a>

<style>
	/* 화면의 주인공이 아니다. 눈에 걸리되 시선을 끌지 않는 크기와 색으로 둔다. */
	.up {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		/* 터치 대상 44px (NFR). 보이는 크기는 그대로 두고 여백으로 채운다. */
		min-height: 44px;
		padding-right: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
		text-decoration: none;
	}
	.up svg {
		flex: none;
	}
</style>
