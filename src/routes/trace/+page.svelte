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
	import {
		CORNER_LETTERS,
		EDGE_CUBIE,
		EDGE_LETTERS,
		EDGE_ROTATION
	} from '$lib/cube/speffz.js';
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
		CONVENTIONS as CONVENTION_LABELS,
		CONVENTION_VALUES,
		ENTRY_SEPARATOR,
		PART_LABELS,
		SEPARATOR_LABEL,
		TRAIN_KIND_HEADING,
		TRAIN_KINDS,
		TRAIN_MODE_HEADING,
		TRAIN_MODES,
		TWIST_ABSORBED,
		TWIST_SEPARATED,
		type BufferMeta,
		type TrainKind,
		type TrainMode,
		type TwistConvention
	} from '$lib/domain/tracing.js';
	import type { Cubie, Dataset, Sticker } from '$lib/domain/types.js';

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
		/**
		 * 관례별 정답 예시. **둘 다** 들고 있다 (요구 3 재검토).
		 *
		 * 관례는 채점 기준이 아니라 표시 방식이다 — `gradeEntry` 는 넘겨받은 관례를
		 * 무시하고 입력에서 읽은 것으로 덮어쓴다 (`trace.ts:535`). 그래서 결과를 본
		 * 뒤에 관례를 바꿔도 다시 채점할 이유가 없고, 채점을 다시 돌리지 않으려면
		 * 여기서 두 벌을 들고 있으면 된다. `trace()` 한 번은 조각 8~12개 순회라
		 * 두 번 돌아도 비용이 없다.
		 */
		answers: Record<TwistConvention, TraceResult>;
		/**
		 * 이 갈래의 버퍼. 비틀림 목록이 "이건 버퍼다" 를 밝히는 데 쓴다 (AD-8).
		 *
		 * 목록 자체를 들고 있지 않는다. 관례 A 의 정답에는 비틀림 열이 아예 없고
		 * (`TraceResult.twists` 는 A 에서 항상 빈 배열), B 의 것은 `answers` 안에
		 * 이미 들어 있다. 표시 시점에 고른 관례에서 꺼내면 두 벌을 맞춰 둘 일이 없다.
		 */
		buffer: Cubie;
		/** 패리티 (FR-TR-13). 코너 타깃이 홀수일 때다 — 엣지에서는 판단하지 않는다. */
		parity: boolean;
	}

	/**
	 * 엣지 버퍼. 코너와 달리 엣지 데이터셋(#16)이 아직 없어서 읽어올 `meta` 가 없다.
	 *
	 * ─── 왜 DF 인가 ────────────────────────────────────────────
	 * 이 앱이 가르치는 것은 코너 3-style 이고 **엣지 3-style 은 과정에 없다** —
	 * 데이터셋조차 없다 (#16). 지금 엣지를 트레이싱할 이유가 있는 사람은 M2 를
	 * 배우는 사람이고 (#17), M2 의 버퍼는 DF 다. 한동안 UF 로 박혀 있었는데 그것은
	 * 이 앱에서 아무도 쓰지 않는 값이었다.
	 *
	 * **고르게 하지 않는다.** 반대편(UF)은 이 앱의 과정에 없으므로, 토글을 두면
	 * 아무도 안 누르는 선택지가 세로를 먹고 서 있게 된다. 엣지 3-style 데이터가
	 * 생기는 날(#16) 이 상수는 바뀌는 것이 아니라 **지워진다** — 그때는 버퍼가
	 * 데이터셋의 `meta` 에서 온다.
	 * ────────────────────────────────────────────────────────────
	 *
	 * 적는 것은 **대표 스티커 한 글자뿐이다.** 큐비 이름도 버퍼 스티커 목록도
	 * Speffz 좌표에서 나온다 — 손으로 적으면 `['c', 'i']` 같은 짝이 하나 틀려도
	 * 아무도 모르고, 그 오류는 타깃이 통째로 어긋나는 형태로만 드러난다.
	 *
	 * 버퍼가 코드에 남는 유일한 자리이고, 그것도 엔진이 아니라 조립부다 (FR-TR-7).
	 * 정적 검사도 엔진과 도메인만 본다 (`trace.test.ts:856`, `tracing.test.ts:679`).
	 */
	const EDGE_PRIMARY = 'u';
	const EDGE_BUFFER: BufferMeta & { buffer: Cubie } = {
		buffer: EDGE_CUBIE[EDGE_PRIMARY],
		bufferStickers: EDGE_ROTATION[EDGE_CUBIE[EDGE_PRIMARY]],
		primarySticker: EDGE_PRIMARY
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
	const CONVENTION_OPTIONS = CONVENTION_VALUES.map((value) => ({
		value,
		label: CONVENTION_LABELS[value],
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
	/**
	 * 결과 단계에서 큐브에 경로를 칠할 갈래 (요구 2 재검토).
	 *
	 * `both` 는 갈래가 둘인데 큐브는 하나다. 두 좌표계를 한 번에 칠하면 엉뚱한
	 * 조각이 켜지므로 (`marks` 주석) 한쪽만 칠하고 사용자가 고르게 한다.
	 * 채점 직후 기본값은 **어긋난 쪽** 이다 — 복기할 이유가 있는 쪽이 그쪽이다.
	 */
	let focusKind = $state<PieceKind | null>(null);
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
	 * 상태줄 문구. 하나로 모으는 이유는 **비어 있는지** 를 CSS 가 알아야 하기
	 * 때문이다 — 판이 도는 동안에는 빈 줄이 자리를 차지하지 않게 접는다 (요구 1).
	 *
	 * `idle` 에서는 접지 않는다. 하이드레이션 직후 `armed` 가 거짓이라 "준비 중"
	 * 이 떴다 사라지는데, 그때 자리까지 없앴다 만들면 화면이 두 번 밀린다 (AD-14).
	 */
	let statusText = $derived(
		!browser ? '' : src.error ? `스크램블 생성 실패: ${src.error}` : armed ? '' : '준비 중'
	);

	/** 결과 단계에 큐브를 칠할 갈래. 고른 것이 없으면 첫 갈래다. */
	let focus = $derived(parts.find((x) => x.kind === focusKind) ?? parts[0] ?? null);

	/**
	 * 54칸 하이라이트 (FR-TR-16).
	 *
	 * ─── 왜 훈련 중에는 아무것도 안 칠하는가 ───────────────────
	 * 처음에는 입력한 문자를 따라 "현재 타깃·지나간 조각" 을 칠했다. 그런데 그것은
	 * **문자 → 위치 매핑을 대신 해 주는 것** 이고, 그 매핑은 트레이싱이 아니라 그
	 * 앞 단계의 기술이다. 더 나쁜 것은 브루트포스가 열린다는 점이다 — 보고 있는
	 * 스티커의 문자를 모르겠으면 아무 글자나 눌러 가며 어디가 켜지는지 보면 된다.
	 * SPEC 이 "막혔을 때 다음 조각 하이라이트" 를 FR-TR-15 와 충돌한다며 거부한
	 * 것과 같은 부류다. 정답이 아니라 사용자 입력으로 구동된다는 이유로 그 검사를
	 * 지나갔을 뿐, 새어 나가는 정보는 같다.
	 *
	 * 그래서 한동안 버퍼만 칠했다. "실물에서도 자기 버퍼는 늘 알고 시작하므로
	 * 힌트가 아니다" 가 근거였는데, 그 근거가 뒤집혔다 — **실물 큐브에는 버퍼
	 * 자리에 아무 표시도 없다.** 초록·흰색으로 방향을 잡고 버퍼가 어디인지 찾는
	 * 것까지가 훈련이고, 칠해 주면 그 몫을 화면이 가져간다. 코너·엣지 둘 다다.
	 *
	 * 남는 결론은 하나다 — 훈련 중 큐브에는 강조가 없다.
	 *
	 * ─── 왜 결과 단계에서는 칠하는가 ───────────────────────────
	 * 판이 끝난 뒤라 힌트가 될 것이 없다. 다음 판은 다른 스크램블이다.
	 * `PHASE_5_PLAN_highlight.md:39-40` 이 처음부터 적어 둔 자리이기도 하다 —
	 * "결과 화면에서는 정답 예시 경로를 같은 방식으로 칠할 수 있다. 다만 훈련
	 * 중에는 칠하지 않는다."
	 *
	 * 어긋난 자리를 큐브에 찍지 않는다. 유효한 메모가 평균 11가지라 사용자가 다른
	 * 자리에서 끊었으면 예시의 i 번째와 사용자의 i 번째가 애초에 다른 조각이다
	 * (AD-7). "몇 번째가 어긋났는가" 는 판정 줄이 말하고, 큐브는 예시 경로
	 * 하나를 통째로 보여주는 몫만 한다.
	 *
	 * `both` 는 **고른 갈래의 몫만** 칠한다. 코너 문자를 엣지 좌표로 칠하면 엉뚱한
	 * 조각이 켜진다 — 두 갈래는 좌표계가 다르다.
	 */
	let marks = $derived(
		stage === 'result' && focus
			? buildMarks(focus.kind, focus.answers[tracing.convention].targets as Sticker[])
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
		// 대상을 시작 시점에 굳힌다 (요구 4). 판이 도는 동안 설정은 접히고, 결과
		// 단계에서 다시 펴져도 이미 채점한 판의 갈래 구성이 흔들리지 않는다.
		//
		// 관례는 여기서 굳히지 않는다. 결과 화면의 표시 토글이 되었으므로 (요구 3
		// 재검토) 판이 끝난 뒤에 바꾸는 것이 정상 사용이다.
		roundKind = tracing.pieceKind;
		entry = [];
		conflicts = 0;
		parts = [];
		stoppedAt = null;
		lastInputAt = null;
		startedAt = performance.now();
		nowAt = startedAt;
		stage = 'tracing';
		/*
		 * 맨 위로 되돌린다 (요구 1).
		 *
		 * 시작 버튼은 세션 설정 아래에 있어서, 그것을 누르려면 사용자가(또는
		 * 브라우저가) 이미 조금 내려와 있다. 누르는 순간 설정이 접혀 문서가 짧아지는데
		 * 스크롤 위치는 그대로라, 한 화면에 들어오도록 만들어 놓고도 큐브 윗부분이
		 * 잘린 채로 시작된다.
		 *
		 * `behavior` 를 주지 않는다. 기본값 `auto` 는 사용자의 동작 감소 설정을
		 * 브라우저가 알아서 지킨다 — 여기서 `smooth` 를 못 박으면 그 설정을 무른다.
		 */
		window.scrollTo({ top: 0 });
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
			const cube = stateFromFacelets(state, kind);
			// 화면은 **엔진 결과만** 쓴다. 정답 예시와 사용자의 입력을 문자열로 비교하는
			// 코드가 여기 생기면 "정답이 평균 11가지" 라는 전제가 조용히 깨진다 (AD-7).
			// 관례는 판정에 닿지 않는다. `gradeEntry` 가 넘겨받은 값을 버리고 **입력에서
			// 읽은 것** 으로 덮어쓴다 (`trace.ts:535`). 그래서 어느 관례를 넣어도 판정이
			// 같고, 결과를 본 뒤 관례를 바꿔도 다시 채점할 이유가 없다.
			const { verdict: v, reading } = gradeEntry(cube, letters, optionsFrom(m, kind, TWIST_ABSORBED));
			// 관례별 정답 예시를 **둘 다** 뽑는다 (요구 3 재검토). 결과 화면의 토글이
			// 이 둘을 갈아끼우는 것으로 끝나고, 채점은 다시 돌지 않는다.
			const answers = Object.fromEntries(
				CONVENTION_VALUES.map((c) => [c, trace(cube, optionsFrom(m, kind, c))])
			) as Record<TwistConvention, TraceResult>;
			graded.push({
				kind,
				verdict: v,
				reading,
				answers,
				buffer: m.buffer,
				// 패리티는 스크램블의 성질이지 관례의 성질이 아니다. 비틀림 하나를 끊어서
				// 흡수하면 타깃이 2개 늘어 홀짝이 보존되므로 두 관례의 값이 같다. 그래도
				// 한쪽을 정본으로 못 박는다 — 우연히 같은 것에 기대는 코드는 언젠가
				// 조용히 어긋난다.
				parity: kind === 'corner' && answers[TWIST_ABSORBED].parity
			});
		}
		parts = graded;
		// 복기할 이유가 있는 쪽을 큐브에 먼저 띄운다. 전부 맞았으면 첫 갈래다.
		focusKind = (graded.find((x) => !isPass(x.verdict)) ?? graded[0])?.kind ?? null;
		// 사용자가 실제로 친 방식 (요구 1). 한쪽이라도 따로 선언했으면 따로 처리다 —
		// 섞어 친 판을 끊어서 처리로 적으면 타깃 수가 왜 그만큼인지 설명되지 않는다.
		const recorded = conventionOf(graded.some((x) => x.reading.separated));
		tracing.add({
			// 이 파일에서 벽시계를 읽는 유일한 자리다. 표시용 시각이고 측정값이 아니다.
			at: Date.now(),
			ms: Math.round(stoppedAt - startedAt),
			// 판이 기록의 단위다. `both` 한 판은 두 건이 아니라 한 건이다.
			pieceKind: roundKind,
			buffer: joinBuffers(graded.map((p) => metaOf(p.kind)!.buffer)),
			mode: tracing.mode,
			twistConvention: recorded,
			// 스크램블이 정한 개수다. 사용자의 입력 길이가 아니라 문제의 난이도가 남는다.
			// `both` 는 합계다 — 시간도 두 갈래를 합쳐 잰 값이라 단위가 맞는다.
			// **기록의 관례와 같은 관례로 센다.** 두 필드가 다른 관례를 가리키면 한
			// 기록 안에서 타깃 수가 왜 그만큼인지 설명되지 않는다. 표시 토글(요구 3
			// 재검토)이 무엇을 가리키고 있든 기록은 사용자가 친 방식으로 남는다.
			targetCount: graded.reduce((n, p) => n + p.answers[recorded].targets.length, 0),
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
		focusKind = null;
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
	data-mode={tracing.mode}
	data-input-open={inputOpen ? 'true' : 'false'}
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

	<!--
		결과 단계에서 큐브에 칠할 갈래를 고른다 (요구 2 재검토).

		`both` 일 때만 선다 — 갈래가 하나면 고를 것이 없다. 여기는 `{#if}` 로 넣고
		빼도 된다. 하이드레이션 시점은 언제나 `idle` 이라 SSR 과 CSR 모두 이 자리가
		비어 있고, 생기는 것은 사용자가 채점을 누른 뒤다 (AD-14).
	-->
	{#if stage === 'result' && parts.length > 1}
		<div class="focus" data-focus-row>
			<span class="k">큐브에 표시</span>
			{#each parts as p (p.kind)}
				<button
					type="button"
					data-focus={p.kind}
					class:on={focusKind === p.kind}
					aria-pressed={focusKind === p.kind}
					onclick={() => (focusKind = p.kind)}>{PART_LABELS[p.kind]}</button
				>
			{/each}
		</div>
	{/if}

	<div class="timer-row">
		<!-- tabular-nums + 고정 폭. 숫자가 커질 때 옆이 밀리면 비교가 안 된다. -->
		<span class="timer" data-timer>{formatMs(elapsed)}</span>
		<span class="piece" data-piece-label>{PART_LABELS[padKind]}</span>
	</div>

	<!--
		`idle` 에서는 자리를 늘 잡아둔다 — 하이드레이션 직후 "준비 중" 이 떴다
		사라지는데 자리까지 없앴다 만들면 화면이 두 번 밀린다 (AD-14).
		판이 도는 동안에는 접는다 (요구 1). 그 구간에는 뜰 문구가 없다.
	-->
	<p class="status" data-status data-empty={statusText === '' ? 'true' : 'false'}>
		{statusText}
	</p>

	<!--
		세션 설정. **시작 버튼 바로 위** 다 — 화면 아래에 두었더니 끝까지 내려가야
		보여서 있는 줄 모르고 쓴다. 고르고 시작하는 순서가 그대로 세로 순서다.

		남은 것은 둘뿐이다. 비틀림 관례는 채점이 아니라 정답 예시의 표시 방식이라
		결과 패널로 옮겼다 (요구 3 재검토).

		문제가 도는 동안은 **접는다** (요구 1). 큐브부터 입력 패드까지가 한 화면에
		들어와야 하는데 이 두 토글이 그 사이에서 180px 을 차지한다. `{#if}` 가 아니라
		CSS 다 — 요소가 그대로 남으므로 SSR/CSR 구성이 갈리지 않고, 하이드레이션
		시점은 언제나 `idle` 이라 접힌 모습이 SSR 에 실릴 일도 없다 (AD-14).
		`disabled` 도 그대로 둔다 — 접는 것은 눈이고, 잠그는 것은 값이다 (요구 4).
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
			<!--
				판이 도는 동안은 접는다 (요구 1). 시작 전에 읽는 안내다.
				`both` 만 예외다 — 구분자를 어떻게 넣는지는 치는 도중에 필요한 정보이고,
				모르면 코너와 엣지가 한 덩어리로 붙어 채점이 통째로 어긋난다.
			-->
			<p class="hint" data-entry-hint data-both={splitUsable ? 'true' : 'false'}>
				{entryHint}
			</p>
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
			<!--
				관례 토글이 여기 있는 이유 (요구 3 재검토).

				이 토글은 입력에도 채점에도 닿지 않는다 — `gradeEntry` 는 넘겨받은 관례를
				버리고 입력에서 읽은 것으로 덮어쓴다 (`trace.ts:535`). 정하는 것은 바로 아래
				정답 예시를 어느 관례로 적을지 하나뿐이다. 그런데 세션 설정 자리에 있으면
				"채점 기준을 고르는 스위치" 로 읽힌다 — 설명 한 줄로 그 오해를 막으려 했지만
				자리가 말하는 것을 문장이 이기지 못한다.

				바꾸는 대상 옆에 두면 눌러 보는 것으로 무엇을 바꾸는지 안다. 정답 예시와
				함께 서고 함께 사라지므로, 한 판의 정답을 두 관례로 번갈아 볼 수 있다 —
				세션 설정이던 시절에는 관례를 바꾸려면 다음 판을 새로 돌려야 했다.

				잠그지 않는다. 판이 끝난 뒤에 바꾸는 것이 정상 사용이다.
			-->
			<SegToggle
				name="trace-convention"
				heading={CONVENTION_HEADING}
				bind:value={tracing.convention}
				options={CONVENTION_OPTIONS}
			/>
			<p class="note" data-marks-note>
				큐브에 {focus ? PART_LABELS[focus.kind] : ''} 정답 예시의 경로를 칠했습니다
			</p>
			{#each parts as p (p.kind)}
				{@const shown = p.answers[tracing.convention]}
				{@const tw = twistEntries(shown.twists, p.kind, p.buffer)}
				<section class="part" data-part={p.kind} data-part-kind={p.verdict.kind}>
					{#if parts.length > 1}
						<p class="row">
							<span class="k">{PART_LABELS[p.kind]}</span>
							<span class="v" data-part-verdict>{verdictText(p.verdict)}</span>
						</p>
					{/if}
					<p class="row">
						<span class="k">정답 예시</span>
						<span class="v mono big" data-answer>{shown.targets.join('')}</span>
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
					{#if tracing.convention === TWIST_SEPARATED}
						<p class="row">
							<span class="k">비틀림</span>
							<span class="v mono" data-answer-twists>
								{#each tw as t (t.letter)}<span
										data-twist={t.letter}
										data-buffer={t.isBuffer ? 'true' : 'false'}
										>{t.letter}{t.isBuffer ? '(버퍼)' : ''}</span
									>{/each}{tw.length === 0 ? '없음' : ''}
							</span>
						</p>
						{#if tw.some((t) => t.isBuffer)}
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
		/*
		 * 높이 상한 (요구 1). 큐브는 정사각이라 폭을 묶으면 높이가 묶인다.
		 *
		 * ─── 왜 `vh` 비율이 아니라 뺄셈인가 ────────────────────────
		 * 44vh 처럼 비율로 묶으면 화면이 짧아질수록 **모자라게** 준다. 큐브 아래에
		 * 서는 것들(타이머·버튼·입력칸·패드)은 비율이 아니라 고정 높이라서, 화면이
		 * 짧아져도 그만큼 줄지 않기 때문이다. 실측으로 그 고정분이 약 28rem 이다 —
		 * 상단 바 49px 을 포함한 값이고, 시작 전(설정)과 진행 중(패드) 중 **큰 쪽**이다.
		 *
		 * 그래서 남는 자리를 그대로 준다. 화면이 길면 420px 에서 멈추고, 짧으면
		 * 큐브가 먼저 양보한다. 180px 아래로는 내려가지 않는다 — 그보다 작으면
		 * 스티커를 눈으로 읽을 수 없어서 화면이 한 장에 들어오는 값어치가 없다.
		 *
		 * `svh` 는 주소 표시줄이 **떠 있을 때** 의 높이다. 그쪽으로 맞춰야 줄이
		 * 내려왔을 때 넘치지 않는다. `dvh` 는 주소 표시줄이 숨을 때마다 값이 바뀌어
		 * 큐브가 스크롤 중에 커졌다 작아진다. 앞 줄의 `vh` 는 `svh` 를 모르는
		 * 브라우저의 몫이다.
		 * ────────────────────────────────────────────────────────────
		 *
		 * 단계와 무관하게 같은 값이다. 시작할 때 크기가 변하면 그 순간 화면이 튄다.
		 */
		max-width: clamp(180px, calc(100vh - 28rem), 420px);
		max-width: clamp(180px, calc(100svh - 28rem), 420px);
		margin: 0 auto;
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
	/*
	 * ─── 한 화면에 넣기 (요구 1) ────────────────────────────────
	 * 큐브부터 입력 패드까지가 스크롤 없이 보여야 한다. 그 사이에 서 있던 것들을
	 * 판이 도는 동안 접는다. 전부 **CSS** 다 — 요소는 그대로 남으므로 SSR 과 CSR 의
	 * 구성이 갈리지 않고 (AD-14), 하이드레이션 시점은 언제나 `idle` 이라 접힌 모습이
	 * SSR 에 실릴 일도 없다.
	 * ────────────────────────────────────────────────────────────
	 */
	.trace:not([data-stage='idle']) .settings {
		display: none;
	}
	/* 판이 도는 동안 뜰 문구가 없다. `idle` 의 자리는 그대로 둔다 — 위 주석 참조. */
	.trace:not([data-stage='idle']) .status[data-empty='true'] {
		display: none;
	}
	/* 시작 전에 읽는 안내다. `both` 의 구분자 설명만 치는 도중에도 필요하다. */
	.trace:not([data-stage='idle']) .hint[data-both='false'] {
		display: none;
	}
	/*
	 * 시작 전에는 입력칸도 패드도 접는다.
	 *
	 * `idle` 은 대상·모드를 고르고 시작을 누르는 단계다. 그 사이 입력칸과 24칸 패드가
	 * ~330px 을 차지하고 서 있는데, 누를 수도 없고(`disabled`) 아직 칠 것도 없다.
	 * 이것을 접으면 시작 전 화면이 스크롤 없이 들어온다.
	 *
	 * **하이드레이션과 무관하다.** `stage` 는 저장소에서 오지 않고 언제나 `idle` 로
	 * 시작하므로 SSR 과 CSR 이 같은 모습을 그린다 — 이 파일의 다른 접기들과 달리
	 * 여기는 어긋날 두 시점 자체가 없다 (AD-14).
	 */
	.trace[data-stage='idle'] .entry {
		display: none;
	}
	/* 시작 전에는 판정도 없다. 빈 줄이 자리를 지킬 이유가 여기서는 없다. */
	.trace[data-stage='idle'] .verdict {
		display: none;
	}
	/*
	 * 채점이 끝나면 입력 패드를 접는다.
	 *
	 * 결과 단계에서 패드는 누를 수도 없고(`disabled`) 읽을 것도 없다. 24칸이 정답
	 * 예시와 판정 사이에 그대로 서서 화면의 절반을 먹는다 — 결과를 보는 화면에는
	 * 결과만 있으면 된다.
	 *
	 * **입력칸은 남긴다.** 무엇을 쳤는지가 판정("3번째 타깃이 어긋납니다")을 읽는 데
	 * 필요하고, 그 칸 자체가 ok/bad 로 칠해져 판정을 한 번 더 말한다.
	 *
	 * 자식 컴포넌트의 요소라 `:global()` 이 필요하다. 신호는 `data-stage` 뿐이므로
	 * 마크업은 단계와 무관하게 같다 (AD-14).
	 */
	.trace[data-stage='result'] :global([data-pad='entry']) {
		display: none;
	}
	.controls {
		display: grid;
		gap: 0.4rem;
	}
	/*
	 * 단계마다 실제로 누를 수 있는 버튼 하나만 남긴다. 넷을 2×2 로 깔면 90px 인데
	 * 그중 셋은 언제나 눌리지 않는 버튼이다.
	 *
	 * 조건이 `data-stage` 하나로 안 되는 것은 채점뿐이다 — `follow` 는 트레이싱
	 * 중에 이미 입력이 열려 있고 `memorize` 는 "다 외웠다" 뒤에 열린다. 그 판단은
	 * 이미 `inputOpen` 이 하고 있으므로 그것을 속성으로 내보내 쓴다.
	 */
	.controls button {
		display: none;
	}
	[data-stage='idle'] [data-start],
	[data-stage='tracing'][data-mode='memorize'] [data-memorized],
	[data-input-open='true'] [data-grade],
	[data-stage='result'] [data-next] {
		display: block;
	}
	/* 결과 단계에서 큐브에 칠할 갈래 고르기. `both` 에서만 선다. */
	.focus {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
	}
	.focus .k {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.focus button {
		min-height: 32px;
		padding: 0 0.7rem;
		font-size: 0.8rem;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		touch-action: manipulation;
	}
	/* 고른 쪽은 색이 아니라 테두리와 글자색으로 밝힌다 (#26 과 같은 규약). */
	.focus button.on {
		color: var(--fg);
		border-color: var(--fg);
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
