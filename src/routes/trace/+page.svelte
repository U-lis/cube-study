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
	import StickerPad from '$lib/ui/StickerPad.svelte';
	import { ScrambleSource } from '$lib/ui/scramble.svelte.js';
	import { tracing } from '$lib/ui/tracing.svelte.js';
	import { faceletColors, grayFacelets } from '$lib/ui/facelets.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { stateFromFacelets, type CubeState, type PieceKind } from '$lib/cube/sim.js';
	import { ORIENTATION_COUNT, type Mark } from '$lib/cube/cube3d-map.js';
	import { CORNER_LETTERS, EDGE_LETTERS } from '$lib/cube/speffz.js';
	import { gradeMemo, trace, type TraceResult, type TraceVerdict } from '$lib/cube/trace.js';
	import {
		buildMarks,
		conventionCompare,
		formatMs,
		optionsFrom,
		sanitizeEntry,
		twistEntries,
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

	/**
	 * 입력 상한 (FR-TR-18). `MoveKeypad.svelte:9` 의 `MAX_MOVES` 와 같은 취지다 —
	 * 붙여넣기 한 번이나 버튼 연타로 화면이 굳는 것을 막는다.
	 *
	 * 타깃 열은 코너 평균 8·엣지 평균 12 이고 끊기가 늘면 더 는다. 40 은 그 최악보다
	 * 넉넉하되 사람이 낼 수 있는 길이의 범위 안이다. 비틀림은 조각 수가 상한이라
	 * 코너 8·엣지 12 를 넘을 수 없다.
	 */
	const MAX_TARGETS = 40;
	const MAX_TWISTS = 12;

	/** 하이라이트 없음. 렌더마다 새 배열을 만들면 뷰어의 `$effect` 가 계속 돈다. */
	const NO_MARKS: (Mark | null)[] = Array.from({ length: 54 }, () => null);

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
	/**
	 * 두 구획의 입력 (FR-TR-18). 실전이 letter 열과 twist 를 따로 담는 것과 같다.
	 * 타깃 열은 **순서** 가 의미를 갖고, 비틀림은 **집합** 이라 순서를 채점하지 않는다.
	 */
	let targets = $state<string[]>([]);
	let twists = $state<string[]>([]);
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

	/** 이번 판의 패드 배치. 코너는 대문자, 엣지는 소문자다 (FR-TR-18). */
	let padLetters = $derived(pieceKind === 'edge' ? EDGE_LETTERS : CORNER_LETTERS);
	/** 관례 B 에서만 비틀림 구획이 열린다. 관례 A 는 전부 타깃 열에 들어간다. */
	let twistsOpen = $derived(inputOpen && roundConvention === 'B');

	/**
	 * 54칸 하이라이트 (FR-TR-16).
	 *
	 * **트레이싱 중에만** 칠한다. `idle` 은 회색 단계라 칠할 것이 없고(FR-TR-22),
	 * `result` 에서 정답 경로를 칠하면 그것은 다음 판의 힌트가 된다 — 화면이 정답
	 * 배열을 들고 있는 상태 자체를 만들지 않는 편이 안전하다 (FR-TR-15).
	 *
	 * 넘기는 것은 **사용자가 입력한 문자열뿐** 이다. 정답은 이 경로에 없다.
	 */
	let marks = $derived(
		meta && stage === 'tracing' ? buildMarks(pieceKind, meta, targets) : NO_MARKS
	);

	/** 결과의 두 관례 타깃 수 (FR-TR-24). 채점 시점에 굳힌다. */
	let compare = $state<{ a: number; b: number } | null>(null);
	/** 결과의 비틀림 목록. 버퍼가 섞였으면 따로 밝힌다 (AD-8). */
	let answerTwists = $derived(
		answer && meta ? twistEntries(answer.twists, pieceKind, meta.buffer) : []
	);
	/** 패리티 (FR-TR-13). 코너 타깃이 홀수일 때다 — 엣지 세션에서는 판단하지 않는다. */
	let parity = $derived(pieceKind === 'corner' && (answer?.parity ?? false));
	/** 첫 어긋난 지점. 표시는 1부터 센다 (`verdictText` 와 같은 규약). */
	let wrongIndex = $derived(verdict?.kind === 'wrong-at' ? verdict.index + 1 : null);

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
		targets = [];
		twists = [];
		verdict = null;
		answer = null;
		compare = null;
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
	 * 하드웨어 키보드 경로 (FR-TR-18).
	 *
	 * 패드와 **같은 규칙** 을 지나야 한다 — 정리는 `sanitizeEntry` 하나가 한다.
	 * 두 경로가 각자 정리하면 "패드로는 막히는데 키보드로는 들어가는" 문자가 생기고,
	 * 그 차이는 채점 결과로만 드러나 원인을 찾기 어렵다.
	 *
	 * 소프트 키보드는 `inputmode="none"` 으로 막는다. 모바일에서는 패드가 입력
	 * 수단이고, 그 위로 시스템 키보드가 올라오면 큐브가 가려진다. 하드웨어 키보드는
	 * 그대로 들어온다.
	 *
	 * 전역 키 훅을 걸지 않는다. 이 핸들러는 입력 칸에 포커스가 있을 때만 도므로
	 * 다른 화면·다른 버튼에서 친 글자를 훔쳐가지 않는다.
	 */
	function onEntry(e: Event & { currentTarget: HTMLInputElement }, twist: boolean) {
		const cleaned = sanitizeEntry(
			e.currentTarget.value,
			pieceKind,
			// 버퍼 차단은 **타깃 구획에만** 건다. 버퍼가 비틀린 채 남는 경우가 코너
			// 80.9% 라, 비틀림 구획에서 막으면 관례 B 훈련이 성립하지 않는다.
			twist ? { max: MAX_TWISTS } : { blocked: meta?.bufferStickers, max: MAX_TARGETS }
		);
		if (twist) twists = cleaned;
		else targets = cleaned;
		// 거부된 문자를 DOM 에 한 프레임이라도 남기면 커서가 뛴다. 즉시 되돌린다.
		e.currentTarget.value = cleaned.join('');
		noteInput();
	}

	/** `Backspace` 는 브라우저가 처리하고 `oninput` 이 받는다. 여기는 나머지 둘이다. */
	function onEntryKey(e: KeyboardEvent, twist: boolean) {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (twist) twists = [];
			else targets = [];
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (inputOpen) gradeRound();
		}
	}

	function gradeRound() {
		if (!cube || !opts || !meta) return;
		// `follow` 는 마지막 입력이 끝점이다. 입력이 하나도 없으면 지금이 끝점이다.
		stoppedAt ??= lastInputAt ?? performance.now();
		// 화면은 **엔진 결과만** 쓴다. 정답 예시와 사용자의 입력을 문자열로 비교하는
		// 코드가 여기 생기면 "정답이 평균 11가지" 라는 전제가 조용히 깨진다 (AD-7).
		verdict = gradeMemo(cube, { targets, twists }, opts);
		answer = trace(cube, opts);
		compare = conventionCompare(cube, opts);
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
		compare = null;
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
			<Cube3D facelets={colors} {marks} {orientation} label="트레이싱 큐브" />
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
		입력 구획 둘 (FR-TR-18). 실전이 letter 열과 twist 를 따로 담는 것과 같다.

		관례 A 에서 비틀림 구획을 `{#if}` 로 **지우지 않는다.** 전부 타깃 열에
		들어가므로 쓸 일이 없지만, 없앴다 되살리면 관례를 바꿀 때마다 화면이 통째로
		밀린다 (AD-14). 자리는 두고 잠근다.
	-->
	<div class="entry">
		<section class="slot" data-section="targets">
			<label class="field">
				<span>타깃 열</span>
				<input
					type="text"
					data-targets
					inputmode="none"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					disabled={!inputOpen}
					value={targets.join('')}
					oninput={(e) => onEntry(e, false)}
					onkeydown={(e) => onEntryKey(e, false)}
				/>
			</label>
			<StickerPad
				pad="targets"
				letters={padLetters}
				bind:value={targets}
				blocked={meta?.bufferStickers ?? []}
				disabled={!inputOpen}
				max={MAX_TARGETS}
				onedit={noteInput}
			/>
		</section>

		<section class="slot" data-section="twists">
			<label class="field">
				<span>비틀림</span>
				<input
					type="text"
					data-twists
					inputmode="none"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					disabled={!twistsOpen}
					value={twists.join('')}
					oninput={(e) => onEntry(e, true)}
					onkeydown={(e) => onEntryKey(e, true)}
				/>
			</label>
			<!-- 순서를 채점하지 않는다 — 집합으로 본다 (FR-TR-18). -->
			<p class="hint" data-twists-hint>
				{roundConvention === 'B'
					? '순서는 채점하지 않습니다. 문자 하나로 적습니다'
					: '관례 A 에서는 비틀림도 타깃 열에 들어갑니다'}
			</p>
			<StickerPad
				pad="twists"
				letters={padLetters}
				bind:value={twists}
				disabled={!twistsOpen}
				max={MAX_TWISTS}
				onedit={noteInput}
			/>
		</section>
	</div>

	<p class="verdict" data-verdict data-kind={verdict?.kind ?? ''} data-wrong-index={wrongIndex}>
		{verdict ? verdictText(verdict) : ''}
	</p>

	<!--
		결과 (FR-TR-11, 13, 20, 24).

		정답 예시를 사용자의 입력과 비교해 "틀렸다" 고 말하지 않는다. 유효한 메모가
		평균 11가지라 예시는 예시일 뿐이다 — 판정은 위 `data-verdict` 하나뿐이고
		그 출처는 `gradeMemo` 다 (AD-7).
	-->
	{#if answer && compare}
		<div class="result" data-result>
			<p class="row">
				<span class="k">정답 예시</span>
				<span class="v mono" data-answer>{answer.targets.join('')}</span>
			</p>
			<p class="note" data-answer-note>
				정답은 여럿입니다. 끊는 자리를 다르게 잡은 열도 정답이며 위는 그중 하나입니다
			</p>
			{#if roundConvention === 'B'}
				<p class="row">
					<span class="k">비틀림</span>
					<span class="v mono" data-answer-twists>
						{#each answerTwists as t (t.letter)}<span
								data-twist={t.letter}
								data-buffer={t.isBuffer ? 'true' : 'false'}>{t.letter}{t.isBuffer ? '(버퍼)' : ''}</span
							>{/each}{answerTwists.length === 0 ? '없음' : ''}
					</span>
				</p>
				{#if answerTwists.some((t) => t.isBuffer)}
					<!-- "왜 이게 목록에 있는가" 는 관례 B 를 처음 보면 반드시 나온다 (AD-8). -->
					<p class="note" data-buffer-note>
						버퍼가 비틀린 채 남았습니다. 방향의 합이 보존되므로 다른 조각의 비틀림을
						남기면 버퍼가 그 보정을 떠안습니다
					</p>
				{/if}
			{/if}
			<!-- 사실 한 줄만 적는다. 처리 알고리즘 안내는 이번 범위 밖이다. -->
			<p class="row" data-parity={parity ? 'true' : 'false'}>
				<span class="k">패리티</span>
				<span class="v">{parity ? '코너 타깃이 홀수입니다 (패리티)' : ''}</span>
			</p>
			<p class="row" data-convention-compare data-count-a={compare.a} data-count-b={compare.b}>
				<span class="k">타깃 수</span>
				<span class="v">관례 A {compare.a}개 · 관례 B {compare.b}개</span>
			</p>
		</div>
	{/if}

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
		gap: 0.9rem;
	}
	.slot {
		display: grid;
		gap: 0.4rem;
		/* 320px 에서도 안쪽 격자가 밖으로 밀지 않는다. */
		min-width: 0;
	}
	.hint {
		margin: 0;
		font-size: 0.72rem;
		color: var(--muted);
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
	/*
	 * 결과. 배지도 점수도 색 강조도 없다 — 사실만 줄로 적는다 (NFR-TR-5).
	 * 정답과 오답의 배경색이 다르지도 않다. 틀린 이유를 짚는 것이 이 화면의 일이다.
	 */
	.result {
		display: grid;
		gap: 0.3rem;
		padding: 0.6rem 0.7rem;
		font-size: 0.82rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.result .row {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.5rem;
		margin: 0;
		min-width: 0;
	}
	.result .k {
		color: var(--muted);
	}
	.result .v {
		min-width: 0;
		color: var(--fg);
		/* 타깃 열은 길다. 줄이 넘치면 가로 스크롤이 아니라 줄바꿈이 된다. */
		overflow-wrap: anywhere;
	}
	.result .mono {
		font-family: var(--mono);
		letter-spacing: 0.08em;
	}
	[data-answer-twists] span {
		margin-right: 0.4em;
	}
	.result .note {
		margin: 0;
		font-size: 0.74rem;
		line-height: 1.5;
		color: var(--muted);
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
