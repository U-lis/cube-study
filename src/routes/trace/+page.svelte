<!--
	트레이싱 훈련 (FR-TR-2, 14, 17, 19, 21, 22, 23).

	이 화면이 세 갈래를 처음 조립한다 — 스크램블 워커, 3D 뷰어, 트레이싱 엔진.
	셋 사이에 오가는 통화는 54칸 facelet 문자열 하나다 (GLOBAL §4.2).

	─── 프리렌더 (AD-14) ───────────────────────────────────────
	`+layout.ts` 가 `prerender = true` 이고 여기도 예외가 아니다. 워커와 `three` 는
	전부 `onMount` 안에서 만들어지므로 서버에서는 아무것도 뜨지 않는다.

	SSR 과 CSR 의 **요소 구성·개수·크기가 같다.** 버튼을 `{#if}` 로 넣다 뺐다 하지
	않고 `disabled` 로 둔다. 이 저장소가 두 번 밟은 함정이다 (`+page.svelte:33-46`).
	예외는 두 곳뿐이고 둘 다 자리를 미리 잡아둔 곳이다 — "준비 중" 한 줄과 기록 목록.

	─── 미리 훔쳐보기 방지 (FR-TR-22) ──────────────────────────
	시작 전에는 **색 배열 자체가 없다.** 회색 54칸만 존재하고, 스크램블은 시작
	버튼을 누르는 순간 큐에서 꺼낸다. 스크램블 문자열은 이 화면에 아예 렌더하지
	않는다 — 3D 로 읽어내는 것이 훈련의 내용이라 문자열이 보이면 훈련이 사라진다.
	────────────────────────────────────────────────────────────
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Cube from 'cubejs/lib/cube.js';
	import Cube3D from '$lib/ui/Cube3D.svelte';
	import SegToggle from '$lib/ui/SegToggle.svelte';
	import { ScrambleSource } from '$lib/ui/scramble.svelte.js';
	import { tracing } from '$lib/ui/tracing.svelte.js';
	import { faceletColors, grayFacelets } from '$lib/ui/facelets.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { stateFromFacelets, type CubeState, type PieceKind } from '$lib/cube/sim.js';
	import { ORIENTATION_COUNT } from '$lib/cube/cube3d-map.js';
	import { gradeMemo, trace, type TraceResult, type TraceVerdict } from '$lib/cube/trace.js';
	import {
		formatMs,
		optionsFrom,
		verdictText,
		CONVENTIONS,
		TRAIN_KINDS,
		TRAIN_MODES,
		type BufferMeta,
		type TrainKind,
		type TrainMode,
		type TwistConvention
	} from '$lib/domain/tracing.js';
	import type { Cubie, Dataset } from '$lib/domain/types.js';

	/**
	 * 세션 단계.
	 *
	 *   idle ──시작──> tracing ──(memorize 는 "다 외웠다")──> input ──채점──> result
	 *    ↑                                                                    │
	 *    └────────────────────── 다음 문제 ───────────────────────────────────┘
	 *
	 * `follow` 는 `tracing` 과 `input` 이 겹친다 — 큐브를 보면서 입력하기 때문이다.
	 * 두 모드의 차이는 **입력 시점에 큐브를 보여주는지 여부뿐이다** (FR-TR-21).
	 */
	type Stage = 'idle' | 'tracing' | 'input' | 'result';

	/**
	 * 엣지 버퍼. 코너와 달리 엣지 데이터셋(#16)이 아직 없어서 읽어올 `meta` 가 없다.
	 *
	 * 필드 이름을 `DatasetMeta` 와 같게 둔 이유가 하나다 — 데이터가 생기면 이
	 * 상수는 `loadDataset({ pieceType: 'edge' }).meta` 로 **바뀌는 것이 아니라
	 * 지워진다.** 버퍼가 코드에 남는 유일한 자리이고, 그것도 엔진이 아니라 조립부다
	 * (FR-TR-7 은 엔진에 상수를 두지 말라는 요구다).
	 */
	const EDGE_BUFFER: BufferMeta & { buffer: Cubie } = {
		buffer: 'UF',
		bufferStickers: ['c', 'i'],
		primarySticker: 'c'
	};

	/** 대상 선택의 한 줄 설명. 라벨은 이름이고 이쪽이 "그래서 무엇이 다른가" 다. */
	const KIND_HINT: Record<TrainKind, string> = {
		corner: '코너만 트레이싱합니다',
		edge: '엣지만 트레이싱합니다',
		both: '한 스크램블로 코너를 끝낸 뒤 엣지를 이어서 합니다'
	};

	const KIND_OPTIONS = (Object.keys(TRAIN_KINDS) as TrainKind[]).map((value) => ({
		value,
		label: TRAIN_KINDS[value],
		hint: KIND_HINT[value],
		title: KIND_HINT[value]
	}));
	const MODE_OPTIONS = (Object.keys(TRAIN_MODES) as TrainMode[]).map((value) => ({
		value,
		label: value === 'follow' ? '보고 따라가기' : '외운 다음 입력',
		hint: TRAIN_MODES[value],
		title: TRAIN_MODES[value]
	}));
	const CONVENTION_OPTIONS = (Object.keys(CONVENTIONS) as TwistConvention[]).map((value) => ({
		value,
		label: `관례 ${value}`,
		hint: CONVENTIONS[value],
		title: CONVENTIONS[value]
	}));

	let ds = $state<Dataset | null>(null);
	loadDataset().then((d) => (ds = d));

	/**
	 * 스크램블 공급원. **모듈 싱글턴이 아니다** — 화면이 만들고 화면이 파괴한다.
	 * 워커의 수명이 화면의 수명이고, 그 100MB 는 조회·퀴즈만 쓰는 사용자의 것이
	 * 아니다 (AD-9, NFR-TR-1).
	 */
	const src = new ScrambleSource();

	let stage = $state<Stage>('idle');
	/** 이번 판의 조각 종류. `both` 는 코너를 끝낸 뒤 여기가 엣지로 바뀐다. */
	let pieceKind = $state<PieceKind>('corner');
	/** 시작 시점에 **고정** 한 관례. 판이 도는 중에 바뀌면 채점 기준이 흔들린다. */
	let roundConvention = $state<TwistConvention>('A');
	/** 54칸 facelet 문자열. 시작 전에는 `null` 이다 — 색 배열이 곧 정답의 일부다. */
	let facelets = $state<string | null>(null);
	let cube = $state<CubeState | null>(null);
	let targetsText = $state('');
	let twistsText = $state('');
	let verdict = $state<TraceVerdict | null>(null);
	let answer = $state<TraceResult | null>(null);
	/** 초기 카메라 각도 (FR-TR-17). SSR 에서는 고정값이라 하이드레이션이 흔들리지 않는다. */
	let orientation = $state(0);

	/* ── 계시 (FR-TR-23) ────────────────────────────────────────
	 * 측정은 `performance.now()` 다. `Date.now()` 는 시스템 시계 조정에 영향받아
	 * 음수가 나올 수 있다. 이 파일에서 벽시계를 읽는 곳은 기록의 `at` 하나뿐이다.
	 */
	let startedAt = 0;
	/** 계시가 멈춘 시각. `memorize` 는 "다 외웠다", `follow` 는 마지막 입력이다. */
	let stoppedAt = $state<number | null>(null);
	/** 마지막 입력 시각. `follow` 의 종료 시점 — 채점 버튼을 누른 시각이 아니다. */
	let lastInputAt: number | null = null;
	let nowAt = $state(0);

	/**
	 * 시작할 수 있는가 (FR-TR-2).
	 *
	 * 풀이기 초기화(`ready`)만으로는 모자란다 — 초기화 직후에는 큐가 아직 비어 있어서
	 * `take()` 가 `null` 을 낸다. 그 사이에 버튼을 열어두면 눌러도 아무 일이 없는
	 * 몇백 밀리초가 생긴다. "준비 중" 은 그 구간까지 덮는다.
	 */
	let armed = $derived(src.ready && src.queue.length > 0);

	let running = $derived(stage === 'tracing' && stoppedAt === null);
	let elapsed = $derived(stage === 'idle' ? 0 : (stoppedAt ?? nowAt) - startedAt);

	/** 입력이 열리는 조건. `follow` 는 트레이싱 중에 이미 열려 있다 (FR-TR-21). */
	let inputOpen = $derived(
		stage === 'input' || (stage === 'tracing' && tracing.mode === 'follow')
	);
	/** `memorize` 는 입력 시점에 큐브가 사라진다. 그것이 두 모드의 유일한 차이다. */
	let cubeVisible = $derived(!(stage === 'input' && tracing.mode === 'memorize'));

	let meta = $derived<(BufferMeta & { buffer: Cubie }) | null>(
		!ds ? null : pieceKind === 'edge' ? EDGE_BUFFER : ds.meta
	);
	let opts = $derived(meta ? optionsFrom(meta, pieceKind, roundConvention) : null);
	let colors = $derived(
		ds && facelets ? faceletColors(ds.meta.colorScheme, facelets) : grayFacelets()
	);

	onMount(() => {
		src.start();
		orientation = randomOrientation();
	});

	/** 100MB 가 여기서 반납된다 (NFR-TR-1). 화면을 벗어나면 워커도 함께 죽는다. */
	onDestroy(() => src.dispose());

	/** 24방향 중 하나 (FR-TR-17). 스크램블에 방향 회전을 붙이는 대신 카메라를 돌린다. */
	const randomOrientation = () => Math.floor(Math.random() * ORIENTATION_COUNT);

	/**
	 * 계시 루프. `three` 의 렌더 루프와 마찬가지로 rAF 를 쓰되, 여기서 하는 일은
	 * `$state` 하나를 갱신하는 것뿐이다 (NFR-TR-6).
	 */
	$effect(() => {
		if (!running) return;
		let live = true;
		const tick = () => {
			if (!live) return;
			nowAt = performance.now();
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		return () => {
			live = false;
		};
	});

	function start() {
		const next = src.take();
		if (!next || !ds) return;
		// 상태 계산에 쓰는 것은 언제나 `core` 다 (AD-10). `scramble` 은 표시용이고
		// 방향 회전이 섞이면 facelet 배치가 통째로 어긋난다.
		facelets = new Cube().move(next.core).asString();
		roundConvention = tracing.convention;
		pieceKind = tracing.pieceKind === 'edge' ? 'edge' : 'corner';
		beginRound();
	}

	/** 한 판의 시작. `both` 의 두 번째 판은 **같은 스크램블** 로 여기만 다시 탄다. */
	function beginRound() {
		if (!facelets) return;
		cube = stateFromFacelets(facelets, pieceKind);
		targetsText = '';
		twistsText = '';
		verdict = null;
		answer = null;
		stoppedAt = null;
		lastInputAt = null;
		startedAt = performance.now();
		nowAt = startedAt;
		stage = 'tracing';
	}

	/** "다 외웠다" — `memorize` 의 종료 시점이다. 입력 시간은 트레이싱 시간이 아니다. */
	function memorized() {
		stoppedAt = performance.now();
		stage = 'input';
	}

	/** 입력이 있을 때마다 시각을 남긴다. `follow` 의 종료 시점이 이것이다. */
	function noteInput() {
		if (stage === 'tracing') lastInputAt = performance.now();
	}

	/**
	 * 입력 문자를 타깃 열로 바꾼다.
	 *
	 * 코너는 대문자, 엣지는 소문자다 (FR-TR-18). 사용자가 어느 쪽으로 치든 이번 판의
	 * 조각 종류로 맞춰준다 — 대소문자를 틀린 것은 다른 조각을 지목한 것이 아니다.
	 * 공백·줄바꿈·쉼표는 구분자로 본다.
	 */
	const letters = (text: string): string[] =>
		[...(pieceKind === 'edge' ? text.toLowerCase() : text.toUpperCase())].filter((ch) =>
			/[A-Za-z]/.test(ch)
		);

	function gradeRound() {
		if (!cube || !opts || !meta) return;
		// `follow` 는 마지막 입력이 끝점이다. 입력이 하나도 없으면 지금이 끝점이다.
		stoppedAt ??= lastInputAt ?? performance.now();
		const input = { targets: letters(targetsText), twists: letters(twistsText) };
		verdict = gradeMemo(cube, input, opts);
		answer = trace(cube, opts);
		tracing.add({
			// 이 파일에서 벽시계를 읽는 유일한 자리다. 표시용 시각이고 측정값이 아니다.
			at: Date.now(),
			ms: Math.round(stoppedAt - startedAt),
			pieceKind,
			buffer: meta.buffer,
			mode: tracing.mode,
			twistConvention: roundConvention,
			// 스크램블이 정한 개수다. 사용자의 입력 길이가 아니라 문제의 난이도가 남는다.
			targetCount: answer.targets.length,
			correct: verdict.kind === 'correct' || verdict.kind === 'correct-extra'
		});
		stage = 'result';
	}

	/**
	 * 다음. `both` 에서 코너를 끝냈으면 **같은 스크램블로** 엣지를 이어서 한다 —
	 * 실전이 그렇고, 그때 코너 파지가 가장 어려운 지점이 된다 (FR-TR-19).
	 */
	function next() {
		if (tracing.pieceKind === 'both' && pieceKind === 'corner') {
			pieceKind = 'edge';
			beginRound();
			return;
		}
		stage = 'idle';
		facelets = null;
		cube = null;
		verdict = null;
		answer = null;
		// 각도는 `idle` 에 들어올 때만 흔든다. 사용자가 미리 잡아둔 각도를 시작이
		// 뺏으면 회색 상태에서 돌려볼 이유가 없어진다 (FR-TR-22).
		orientation = randomOrientation();
	}
</script>

<svelte:head><title>트레이싱 훈련</title></svelte:head>

<!--
	`data-orientation` 은 검사용 신호다 (FR-TR-17). 회색 큐브는 24방향에서 **같은
	그림** 이라 픽셀로는 각도가 무작위인지 확인할 길이 없다 — 큐브의 회전 대칭이
	정확히 그 24개이기 때문이다. 그래서 각도를 숫자로 내놓는다. 스크램블은 여기에
	실리지 않으므로 미리 훔쳐보기(FR-TR-22)와 무관하다.
-->
<section
	class="trace"
	data-stage={stage}
	data-piece={pieceKind}
	data-orientation={orientation}
>
	<div class="cube-slot">
		{#if cubeVisible}
			<Cube3D facelets={colors} {orientation} label="트레이싱 큐브" />
		{:else}
			<!-- 큐브를 지운 자리. 크기가 같아야 화면이 밀리지 않는다 (AD-14). -->
			<div class="cube-gone" data-cube-hidden>큐브를 숨겼습니다</div>
		{/if}
	</div>

	<div class="timer-row">
		<!-- tabular-nums + 고정 폭. 숫자가 커질 때 옆이 밀리면 비교가 안 된다. -->
		<span class="timer" data-timer>{formatMs(elapsed)}</span>
		<span class="piece" data-piece-label>{pieceKind === 'edge' ? '엣지' : '코너'}</span>
	</div>

	<!-- 자리를 늘 잡아둔다. 문구가 생겼다 사라진다고 아래가 밀리면 안 된다. -->
	<p class="status" data-status>
		{#if browser && !armed}준비 중{/if}
		{#if browser && src.error}스크램블 생성 실패: {src.error}{/if}
	</p>

	<div class="controls">
		<button type="button" data-start disabled={stage !== 'idle' || !armed} onclick={start}>
			시작
		</button>
		<button
			type="button"
			data-memorized
			disabled={!(stage === 'tracing' && tracing.mode === 'memorize')}
			onclick={memorized}
		>
			다 외웠다
		</button>
		<button type="button" data-grade disabled={!inputOpen} onclick={gradeRound}>채점</button>
		<button type="button" data-next disabled={stage !== 'result'} onclick={next}>다음 문제</button>
	</div>

	<!--
		입력. Phase 4 가 24글자 패드로 바꾼다. 지금은 구획 둘과 활성 규칙만 세운다 —
		그 규칙이 두 모드와 두 관례의 차이가 드러나는 자리이기 때문이다.
	-->
	<div class="entry">
		<label class="field">
			<span>타깃 열</span>
			<input
				type="text"
				data-targets
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				disabled={!inputOpen}
				bind:value={targetsText}
				oninput={noteInput}
			/>
		</label>
		<label class="field">
			<span>비틀림</span>
			<input
				type="text"
				data-twists
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				disabled={!inputOpen || roundConvention !== 'B'}
				bind:value={twistsText}
				oninput={noteInput}
			/>
		</label>
	</div>

	<p class="verdict" data-verdict>{verdict ? verdictText(verdict) : ''}</p>

	<div class="settings">
		<SegToggle name="trace-kind" bind:value={tracing.pieceKind} options={KIND_OPTIONS} />
		<SegToggle name="trace-mode" bind:value={tracing.mode} options={MODE_OPTIONS} />
		<SegToggle
			name="trace-convention"
			bind:value={tracing.convention}
			options={CONVENTION_OPTIONS}
		/>
	</div>

	{#if browser && tracing.records.length > 0}
		<ul class="records" data-records>
			{#each tracing.recent(5) as r (r.at + '/' + r.pieceKind)}
				<li data-record>
					<span class="t">{formatMs(r.ms)}</span>
					<span>{r.pieceKind === 'edge' ? '엣지' : '코너'}</span>
					<span>타깃 {r.targetCount}</span>
					<span>{r.correct ? '정답' : '오답'}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.trace {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.6rem;
	}
	/* 캔버스 자리는 SSR 에서 확정된다. 하이드레이션 후 크기가 바뀌면 화면이 밀린다. */
	.cube-slot {
		width: 100%;
	}
	.cube-gone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		max-width: 420px;
		margin: 0 auto;
		aspect-ratio: 1 / 1;
		font-size: 0.85rem;
		color: var(--muted);
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: 12px;
	}
	.timer-row {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.6rem;
	}
	.timer {
		min-width: 6.5ch;
		font-family: var(--mono);
		font-size: 1.6rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
	.piece {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.status,
	.verdict {
		/* 문구가 없어도 자리를 지킨다. 생겼다 사라지며 아래를 미는 것을 막는다. */
		min-height: 1.3rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
		text-align: center;
	}
	.verdict {
		color: var(--fg);
	}
	.controls {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.4rem;
	}
	.controls button {
		/* 터치 타깃 44px (FR-MC-4 와 같은 기준). */
		min-height: 44px;
		font-size: 0.9rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 9px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.controls button:disabled {
		color: var(--muted);
		cursor: default;
		opacity: 0.55;
	}
	.entry {
		display: grid;
		gap: 0.4rem;
	}
	.field {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.field input {
		min-height: 44px;
		min-width: 0;
		padding: 0 0.6rem;
		font-family: var(--mono);
		font-size: 1rem;
		letter-spacing: 0.08em;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 9px;
	}
	.field input:disabled {
		opacity: 0.55;
	}
	.settings {
		display: grid;
		gap: 0.5rem;
	}
	.records {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.records li {
		display: flex;
		gap: 0.6rem;
		font-family: var(--mono);
	}
	.records .t {
		font-variant-numeric: tabular-nums;
	}
</style>
