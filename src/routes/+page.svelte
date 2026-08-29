<!--
	홈 (FR-NAV-1 ~ 3).

	기능을 나열하는 것이 전부다. 진도·통계 숫자를 넣지 않는다 — 각 화면이 이미 자기
	숫자를 내고, 홈이 그것을 다시 내려면 데이터셋을 여기서 읽어야 한다. 첫 화면의
	로딩이 그만큼 늦어진다 (NFR-NAV-3). 환영 문구·카드·일러스트도 없다 (NFR-9).

	**묶음을 손으로 적었다.** 하단 탭과 달리(`$lib/ui/nav.ts`) 여기는 경로에서 읽지
	않는다 — 묶음이 하나뿐이라 계산할 것이 없고, 순서와 한 줄 설명은 어차피 사람이
	적는 값이다. 묶음이 둘 이상 되는 날(CFOP 이 들어오는 날) 하는 일은 구분선을 하나
	더 긋는 것이고, 계층 아코디언은 그때도 아니다 — 문턱은 SPEC 의 "3번 — 홈의 계층을
	언제 접을 것인가" 에 있다.
-->
<script lang="ts">
	const FEATURES = [
		{
			href: '/3x3/bld/3style/corner/lookup',
			name: '조회',
			desc: '스티커 2글자로 알고리즘을 찾습니다'
		},
		{
			href: '/3x3/bld/3style/corner/algs',
			name: '기준공식',
			desc: '기준공식별 케이스 목록과 암기 진도'
		},
		{
			href: '/3x3/bld/3style/corner/quiz',
			name: '퀴즈',
			desc: '케이스를 보고 알고리즘을 칩니다'
		},
		{ href: '/3x3/bld/trace', name: '트레이싱', desc: '스크램블에서 타깃 열을 뽑습니다' }
	];
</script>

<svelte:head><title>CubeStudy — 홈</title></svelte:head>

<section data-home>
	<h1>홈</h1>

	<h2>3BLD</h2>
	<ul>
		{#each FEATURES as f (f.href)}
			<li>
				<a href={f.href} data-feature={f.name}>
					<span class="name">{f.name}</span>
					<span class="desc">{f.desc}</span>
				</a>
			</li>
		{/each}
	</ul>
</section>

<style>
	h1 {
		font-size: 1.1rem;
		margin: 0.2rem 0 0.8rem;
	}
	/* 묶음 이름. 구분선이 경계를 말하고 글자가 이름을 말한다 (결정 3). */
	h2 {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
		margin: 0 0 0.4rem;
		padding-bottom: 0.3rem;
		border-bottom: 1px solid var(--border);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	a {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		/* 터치 타깃 44px (FR-MC-4). 줄 두 개라 여유가 있지만 하한을 명시해 둔다. */
		min-height: 44px;
		padding: 0.6rem 0.2rem;
		text-decoration: none;
		color: inherit;
	}
	.name {
		font-weight: 600;
	}
	.desc {
		font-size: 0.85rem;
		color: var(--muted);
	}
</style>
