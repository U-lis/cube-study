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
	import Records from '$lib/ui/Records.svelte';
	import { ScrambleSource } from '$lib/ui/scramble.svelte.js';
	import { tracing } from '$lib/ui/tracing.svelte.js';
	import { faceletColors, grayFacelets } from '$lib/ui/facelets.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { stateFromFacelets, type PieceKind } from '$lib/cube/sim.js';
	import { ORIENTATION_COUNT, type Mark } from '$lib/cube/cube3d-map.js';
	import { CORNER_LETTERS, EDGE_LETTERS } from '$lib/cube/speffz.js';
	import {
		gradeEntry,
		trace,
		type EntryReading,
		type TraceResult,
		type TraceVerdict
	} from '$lib/cube/trace.js';
	import {
		buildMarks,
		caseConflicts,
		combineVerdicts,
		conventionOf,
		entrySegments,
		formatMs,
		hasSeparator,
		isPass,
		joinBuffers,
		kindsOf,
		optionsFrom,
		partsVerdictText,
		readingText,
		sanitizeEntry,
		segmentIndex,
		twistEntries,
		verdictText,
		CONVENTION_HEADING,
		CONVENTION_HINTS,
		CONVENTIONS,
		ENTRY_SEPARATOR,
		PART_LABELS,
		SEPARATOR_LABEL,
		TRAIN_KIND_HEADING,
		TRAIN_KINDS,
		TRAIN_MODE_HEADING,
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
	 * 한 판의 한 갈래 결과 (요구 2).
	 *
	 * 코너만·엣지만 하는 판은 이것이 하나, `both` 는 둘이다. 기록은 그래도 한 건이다 —
	 * 갈래는 채점의 단위이고 기록의 단위는 판이다.
	 */
	interface Part {
		kind: PieceKind;
		verdict: TraceVerdict;
		/** 채점 시점의 판독. 결과가 "무엇을 비틀림으로 읽었는가" 를 밝힌다. */
		reading: EntryReading;
		answer: TraceResult;
		/** 비틀림 목록. 버퍼가 섞였으면 따로 밝힌다 (AD-8). */
		twists: { letter: string; isBuffer: boolean }[];
		/** 패리티 (FR-TR-13). 코너 타깃이 홀수일 때다 — 엣지에서는 판단하지 않는다. */
		parity: boolean;
	}

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
	 * 넉넉하되 사람이 낼 수 있는 길이의 범위 안이다. 비틀림 선언도 같은 줄에 들어오지만
	 * 조각 수가 상한이라 이 값을 밀어내지 못한다.
	 */
	const MAX_ENTRY = 40;

	/** 하이라이트 없음. 렌더마다 새 배열을 만들면 뷰어의 `$effect` 가 계속 돈다. */
	const NO_MARKS: (Mark | null)[] = Array.from({ length: 54 }, () => null);

	/** 대상 선택의 한 줄 설명. 라벨은 이름이고 이쪽이 "그래서 무엇이 다른가" 다. */
	const KIND_HINT: Record<TrainKind, string> = {
		corner: '코너만 트레이싱합니다',
		edge: '엣지만 트레이싱합니다',
		both: `한 줄에 코너와 엣지를 이어 치고 한 번에 채점합니다`
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
		label: CONVENTIONS[value],
		hint: CONVENTION_HINTS[value],
		title: CONVENTION_HINTS[value]
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
	/**
	 * 시작 시점에 **고정** 한 훈련 대상 (요구 4).
	 *
	 * 설정(`tracing.pieceKind`)을 직접 읽지 않는다. 판이 도는 동안 토글은 잠기지만,
	 * 잠금이 풀리는 결과 단계에서 설정을 바꿔도 이미 채점한 판의 갈래 구성이
	 * 흔들리면 안 된다.
	 */
	let roundKind = $state<TrainKind>('corner');
	/**
	 * 시작 시점에 **고정** 한 관례.
	 *
	 * 채점 기준이 아니다 — 판정은 `gradeEntry` 가 입력만 보고 하고, 어느 관례로
	 * 쳐도 정답은 정답이다. 이 값이 정하는 것은 결과 화면이 정답 예시와 타깃 수를
	 * 어느 관례로 보여줄지 하나뿐이다.
	 */
	let roundConvention = $state<TwistConvention>(CONVENTION_OPTIONS[0].value);
	/** 54칸 facelet 문자열. 시작 전에는 `null` 이다 — 색 배열이 곧 정답의 일부다. */
	let facelets = $state<string | null>(null);
	/**
	 * 한 줄 입력 (FR-TR-18, 요구 2).
	 *
	 * 구획을 둘로 나누지 않는다. 24글자 패드가 두 벌이면 버튼이 두 줄이 되는데,
	 * 그 값을 치르고 얻는 것은 사용자가 이미 아는 사실 — 어느 것이 비틀림인가 —
	 * 을 한 번 더 적게 하는 것뿐이다. 판정은 `readEntry` 가 한다.
	 *
	 * `both` 는 이 한 줄 **안에** 구분자가 서고, 코너와 엣지가 그 앞뒤로 나뉜다.
	 * 제출도 채점도 한 번이다.
	 */
	let entry = $state<string[]>([]);
	/** 교차 검증 (요구 2). 구분자와 대소문자가 어긋난 글자 수다. */
	let conflicts = $state(0);
	/**
	 * 채점 결과. 갈래마다 한 건이고 `both` 는 둘이다.
	 *
	 * 화면이 `{#each}` 로 그리므로 코너만 하는 판과 `both` 판이 **같은 코드** 를
	 * 지난다. 갈래별로 분기를 적으면 한쪽만 고쳐지는 날이 온다.
	 */
	let parts = $state<Part[]>([]);
	/** 초기 카메라 각도 (FR-TR-17). SSR 에서는 고정값이라 하이드레이션이 흔들리지 않는다. */
	let orientation = $state(0);
	/** 기록 모달 (요구 3). `+layout.svelte` 가 `About` 을 여는 방식과 같다. */
	let recordsModal: ReturnType<typeof Records> | undefined = $state();

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

	/** 이번 판의 갈래들. `both` 는 [코너, 엣지] 이고 순서가 구분자의 앞뒤다. */
	let kinds = $derived(kindsOf(roundKind));
	/**
	 * 지금 치고 있는 갈래 (요구 2).
	 *
	 * **입력에서 읽는다.** 별도의 상태로 두면 구분자를 지웠을 때 되돌리는 코드를
	 * 따로 적어야 하고, 그 둘이 어긋나면 패드 글자와 채점 기준이 갈린다.
	 */
	let padKind = $derived(kinds[segmentIndex(entry, kinds)]);

	/** 조각 종류별 버퍼. 엣지 데이터셋(#16)이 생기면 이 함수만 바뀐다. */
	const metaOf = (kind: PieceKind): (BufferMeta & { buffer: Cubie }) | null =>
		!ds ? null : kind === 'edge' ? EDGE_BUFFER : ds.meta;

	let meta = $derived(metaOf(padKind));
	let colors = $derived(
		ds && facelets ? faceletColors(ds.meta.colorScheme, facelets) : grayFacelets()
	);

	/** 지금 갈래의 패드 배치. 코너는 대문자, 엣지는 소문자다 (FR-TR-18). */
	let padLetters = $derived(padKind === 'edge' ? EDGE_LETTERS : CORNER_LETTERS);
	/** 구분자를 넣을 수 있는가 — 갈래가 둘이고 아직 안 갈렸을 때뿐이다. */
	let canSplit = $derived(inputOpen && kinds.length > 1 && !hasSeparator(entry));
	/**
	 * 이 세션에서 갈래를 가를 일이 있는가 (요구 4).
	 *
	 * 코너만·엣지만 하는 판에서 구분자 버튼은 영영 눌리지 않는다. `disabled` 로만
	 * 두면 쓸 일 없는 버튼이 계속 보이므로 **눈에서만** 지운다 — 요소는 그대로
	 * 있고 자리도 그대로다 (`visibility: hidden`). `{#if}` 로 없애면 대상 설정이
	 * 저장소에서 오므로 SSR 과 CSR 의 버튼 개수가 갈린다 (AD-14).
	 *
	 * 시작 전에는 **설정값** 을 본다. `roundKind` 는 시작 시점에 굳는 값이라
	 * `idle` 에서는 직전 판의 갈래를 가리키고, 그러면 대상을 바꿔도 버튼이
	 * 따라오지 않는다.
	 */
	let splitUsable = $derived(
		(stage === 'idle' ? kindsOf(tracing.pieceKind) : kinds).length > 1
	);
	/**
	 * 입력 칸의 한 줄 설명. `both` 는 구분자를 어떻게 넣는지가 먼저다 — 그것을
	 * 모르면 코너와 엣지가 한 덩어리로 붙어 채점이 통째로 어긋난다.
	 */
	let entryHint = $derived(
		kinds.length > 1
			? `${SEPARATOR_LABEL} 를 눌러 코너와 엣지를 가릅니다. 비틀림은 버퍼막힘(break-in)으로 이어 쳐도 되고 문자 하나로 적어도 됩니다`
			: '비틀림은 버퍼막힘(break-in)으로 이어 쳐도 되고 문자 하나로 따로 적어도 됩니다. 채점이 알아서 읽습니다'
	);
	/**
	 * 세션 설정 잠금 (요구 4).
	 *
	 * 문제가 시작되면 대상·모드·관례를 못 바꾼다. 도중에 바뀌면 이미 친 입력의
	 * 판정 기준이 흔들리고, 기록의 세 필드가 무엇을 가리키는지 알 수 없게 된다.
	 * `idle` 로 돌아오는 "다음 문제" 시점에 다시 풀린다.
	 */
	let settingsLocked = $derived(stage !== 'idle');

	/**
	 * 54칸 하이라이트 (FR-TR-16).
	 *
	 * **트레이싱 중에만** 칠한다. `idle` 은 회색 단계라 칠할 것이 없고(FR-TR-22),
	 * `result` 에서 정답 경로를 칠하면 그것은 다음 판의 힌트가 된다 — 화면이 정답
	 * 배열을 들고 있는 상태 자체를 만들지 않는 편이 안전하다 (FR-TR-15).
	 *
	 * 넘기는 것은 **사용자가 입력한 문자열뿐** 이다. 정답은 이 경로에 없다.
	 *
	 * `both` 는 **지금 갈래의 몫만** 칠한다. 구분자 앞의 코너 문자를 엣지 좌표로
	 * 칠하면 엉뚱한 조각이 켜진다 — 두 갈래는 좌표계가 다르다.
	 */
	let marks = $derived(
		meta && stage === 'tracing'
			? buildMarks(padKind, meta, entrySegments(entry, kinds)[segmentIndex(entry, kinds)].letters)
			: NO_MARKS
	);

	/** 한 줄로 합친 판정 (요구 2). `both` 는 처음 틀린 갈래가 그대로 올라온다. */
	let verdict = $derived(parts.length > 0 ? combineVerdicts(parts) : null);
	/** 첫 어긋난 지점. 표시는 1부터 센다 (`verdictText` 와 같은 규약). */
	let wrongIndex = $derived(verdict?.kind === 'wrong-at' ? verdict.index + 1 : null);
	/**
	 * 판정의 색 (요구 3). 퀴즈 화면과 **같은 규약** 이다 — `ok` / `bad` / 빈 문자열.
	 *
	 * 불필요한 버퍼막힘은 `ok` 다. 풀리는 메모를 빨강으로 칠하면 색이 판정과
	 * 어긋난다 (FR-TR-12). 판단은 `isPass` 하나가 하고 여기서 되풀이하지 않는다.
	 *
	 * 색만으로 알리지 않는다 (#26) — 같은 자리에 판정 문구가 함께 선다. 퀴즈가
	 * 하는 것과 같은 수준이고, 새 표시 방식을 만들지 않는다.
	 */
	let resultTone = $derived(verdict ? (isPass(verdict) ? 'ok' : 'bad') : '');

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
		// 세 설정을 시작 시점에 굳힌다 (요구 4). 판이 도는 동안 토글은 잠기고,
		// 결과 단계에서 풀려도 이미 채점한 판이 흔들리지 않는다.
		roundConvention = tracing.convention;
		roundKind = tracing.pieceKind;
		entry = [];
		conflicts = 0;
		parts = [];
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
	function onEntry(e: Event & { currentTarget: HTMLInputElement }) {
		const typed = e.currentTarget.value;
		// 버퍼 문자도 막지 않는다 (요구 5). 잠글 자리가 문맥에 따라 갈리면 사용자가
		// 예측할 수 없고, 버퍼를 타깃으로 쓴 것은 채점이 짚어 준다.
		const cleaned = sanitizeEntry(typed, kinds, { max: MAX_ENTRY });
		// 대소문자는 판정에 쓰지 않고 여기서만 본다 — 구분자가 정본이다 (요구 2).
		conflicts = caseConflicts(typed, kinds);
		entry = cleaned;
		// 거부된 문자를 DOM 에 한 프레임이라도 남기면 커서가 뛴다. 즉시 되돌린다.
		e.currentTarget.value = cleaned.join('');
		noteInput();
	}

	/** `Backspace` 는 브라우저가 처리하고 `oninput` 이 받는다. 여기는 나머지 둘이다. */
	function onEntryKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			entry = [];
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (inputOpen) gradeRound();
		}
	}

	/**
	 * 한 번에 채점한다 (요구 2).
	 *
	 * `both` 도 제출은 한 번이다. 갈래마다 **따로 판정** 하되 — 코너와 엣지는
	 * 좌표계도 버퍼도 다르므로 한 번에 볼 수 없다 — 기록은 한 건으로 남긴다.
	 */
	function gradeRound() {
		const state = facelets;
		if (!state || !ds) return;
		// `follow` 는 마지막 입력이 끝점이다. 입력이 하나도 없으면 지금이 끝점이다.
		stoppedAt ??= lastInputAt ?? performance.now();
		const graded: Part[] = [];
		for (const { kind, letters } of entrySegments(entry, kinds)) {
			const m = metaOf(kind);
			if (!m) return;
			const o = optionsFrom(m, kind, roundConvention);
			const cube = stateFromFacelets(state, kind);
			// 화면은 **엔진 결과만** 쓴다. 정답 예시와 사용자의 입력을 문자열로 비교하는
			// 코드가 여기 생기면 "정답이 평균 11가지" 라는 전제가 조용히 깨진다 (AD-7).
			// 판정은 입력만 본다. 세션 관례는 `answer` 의 표시 방식만 정한다.
			const { verdict: v, reading } = gradeEntry(cube, letters, o);
			const answer = trace(cube, o);
			graded.push({
				kind,
				verdict: v,
				reading,
				answer,
				twists: twistEntries(answer.twists, kind, m.buffer),
				parity: kind === 'corner' && answer.parity
			});
		}
		parts = graded;
		tracing.add({
			// 이 파일에서 벽시계를 읽는 유일한 자리다. 표시용 시각이고 측정값이 아니다.
			at: Date.now(),
			ms: Math.round(stoppedAt - startedAt),
			// 판이 기록의 단위다. `both` 한 판은 두 건이 아니라 한 건이다.
			pieceKind: roundKind,
			buffer: joinBuffers(graded.map((p) => metaOf(p.kind)!.buffer)),
			mode: tracing.mode,
			// 설정값이 아니라 **사용자가 실제로 친 방식** 이다 (요구 1). 한쪽이라도
			// 따로 선언했으면 따로 처리로 적는다 — 섞어 친 판을 끊어서 처리로 적으면
			// 타깃 수가 왜 그만큼인지 설명되지 않는다.
			twistConvention: conventionOf(graded.some((p) => p.reading.separated)),
			// 스크램블이 정한 개수다. 사용자의 입력 길이가 아니라 문제의 난이도가 남는다.
			// `both` 는 합계다 — 시간도 두 갈래를 합쳐 잰 값이라 단위가 맞는다.
			targetCount: graded.reduce((n, p) => n + p.answer.targets.length, 0),
			// 양쪽 다 맞아야 정답이다. 한쪽만 맞은 판은 오답으로 남는다.
			correct: graded.every((p) => isPass(p.verdict))
		});
		stage = 'result';
	}

	/** 다음 문제. `both` 도 한 판이 여기서 끝난다 — 이어지는 반쪽이 없다 (요구 2). */
	function next() {
		stage = 'idle';
		facelets = null;
		entry = [];
		conflicts = 0;
		parts = [];
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
	data-piece={padKind}
	data-kind={roundKind}
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
		<span class="piece" data-piece-label>{PART_LABELS[padKind]}</span>
	</div>

	<!-- 자리를 늘 잡아둔다. 문구가 생겼다 사라진다고 아래가 밀리면 안 된다. -->
	<p class="status" data-status>
		{#if browser && !armed}준비 중{/if}
		{#if browser && src.error}스크램블 생성 실패: {src.error}{/if}
	</p>

	<!--
		세션 설정. **시작 버튼 바로 위** 다 — 화면 아래에 두었더니 끝까지 내려가야
		보여서 있는 줄 모르고 쓴다. 고르고 시작하는 순서가 그대로 세로 순서다.

		문제가 도는 동안은 잠긴다 (요구 4). `{#if}` 로 없애지 않는다 — 자리가
		사라지면 화면이 밀리고 SSR/CSR 요소 개수도 갈린다 (AD-14).
	-->
	<div class="settings">
		<SegToggle
			name="trace-kind"
			heading={TRAIN_KIND_HEADING}
			bind:value={tracing.pieceKind}
			options={KIND_OPTIONS}
			disabled={settingsLocked}
		/>
		<SegToggle
			name="trace-mode"
			heading={TRAIN_MODE_HEADING}
			bind:value={tracing.mode}
			options={MODE_OPTIONS}
			disabled={settingsLocked}
		/>
		<SegToggle
			name="trace-convention"
			heading={CONVENTION_HEADING}
			bind:value={tracing.convention}
			options={CONVENTION_OPTIONS}
			disabled={settingsLocked}
		/>
	</div>

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
		입력 한 줄 (FR-TR-18).

		구획을 둘로 나누지 않는다. 24글자 패드가 두 벌이면 화면에 버튼이 48개가 되고,
		그 값을 치르고 얻는 것은 "어느 것이 비틀림인가" 를 사용자가 한 번 더 적는
		일뿐이다. 그 정보는 입력 안에 이미 있다 — 같은 큐비가 연속 두 번이면 끊어서
		처리한 것이고, 단독으로 선 비틀린 조각이면 선언이다. 가르는 일은 화면이
		아니라 `readEntry` 가 한다.
	-->
	<div class="entry">
		<section class="slot" data-section="entry">
			<label class="field">
				<span>입력</span>
				<input
					type="text"
					data-entry
					data-result={resultTone}
					inputmode="none"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					disabled={!inputOpen}
					value={entry.join('')}
					oninput={onEntry}
					onkeydown={onEntryKey}
				/>
			</label>
			<p class="hint" data-entry-hint>{entryHint}</p>
			<!--
				교차 검증 (요구 2). 자리를 늘 잡아둔다 — 문구가 생겼다 사라지며 패드를
				밀면 누르던 버튼이 움직인다.
			-->
			<p class="hint conflict" data-case-hint data-conflicts={conflicts}>
				{conflicts > 0
					? `대소문자가 구분자와 어긋난 글자 ${conflicts}개는 구분자 기준으로 읽었습니다`
					: ''}
			</p>
			<StickerPad
				pad="entry"
				letters={padLetters}
				bind:value={entry}
				disabled={!inputOpen}
				max={MAX_ENTRY}
				onedit={noteInput}
				separator={ENTRY_SEPARATOR}
				separatorLabel={SEPARATOR_LABEL}
				separatorEnabled={canSplit}
				separatorHidden={!splitUsable}
			/>
		</section>
	</div>

	<!--
		판정 한 줄. `both` 는 갈래 이름을 붙여 둘을 잇는다 — 한쪽만 틀렸을 때 어느
		쪽인지 여기서 바로 읽힌다 (요구 2).

		표시 방식은 **퀴즈 화면 그대로** 다 (요구 3) — 입력창 자체가 녹색·빨강으로
		칠해지고 판정 줄이 같은 토큰으로 테두리를 받는다. 색은 문장을 읽기 전에
		결과를 알리는 몫만 하고, 무엇이 어긋났는지는 언제나 글자가 말한다 (#26).
	-->
	<p
		class="verdict"
		data-verdict
		data-kind={verdict?.kind ?? ''}
		data-result={resultTone}
		data-wrong-index={wrongIndex}
	>
		{partsVerdictText(parts)}
	</p>

	<!--
		결과 (FR-TR-11, 13, 20).

		정답 예시를 사용자의 입력과 비교해 "틀렸다" 고 말하지 않는다. 유효한 메모가
		평균 11가지라 예시는 예시일 뿐이다 — 판정의 출처는 `gradeMemo` 다 (AD-7).

		갈래마다 같은 틀을 되풀이한다. `both` 라고 다른 코드를 타지 않는다.
	-->
	{#if parts.length > 0}
		<div class="result" data-result-panel>
			{#each parts as p (p.kind)}
				<section class="part" data-part={p.kind} data-part-kind={p.verdict.kind}>
					{#if parts.length > 1}
						<p class="row">
							<span class="k">{PART_LABELS[p.kind]}</span>
							<span class="v" data-part-verdict>{verdictText(p.verdict)}</span>
						</p>
					{/if}
					<p class="row">
						<span class="k">정답 예시</span>
						<span class="v mono big" data-answer>{p.answer.targets.join('')}</span>
					</p>
					<p class="note" data-answer-note>
						정답은 여럿입니다. 버퍼막힘(break-in) 자리를 다르게 잡은 열도 정답이며 위는 그중 하나입니다
					</p>
					<!--
						입력을 어떻게 갈랐는지 밝힌다 (요구 1). 판독이 조용하면 사용자는 자기가
						친 단독 문자가 비틀림 선언으로 읽혔다는 것을 알 수 없다.
					-->
					<p
						class="row"
						data-reading
						data-read-convention={conventionOf(p.reading.separated)}
						data-read-twists={p.reading.twists.join('')}
					>
						<span class="k">입력 판독</span>
						<span class="v">{readingText(p.reading)}</span>
					</p>
					{#if roundConvention === 'B'}
						<p class="row">
							<span class="k">비틀림</span>
							<span class="v mono" data-answer-twists>
								{#each p.twists as t (t.letter)}<span
										data-twist={t.letter}
										data-buffer={t.isBuffer ? 'true' : 'false'}
										>{t.letter}{t.isBuffer ? '(버퍼)' : ''}</span
									>{/each}{p.twists.length === 0 ? '없음' : ''}
							</span>
						</p>
						{#if p.twists.some((t) => t.isBuffer)}
							<!-- "왜 이게 목록에 있는가" 는 관례 B 를 처음 보면 반드시 나온다 (AD-8). -->
							<p class="note" data-buffer-note>
								버퍼가 비틀린 채 남았습니다. 방향의 합이 보존되므로 다른 조각의 비틀림을
								남기면 버퍼가 그 보정을 떠안습니다
							</p>
						{/if}
					{/if}
					<!-- 사실 한 줄만 적는다. 처리 알고리즘 안내는 이번 범위 밖이다. -->
					<p class="row" data-parity={p.parity ? 'true' : 'false'}>
						<span class="k">패리티</span>
						<span class="v">{p.parity ? '코너 타깃이 홀수입니다 (패리티)' : ''}</span>
					</p>
				</section>
			{/each}
		</div>
	{/if}

	<!--
		기록은 모달 안이다 (요구 3). 본문에는 개수만 남긴다 — 50건이 쌓이면 이 화면이
		트레이싱 화면이 아니라 기록 화면이 된다.
	-->
	<div class="records-row">
		<span class="count" data-record-count={browser ? tracing.records.length : 0}>
			기록 {browser ? tracing.records.length : 0}건
		</span>
		<button type="button" data-open-records onclick={() => recordsModal?.open()}>
			최근 기록
		</button>
	</div>
</section>

<Records bind:this={recordsModal} />

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
	/*
	 * 판정 줄 — `quiz/+page.svelte` 의 `.verdict` 와 **같은 값** 이다 (요구 3).
	 * 두 화면이 같은 것을 다르게 그리면 사용자가 판정을 두 번 배운다.
	 *
	 * 판정이 없는 동안은 상자를 그리지 않는다. 이 화면은 문구가 없어도 자리를
	 * 지켜야 해서(AD-14) 요소가 늘 서 있고, 빈 상자는 그 자리를 얼룩으로 만든다.
	 */
	.verdict {
		font-size: 0.95rem;
		color: var(--fg);
	}
	.verdict:not([data-kind='']) {
		padding: 0.6rem 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	/*
	 * 색은 판정을 **한 번 더** 적는 것이지 판정 자체가 아니다 (#26). 같은 줄의
	 * 문구가 언제나 무엇이 어긋났는지 말하므로 색을 못 읽어도 정보가 남는다.
	 */
	.verdict[data-result='ok'] {
		color: var(--ok);
		border-color: var(--ok);
	}
	.verdict[data-result='bad'] {
		color: var(--danger);
		border-color: var(--danger);
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
		line-height: 1.4;
		color: var(--muted);
	}
	/* 교차 검증 한 줄. 문구가 없어도 자리를 지킨다 — 패드가 위아래로 뛰면 안 된다. */
	.conflict {
		min-height: 1rem;
	}
	/* 갈래 사이의 경계. `both` 결과에서 코너와 엣지가 한 덩어리로 읽히지 않게 한다. */
	.part + .part {
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}
	.part {
		display: grid;
		gap: 0.3rem;
		min-width: 0;
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
		/* 퀴즈의 입력 표시(`Alg size="md"`)와 같은 크기다 (요구 3). */
		font-size: 1.15rem;
		letter-spacing: 0.08em;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 9px;
		/* 색만 바뀐다. 크기·여백은 그대로라 채점 순간에 레이아웃이 밀리지 않는다. */
		transition:
			background-color 120ms ease,
			border-color 120ms ease;
	}
	/*
	 * 채점이 끝나면 입력창 자체를 칠한다 — `quiz/+page.svelte` 의 `.entry` 와 같은
	 * 토큰이고 같은 규약이다 (요구 3). 판정 문구는 아래 줄에 그대로 서 있다 (#26).
	 */
	.field input[data-result='ok'] {
		background: var(--ok-bg);
		border-color: var(--ok);
	}
	.field input[data-result='bad'] {
		background: var(--danger-bg);
		border-color: var(--danger);
	}
	@media (prefers-reduced-motion: reduce) {
		.field input {
			transition: none;
		}
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
		font-size: 0.9rem;
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
	/* 정답 예시는 이 상자에서 실제로 읽는 한 줄이다. 입력창과 같은 크기로 둔다. */
	.result .v.big {
		font-size: 1.15rem;
		line-height: 1.35;
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
	.records-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}
	.records-row .count {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.records-row button {
		min-height: 44px;
		padding: 0 0.9rem;
		font-size: 0.85rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 9px;
		cursor: pointer;
		touch-action: manipulation;
	}
</style>
