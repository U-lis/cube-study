<!--
	스티커 문자 — 퀴즈 (#19, SPEC FR-LT-12 ~ 22).

	센터와 큐비 하나만 실제 색이고(설정에 따라 나머지도 색), 그 큐비를 이루는 문자를
	입력한다. 순서는 상관없다 (FR-LT-15).

	─── 돌려야 보인다 ──────────────────────────────────────────
	문제 큐비가 처음 보이는 면 뒤에 있을 수 있다. 보이는 면에만 문제를 내는 식으로
	피하지 않는다 — 돌려서 찾는 것까지가 훈련이다 (FR-LT-17). 대신 그 사실을 한 줄로
	적어 둔다. 위치는 말하지 않는다.
	────────────────────────────────────────────────────────────

	원위치 버튼이 없다 (FR-LT-18). 외워야 할 것은 큐비가 무엇인지이고, 절대 위치로
	다시 맞추는 것은 의미가 없다.

	기록을 남기지 않으므로 설정을 잠그지 않는다 (FR-LT-21).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Cube from 'cubejs/lib/cube.js';
	import Cube3D from '$lib/ui/Cube3D.svelte';
	import SegToggle from '$lib/ui/SegToggle.svelte';
	import StickerPad from '$lib/ui/StickerPad.svelte';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { letters } from '$lib/ui/letters.svelte.js';
	import { faceletColors, GRAY, grayFacelets } from '$lib/ui/facelets.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { pickNext, pushRecent } from '$lib/domain/quiz.js';
	import { MARK_PALETTE } from '$lib/domain/tracing.js';
	import {
		answerOf,
		cubiesOf,
		gradeLetters,
		marksQuiz,
		paintQuiz,
		type LetterVerdict,
		type Others,
		type QuizStage
	} from '$lib/domain/letters.js';
	import { ORIENTATION_COUNT } from '$lib/cube/cube3d-map.js';
	import { CORNER_LETTERS, EDGE_LETTERS, type PieceKind } from '$lib/cube/speffz.js';
	import type { Cubie, Dataset } from '$lib/domain/types.js';

	const SOLVED = new Cube().asString();
	/** 패드의 구분자. 이 화면은 갈래가 하나라 쓰지 않는다 — 버튼은 눈에서만 지운다. */
	const NO_SEPARATOR = '|';

	const KIND_OPTIONS: { value: PieceKind; label: string; hint: string; title: string }[] = [
		{ value: 'corner', label: '코너', hint: '코너 큐비의 문자 3개', title: '코너 8개' },
		{ value: 'edge', label: '엣지', hint: '엣지 큐비의 문자 2개', title: '엣지 12개' }
	];
	const STAGE_OPTIONS: { value: QuizStage; label: string; hint: string; title: string }[] = [
		{ value: 'solved', label: '풀린 큐브', hint: '조각이 제자리에 있습니다', title: '1단계' },
		{ value: 'scrambled', label: '섞인 큐브', hint: '조각이 다른 자리에 있습니다', title: '2단계' }
	];
	const OTHERS_OPTIONS: { value: Others; label: string; hint: string; title: string }[] = [
		{ value: 'gray', label: '회색', hint: '문제 큐비와 센터만 색입니다', title: '가리기' },
		{ value: 'color', label: '색', hint: '모든 큐비가 색이고 문제 큐비는 테두리로 표시합니다', title: '실물과 같게' }
	];

	let ds = $state<Dataset | null>(null);
	loadDataset().then((d) => (ds = d));

	let cube: ReturnType<typeof Cube3D> | undefined = $state();

	/** 지금 문제. SSR 과 첫 페인트에서는 없다 — 문제는 클라이언트에서만 뽑는다. */
	let cubie = $state<Cubie | null>(null);
	/** 문제를 낸 시점의 종류. 설정을 바꾸면 새 문제가 나오므로 보통 설정값과 같다. */
	let kind = $state<PieceKind>('corner');
	let facelets = $state(SOLVED);
	let entered = $state<string[]>([]);
	let verdict = $state<LetterVerdict | null>(null);
	let recent: string[] = [];
	/** 처음 카메라 각도 (FR-LT-22). SSR 에서는 고정값이라 하이드레이션이 흔들리지 않는다. */
	let orientation = $state(0);

	const randomOrientation = () => Math.floor(Math.random() * ORIENTATION_COUNT);

	function next(): void {
		kind = letters.quizKind;
		const picked = pickNext(cubiesOf(kind), recent, undefined, Math.random);
		recent = pushRecent(recent, picked!);
		cubie = picked;
		facelets = letters.quizStage === 'scrambled' ? Cube.random().asString() : SOLVED;
		entered = [];
		verdict = null;
		orientation = randomOrientation();
		// 같은 각도가 연달아 뽑혀도 카메라를 돌려놓는다 — prop 은 값이 같으면 안 움직인다.
		cube?.resetView(orientation);
	}

	let mounted = $state(false);
	onMount(() => (mounted = true));

	/** 설정을 바꾸면 새 문제 (FR-LT-20). 첫 진입도 같은 길이다. */
	$effect(() => {
		void letters.quizKind;
		void letters.quizStage;
		void letters.quizOthers;
		if (mounted) untrack(next);
	});

	let need = $derived(cubie ? answerOf(kind, cubie).length : 0);
	let canGrade = $derived(!!cubie && !verdict && entered.length === need);

	function grade(): void {
		if (!cubie || !canGrade) return;
		verdict = gradeLetters(kind, cubie, entered);
	}

	let colors = $derived(
		ds && cubie
			? paintQuiz(
					kind,
					cubie,
					letters.quizOthers,
					facelets,
					faceletColors(ds.meta.colorScheme, facelets),
					GRAY
				)
			: grayFacelets()
	);
	let marks = $derived(cubie ? marksQuiz(kind, cubie, facelets, MARK_PALETTE.current) : undefined);
	let padLetters = $derived(kind === 'edge' ? EDGE_LETTERS : CORNER_LETTERS);
	/** 단계 (FR-NAV-14). 3-style 퀴즈처럼 `idle` 이 없다. */
	let stage = $derived(!cubie ? '' : verdict ? 'result' : 'active');
	let result = $derived(verdict ? (verdict.kind === 'correct' ? 'ok' : 'bad') : '');
</script>

<svelte:head><title>스티커 문자 — 퀴즈</title></svelte:head>

<UpLink href="/" label="홈" />

<h1>퀴즈</h1>

<!-- `data-cubie` 는 E2E 의 시험 훅이다. 화면에 보이는 정보가 아니다 (PHASE_4_TEST). -->
<section class="quiz" data-stage={stage} data-cubie={cubie ?? ''} data-kind={kind}>
	<div class="settings">
		<SegToggle name="letters-quiz-kind" heading="종류" bind:value={letters.quizKind} options={KIND_OPTIONS} />
		<SegToggle name="letters-quiz-stage" heading="단계" bind:value={letters.quizStage} options={STAGE_OPTIONS} />
		<SegToggle
			name="letters-quiz-others"
			heading="다른 큐비"
			bind:value={letters.quizOthers}
			options={OTHERS_OPTIONS}
		/>
	</div>

	<div class="cube-slot">
		<Cube3D bind:this={cube} facelets={colors} {marks} {orientation} label="문제 큐브" />
	</div>

	<p class="hint" data-hidden-hint>문제 조각이 뒤쪽에 있으면 큐브를 돌려야 보입니다</p>

	<div class="entry" data-entry={entered.join('')} data-result={result}>
		{#if entered.length > 0}
			<span class="letters">{entered.join(' ')}</span>
		{:else}
			<span class="placeholder">칠해진 조각의 문자 {need || ''}개를 고르세요</span>
		{/if}
	</div>

	<StickerPad
		pad="letters"
		letters={padLetters}
		bind:value={entered}
		disabled={!cubie || !!verdict}
		max={need || 1}
		separator={NO_SEPARATOR}
		separatorLabel=""
		separatorHidden
	/>

	{#if verdict}
		<div class="verdict" data-verdict data-kind={verdict.kind} data-result={result}>
			{verdict.kind === 'correct' ? '정답' : '오답'}
		</div>
		{#if verdict.kind === 'wrong'}
			<p class="answer" data-answer={verdict.answer.join('')}>정답: {verdict.answer.join(' ')}</p>
		{/if}
	{/if}

	<div class="controls">
		{#if verdict}
			<button type="button" class="primary" data-next onclick={next}>다음 문제</button>
		{:else}
			<button type="button" class="primary" data-grade disabled={!canGrade} onclick={grade}>
				채점
			</button>
		{/if}
	</div>
</section>

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0.2rem 0 0.4rem;
	}
	.quiz {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding-top: 0.4rem;
	}
	.settings {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-width: 22rem;
		width: 100%;
		margin: 0 auto;
	}
	/* 트레이싱 `.cube-slot` 과 같은 방식. 고정분은 PHASE_5 에서 실측한다 (NFR-LT-7). */
	.cube-slot {
		width: 100%;
		max-width: clamp(180px, calc(100vh - 36rem), 420px);
		max-width: clamp(180px, calc(100svh - 36rem), 420px);
		margin: 0 auto;
	}
	.hint {
		margin: 0;
		text-align: center;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.quiz[data-stage='result'] .hint {
		visibility: hidden;
	}
	.entry {
		min-height: 2.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.entry[data-result='ok'] {
		background: var(--ok-bg);
		border-color: var(--ok);
	}
	.entry[data-result='bad'] {
		background: var(--danger-bg);
		border-color: var(--danger);
	}
	.letters {
		font-family: var(--mono);
		font-size: 1.4rem;
		letter-spacing: 0.2em;
	}
	.placeholder {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.verdict {
		padding: 0.6rem 0.75rem;
		font-size: 0.95rem;
		border-radius: 8px;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	/* 색은 `data-result` 하나만 본다 (화면 규약). */
	.verdict[data-result='ok'] {
		color: var(--ok);
		border-color: var(--ok);
	}
	.verdict[data-result='bad'] {
		color: var(--danger);
		border-color: var(--danger);
	}
	.answer {
		margin: 0;
		font-family: var(--mono);
		font-size: 1rem;
	}
	.controls {
		display: flex;
		margin-top: auto;
	}
	.primary {
		flex: 1;
		min-height: 48px;
		font-size: 1rem;
		color: var(--bg);
		background: var(--fg);
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
	.primary:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
