<!--
	스티커 문자 — 외우기 (#19, SPEC FR-LT-5 ~ 11).

	풀린 큐브의 스티커마다 Speffz 문자를 찍어 돌려 보게 한다. 측정하는 판이 없으므로
	설정을 잠그지 않는다 (CLAUDE.md "기록을 안 남기는 화면은 잠그지 않는다").

	큐브는 3D 로만 그린다 (FR-LT-5). 전개도를 보면 사람이 머릿속에서 그것을 다시
	큐브로 접어야 한다.
-->
<script lang="ts">
	import Cube from 'cubejs/lib/cube.js';
	import Cube3D from '$lib/ui/Cube3D.svelte';
	import SegToggle from '$lib/ui/SegToggle.svelte';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { letters } from '$lib/ui/letters.svelte.js';
	import { COLOR_NAME_KO, faceletColors, GRAY, grayFacelets } from '$lib/ui/facelets.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { labelsLookup, paintLookup, type Others } from '$lib/domain/letters.js';
	import type { PieceKind } from '$lib/cube/speffz.js';
	import type { Dataset } from '$lib/domain/types.js';

	/** 풀린 상태. 외우기는 이 상태 하나다 (SPEC Out of Scope "2단계 외우기 화면"). */
	const SOLVED = new Cube().asString();
	/** 기준 방향 = 카메라 방향 0번. U·R·F 가 보이는 각도다 (`cube3d-map.ts` `orientationOf`). */
	const HOME_ORIENTATION = 0;

	const KIND_OPTIONS: { value: PieceKind; label: string; hint: string; title: string }[] = [
		{ value: 'corner', label: '코너', hint: '코너 스티커에 문자를 찍습니다', title: '코너 24칸' },
		{ value: 'edge', label: '엣지', hint: '엣지 스티커에 문자를 찍습니다', title: '엣지 24칸' }
	];
	const OTHERS_OPTIONS: { value: Others; label: string; hint: string; title: string }[] = [
		{ value: 'gray', label: '회색', hint: '문자가 없는 조각을 회색으로 가립니다', title: '가리기' },
		{ value: 'color', label: '색', hint: '모든 조각을 실제 색으로 보입니다', title: '실물과 같게' }
	];

	let ds = $state<Dataset | null>(null);
	loadDataset().then((d) => (ds = d));

	let cube: ReturnType<typeof Cube3D> | undefined = $state();

	let colors = $derived(
		ds
			? paintLookup(
					letters.lookupKind,
					letters.lookupOthers,
					faceletColors(ds.meta.colorScheme, SOLVED),
					GRAY
				)
			: grayFacelets()
	);
	let labels = $derived(labelsLookup(letters.lookupKind));
	/**
	 * 기준 방향 문구 (FR-LT-8). 색 이름은 데이터의 `colorScheme` 에서 읽는다 — 면과
	 * 색의 짝을 코드가 정하지 않는다 (`facelets.ts` 머리 주석).
	 */
	let reference = $derived(
		ds
			? `기준: 위 ${COLOR_NAME_KO[ds.meta.colorScheme.U] ?? ds.meta.colorScheme.U} · 앞 ${
					COLOR_NAME_KO[ds.meta.colorScheme.F] ?? ds.meta.colorScheme.F
				}`
			: '기준: 확인 중'
	);
</script>

<svelte:head><title>스티커 문자 — 외우기</title></svelte:head>

<UpLink href="/" label="홈" />

<h1>외우기</h1>

<section class="lookup" data-letters-lookup>
	<div class="settings">
		<SegToggle name="letters-kind" heading="글자" bind:value={letters.lookupKind} options={KIND_OPTIONS} />
		<SegToggle
			name="letters-others"
			heading="다른 조각"
			bind:value={letters.lookupOthers}
			options={OTHERS_OPTIONS}
		/>
	</div>

	<p class="reference" data-reference>{reference}</p>

	<div class="cube-slot">
		<Cube3D
			bind:this={cube}
			facelets={colors}
			{labels}
			orientation={HOME_ORIENTATION}
			label="문자 큐브"
		/>
	</div>

	<!--
		원위치 (FR-LT-9). 진행 버튼이 아니다 — 외우기에는 단계가 없다. 한참 돌린 뒤
		기준 방향으로 돌아오는 수단이다.
	-->
	<button type="button" class="reset" data-reset onclick={() => cube?.resetView(HOME_ORIENTATION)}>
		원위치
	</button>
</section>

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0.2rem 0 0.4rem;
	}
	.lookup {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.4rem;
	}
	.settings {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-width: 20rem;
		width: 100%;
		margin: 0 auto;
	}
	.reference {
		margin: 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted);
	}
	/*
	 * 큐브 높이 상한. 트레이싱의 `.cube-slot` 과 같은 방식이다 — 남는 자리를 주고, 짧은
	 * 화면에서는 큐브가 먼저 양보한다. 고정분(설정 두 줄·문구·원위치·상단 바·탭)은
	 * 실측으로 잡는다 (NFR-LT-7, PHASE_5).
	 */
	.cube-slot {
		width: 100%;
		max-width: clamp(180px, calc(100vh - 26rem), 420px);
		max-width: clamp(180px, calc(100svh - 26rem), 420px);
		margin: 0 auto;
	}
	.reset {
		align-self: center;
		min-height: 44px;
		min-width: 8rem;
		padding: 0 1.2rem;
		font-size: 0.95rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
	}
</style>
