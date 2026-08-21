<!--
	3D 큐브 캔버스 (FR-TR-14 ~ 17, 22).

	캔버스 하나와 수명 관리만 있는 **얇은 래퍼** 다 (AD-11). 그리기는 전부
	`$lib/cube/cube3d.ts` 가 하고, 이 파일은 그것을 `await import()` 로만 부른다 —
	`three` 를 정적으로 끌어오면 조회·퀴즈의 초기 번들에 gzip 85KB 가 얹힌다 (NFR-TR-2).

	여기에 힌트·반투명·미니맵·전개도를 만들지 않는다 (FR-TR-15). 뒷면은 사용자가
	돌려야 보인다.

	SSR 에서도 캔버스가 **같은 자리·같은 크기** 로 렌더된다 (AD-14). `{#if browser}` 로
	감싸지 않는 이유가 이것이다 — 하이드레이션 후 요소가 생기면 레이아웃이 밀린다.
	이 저장소가 이미 두 번 밟은 함정이다.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { CubeView, Mark } from '$lib/cube/cube3d.js';

	/** 기본값을 인라인 리터럴로 두면 렌더마다 새 배열이 되어 `$effect` 가 계속 돈다. */
	const NO_MARKS: (Mark | null)[] = Array.from({ length: 54 }, () => null);

	let {
		facelets,
		marks = NO_MARKS,
		orientation = 0,
		label = '큐브'
	}: {
		/** 54칸 색. 면 순서 `URFDLB`. 전 면 회색도 이 경로다 (FR-TR-22). */
		facelets: string[];
		/** 54칸 강조. 개수 상한이 없다 (FR-TR-16). */
		marks?: (Mark | null)[];
		/** 초기 카메라 각도 0..23 (FR-TR-17). */
		orientation?: number;
		label?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let view = $state<CubeView | null>(null);

	onMount(() => {
		let live = true;
		let observer: ResizeObserver | undefined;

		(async () => {
			// ← `three` 지연 로드 지점. 저장소에서 여기 말고 cube3d.ts 를 부르는 곳이 없다.
			const { createCubeView } = await import('$lib/cube/cube3d.js');
			const created = await createCubeView(canvas);
			if (!live) {
				created.dispose();
				return;
			}
			view = created;
			// 모바일 회전·레이아웃 변화 대응.
			observer = new ResizeObserver(() => created.resize());
			observer.observe(canvas);
		})();

		return () => {
			live = false;
			observer?.disconnect();
			view?.dispose();
			view = null;
		};
	});

	// 렌더 루프는 three 가 돈다 (NFR-TR-6). $effect 는 상태 전달만 한다.
	$effect(() => {
		view?.setFacelets(facelets);
	});
	$effect(() => {
		view?.setHighlights(marks);
	});
	$effect(() => {
		view?.setOrientation(orientation);
	});
</script>

<div class="cube3d">
	<canvas bind:this={canvas} aria-label={label} data-cube3d></canvas>
</div>

<style>
	/*
	 * 정사각 자리를 CSS 로 잡는다. SSR 이 그린 빈 캔버스와 하이드레이션 후 그려진
	 * 캔버스의 박스가 같아야 레이아웃이 안 밀린다 (AD-14).
	 */
	.cube3d {
		width: 100%;
		max-width: 420px;
		margin: 0 auto;
		aspect-ratio: 1 / 1;
		border-radius: 12px;
		overflow: hidden;
		background: #0d0d0f;
		border: 1px solid var(--border);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
</style>
