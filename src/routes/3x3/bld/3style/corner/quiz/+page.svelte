<!--
  퀴즈 (FR-16 ~ FR-19). 암기 필터는 FR-MC-18~20.
  정답은 판정 전까지 DOM 에 렌더하지 않는다 (개발자 도구로도 보이지 않게).
  학습 상태를 저장하지 않으므로 출제 이력은 세션 메모리에만 둔다.

  입력 방식이 둘이다.
    direct — 18버튼 키패드로 무브를 직접 입력하고 제출한다.
    setup  — 키패드로 셋업만 넣고 기준공식을 고른다. 고르는 순간이 제출이라
             [S: anchor] 가 완성되므로 별도 제출 버튼이 없다.
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import MoveKeypad from '$lib/ui/MoveKeypad.svelte';
	import AnchorPad from '$lib/ui/AnchorPad.svelte';
	import SegToggle from '$lib/ui/SegToggle.svelte';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { settings } from '$lib/ui/settings.svelte.js';
	import { memorize } from '$lib/ui/memorize.svelte.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { getSim, type CubeSim } from '$lib/cube/sim.js';
	import { grade, verdictText, type Verdict } from '$lib/domain/grade.js';
	import { formatAlg, type AlgPart, type Mode } from '$lib/domain/format.js';
	import { targetText } from '$lib/domain/validate.js';
	import {
		anchorRef,
		anchorRefs,
		expandSetup,
		refLabel,
		type AnchorRef
	} from '$lib/domain/anchor.js';
	import { pickNext, pushRecent } from '$lib/domain/quiz.js';
	import { type CaseCode, type CaseEntry, type Dataset } from '$lib/domain/types.js';

	let ds = $state<Dataset | null>(null);
	let sim = $state<CubeSim | null>(null);
	let current = $state<CaseEntry | null>(null);
	let moves = $state<string[]>([]);
	let picked = $state<AnchorRef | null>(null);
	let verdict = $state<Verdict | null>(null);
	/**
	 * 최근 출제 이력. 학습 상태가 아니라 이번 세션의 출제 분포를 고르게 하는 값이므로
	 * localStorage 에 남기지 않는다 — 새로고침하면 비워지는 것이 맞다.
	 */
	let recent = $state<CaseCode[]>([]);

	const INPUT_OPTIONS: [
		{ value: Mode; label: string; hint: string; title: string },
		{ value: Mode; label: string; hint: string; title: string }
	] = [
		{
			value: 'direct',
			label: 'direct',
			hint: '무브를 직접 입력하고 제출합니다',
			title: '18개 무브 버튼으로 알고리즘 전체를 입력한다'
		},
		{
			value: 'setup',
			label: 'setup',
			hint: '셋업 무브를 넣고 기준공식을 고릅니다',
			title: '셋업 S 를 입력한 뒤 기준공식을 고르면 [S: 기준] 으로 바로 판정한다'
		}
	];

	Promise.all([loadDataset(), getSim()]).then(([d, s]) => {
		ds = d;
		sim = s;
		// 최초 출제는 아래 $effect 에서 pool 이 준비된 뒤 걸린다.
		// 여기서 next() 를 부르면 memorizedOnly=true + pool 비어있는 상태에서
		// 전체에서 조용히 출제되는 사고를 낸다 (FR-MC-20).
	});

	/**
	 * FR-MC-19: memorizedOnly ON 이면 현재 입력 방식에 해당하는 표기의 체크 목록으로
	 * 좁힌다. OFF 면 데이터의 전체 케이스에서 출제한다.
	 *
	 * $derived 이므로 memorize.memorizedOnly · settings.quizInput ·
	 * memorize.setupChecked · memorize.directChecked 변화에 자동 반응한다.
	 * setup/direct 는 독립 저장되므로 (FR-MC-1) 현재 quizInput 쪽만 참조한다.
	 */
	let pool = $derived.by((): string[] => {
		if (!ds) return [];
		if (memorize.memorizedOnly) {
			return [...memorize.checkedFor(settings.quizInput)];
		}
		return Object.keys(ds.cases);
	});

	/** 입력만 지운다. 문제는 그대로 둔다 (입력 방식 전환용). */
	function clearEntry() {
		moves = [];
		picked = null;
		verdict = null;
	}

	function next() {
		if (!ds) return;
		// 직전 문제도 이력에 넣어 넘긴다. current 가 recent 에 들어가는 것은 여기뿐이라,
		// 문제를 넘기지 않고 화면을 떠난 케이스는 이력에 남지 않는다.
		const seen = current ? pushRecent(recent, current.case) : recent;
		// 이름을 code 로 둔다 — 바깥의 picked 는 기준공식 선택이라 가리면 헷갈린다.
		// 역케이스는 데이터가 알려준다 (378/378 상호 역). 코드에 규칙을 적지 않는다.
		const code = pickNext(pool, seen, (c) => ds!.cases[c]?.inverse, Math.random);
		if (code === null) {
			current = null;
			clearEntry();
			return;
		}
		recent = seen;
		current = ds.cases[code];
		clearEntry();
	}

	// 입력 방식을 바꾸면 반쯤 만들다 만 입력이 남는다. 문제는 유지한 채 입력만 비운다.
	$effect(() => {
		settings.quizInput;
		clearEntry();
	});

	/**
	 * FR-MC-19, 20: pool 이 바뀌었는데 현재 문제가 pool 밖이면 즉시 다음 문제를 뽑는다.
	 * pool 이 비면 current = null 로 두고 안내를 표시한다. 전체에서 fallback 하지 않는다.
	 *
	 * 최초 로드 시 ds 가 null → 아무 것도 안 함. ds 가 로드되면 pool 이 채워지고
	 * current 는 null 이므로 next() 가 호출된다.
	 *
	 * 무한 루프 우려 없음: next() 가 pool 안 코드로 current 를 설정하면 다음 실행에서
	 * pool.includes(current.case) 가 true → 재호출 안 됨.
	 */
	$effect(() => {
		if (!ds) return;
		const p = pool;
		if (p.length === 0) {
			if (current !== null) {
				current = null;
				clearEntry();
			}
			return;
		}
		if (!current || !p.includes(current.case)) {
			next();
		}
	});

	function submit() {
		if (!sim || !ds || !current || moves.length === 0) return;
		verdict = grade(sim, ds, current, moves.join(' '));
	}

	/** 기준공식 선택 = setup 입력의 제출. [S: 기준] 을 펼쳐서 채점한다. */
	function pick(ref: AnchorRef) {
		if (!sim || !ds || !current || verdict) return;
		picked = ref;
		verdict = grade(sim, ds, current, expandSetup(ds, moves.join(' '), ref));
	}

	let alg = $derived(moves.join(' '));
	let canSubmit = $derived(moves.length > 0 && verdict === null);
	let refs = $derived(ds ? anchorRefs(ds) : []);
	/**
	 * FR-MC-20: 안내 표시 조건. pool 이 비면서 memorizedOnly 가 켜져 있을 때만.
	 * memorizedOnly 가 꺼져 있으면 pool 은 정의상 비지 않으므로 이 안내가 뜨지 않는다.
	 */
	let poolEmpty = $derived(memorize.memorizedOnly && pool.length === 0);

	// setup 입력은 셋업 무브와 기준 이름의 역할이 다르므로 색을 나눠 보여준다.
	let entryParts = $derived.by((): AlgPart[] => {
		const parts: AlgPart[] = [];
		if (alg) parts.push({ text: alg, role: 'plain' });
		if (picked) parts.push({ text: refLabel(picked), role: 'anchor' });
		return parts;
	});
	/**
	 * 단계 (FR-NAV-14). 이름은 트레이싱과 공유하고, 단계는 강제하지 않는다 (AD-NAV-5).
	 *
	 * 퀴즈에 `idle` 은 없다 — 연달아 푸는 화면이라 문제마다 시작을 누르게 하면 흐름이
	 * 끊긴다. `input` 도 따로 내지 않는다. 문제가 뜨는 순간 입력이 열려 `active` 와
	 * 겹치기 때문이다. 실제로 갈리는 것은 판정이 있는가 하나다.
	 *
	 * 데이터셋이 아직 없거나 pool 이 비면 낼 단계가 없다 — 빈 문자열이다.
	 */
	let stage = $derived(!current ? '' : verdict ? 'result' : 'active');
</script>

<svelte:head><title>3-Style Corner — 퀴즈</title></svelte:head>

<UpLink href="/" label="홈" />

<h1>퀴즈</h1>

{#if ds}
	<section class="quiz" data-stage={stage}>
		<div class="input-mode">
			<SegToggle name="quiz-input" bind:value={settings.quizInput} options={INPUT_OPTIONS} />
		</div>

		<!--
			FR-MC-18: "암기한 것만 출제" 토글. 저장은 memorize 스토어의
			memorizedOnly ($effect 자동 저장) 이 담당한다.
			AD-6: SegToggle 재사용하지 않는다 (boolean on/off).
			FR-MC-4: 라벨 전체를 클릭 영역으로 두고 min-height 44px.
		-->
		<label class="memorized-only" data-memorized-only-toggle>
			<input
				type="checkbox"
				checked={memorize.memorizedOnly}
				onchange={(e) => (memorize.memorizedOnly = e.currentTarget.checked)}
				data-memorized-only-input
			/>
			<span>암기한 것만 출제</span>
		</label>

		{#if poolEmpty}
			<!--
				FR-MC-20: 암기 케이스가 0개일 때 안내. 전체 fallback 하지 않는다.
				NFR-9 dry 톤: 격려·카운터 금지. 사실만 적는다.
			-->
			<p class="empty-pool" data-empty-pool>암기 표시한 공식이 없습니다</p>
		{:else if current}
			<header>
				<!--
					케이스 코드는 **문제**이지 화면 이름이 아니다 (FR-NAV-9). 0.4.2 까지
					여기가 `<h1>` 이었다 — 화면마다 `<h1>` 의 뜻이 갈리던 자리 중 하나다.
					크기·자리는 그대로 두고 태그만 내렸다.
				-->
				<div class="case" data-case={current.case}>{current.case}</div>
				<div class="targets">
					<span>{targetText(current.target1)}</span>
					<span>{targetText(current.target2)}</span>
				</div>
			</header>

			<!--
				판정이 나면 입력창 자체를 칠한다 (정답 녹색 / 그 외 빨강). 아래 설명 줄은
				자리도 문구도 그대로다 — 배경색은 그 문장을 읽기 전에 결과를 알리는 역할만 한다.
			-->
			<div
				class="entry"
				data-alg={alg}
				data-picked={picked ? refLabel(picked) : ''}
				data-result={verdict ? (verdict.kind === 'correct' ? 'ok' : 'bad') : ''}
			>
				{#if entryParts.length > 0}
					<Alg parts={entryParts} size="md" />
				{:else if settings.quizInput === 'setup'}
					<span class="placeholder">셋업 무브를 넣고 기준공식을 고르세요</span>
				{:else}
					<span class="placeholder">공식을 입력하세요</span>
				{/if}
			</div>

			<!--
				영역 순서: 입력칸 → 자판 → 판정 → 결과 → 진행 버튼 (FR-NAV-8 의 표).
				자판이 판정 위에 서고 진행 버튼이 맨 아래 선다 — 트레이싱과 같은 순서다.
				0.4.2 까지는 제출 버튼이 자판 위에 있었는데, 그러면 자판에서 손을 뗀 뒤
				손을 다시 위로 올려야 눌린다.
			-->
			<MoveKeypad bind:moves />

			{#if verdict}
				<!--
					판정 줄의 표기를 트레이싱과 맞춘다 (FR-NAV-12). 두 화면이 같은 것을
					다르게 그리면 사용자가 판정을 두 번 배운다. `data-kind` 가 무엇인지를,
					`data-result` 가 좋은 소식인지를 말한다 — 색은 뒤쪽만 보고 칠한다.
				-->
				<div
					class="verdict"
					data-verdict
					data-kind={verdict.kind}
					data-result={verdict.kind === 'correct' ? 'ok' : 'bad'}
				>
					{verdictText(verdict)}
				</div>

				<!-- 정답은 판정 후에만 렌더한다 -->
				<div class="answer">
					<dl>
						<dt>direct</dt>
						<dd><Alg parts={formatAlg(current, 'direct', settings.notation)} size="sm" /></dd>
						<dt>setup</dt>
						<dd><Alg parts={formatAlg(current, 'setup', settings.notation)} size="sm" /></dd>
					</dl>
					{#if !anchorRef(current)}
						<p class="note" data-anchor-direct>
							셋업으로 어느 기준공식에도 닿지 않는 케이스입니다
						</p>
					{/if}
					<a href="/3x3/bld/3style/corner/lookup?c={current.case}" data-goto={current.case}>조회 화면에서 보기</a>
				</div>
			{/if}

			<div class="controls">
				{#if verdict}
					<button type="button" class="primary" data-next onclick={next}
						>다음 문제</button
					>
				{:else if settings.quizInput === 'setup'}
					<!-- 기준을 고르는 순간이 제출이라 제출 버튼이 없다 -->
					<AnchorPad {refs} onpick={pick} />
				{:else}
					<button
						type="button"
						class="primary"
						data-grade
						onclick={submit}
						disabled={!canSubmit}>제출</button
					>
				{/if}
			</div>
		{/if}
	</section>
{:else}
	<p class="loading">불러오는 중</p>
{/if}

<style>
	.quiz {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding-top: 0.6rem;
		/* 셸 높이에서 상단 바와 하단 네비를 뺀 만큼 채운다 */
		min-height: calc(100dvh - 52px - 40px - 1rem);
	}
	.input-mode {
		max-width: 20rem;
		width: 100%;
		margin: 0 auto;
	}
	/*
	 * FR-MC-18, FR-MC-4: "암기한 것만 출제" 토글. 터치 대상 44px 이상.
	 * 라벨 전체를 클릭 영역으로 만든다.
	 */
	.memorized-only {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		align-self: center;
		min-height: 44px;
		font-size: 0.9rem;
		color: var(--muted);
		cursor: pointer;
	}
	.memorized-only input[type='checkbox'] {
		width: 20px;
		height: 20px;
		margin: 0;
		cursor: pointer;
	}
	/*
	 * FR-MC-20: 안내 문구. NFR-9 dry 톤 — 격려/카운터 없이 사실만.
	 */
	.empty-pool {
		margin: 0;
		padding: 0.8rem;
		font-size: 0.9rem;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		text-align: center;
	}
	header {
		text-align: center;
	}
	/* 화면 이름. 다른 화면(기준공식)과 같은 톤이다. */
	h1 {
		font-size: 1.3rem;
		margin: 0.2rem 0 0.6rem;
	}
	/* 문제로 내려온 케이스 코드. 옛 h1 의 크기를 그대로 물려받는다. */
	.case {
		margin: 0;
		font-family: var(--mono);
		font-size: 3rem;
		letter-spacing: 0.15em;
	}
	.targets {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin-top: 0.3rem;
		font-family: var(--mono);
		font-size: 0.85rem;
		color: var(--muted);
	}
	.entry {
		min-height: 3.2rem;
		padding: 0.6rem 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		/* 색만 바뀐다. 크기·여백은 그대로라 판정 순간에 레이아웃이 밀리지 않는다 */
		transition:
			background-color 120ms ease,
			border-color 120ms ease;
	}
	.entry[data-result='ok'] {
		background: var(--ok-bg);
		border-color: var(--ok);
	}
	.entry[data-result='bad'] {
		background: var(--danger-bg);
		border-color: var(--danger);
	}
	@media (prefers-reduced-motion: reduce) {
		.entry {
			transition: none;
		}
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
	/*
	 * 입력창과 같은 토큰을 쓴다. 정답을 accent 로 칠하던 것을 ok 로 바꾼 이유는,
	 * accent 가 기준공식 이름에도 쓰이는 색이라 "정답" 의 뜻을 겸할 수 없어서다.
	 */
	/* 색은 `data-result` 하나만 본다. 판정 종류가 늘어도 이 규칙은 안 늘어난다. */
	.verdict[data-result='ok'] {
		color: var(--ok);
		border-color: var(--ok);
	}
	.verdict[data-result='bad'] {
		color: var(--danger);
		border-color: var(--danger);
	}
	.answer {
		padding: 0.7rem;
		background: var(--surface);
		border-radius: 8px;
		/* 정답 영역이 길어져도 키패드를 밀어내지 않는다 */
		max-height: 40vh;
		overflow-y: auto;
	}
	.answer dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 0.7rem;
		margin: 0;
		align-items: baseline;
	}
	.answer dt {
		font-family: var(--mono);
		font-size: 0.78rem;
		color: var(--muted);
	}
	.answer dd {
		margin: 0;
		min-width: 0;
	}
	.answer .note {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.answer a {
		display: inline-block;
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--accent);
	}
	/* 제출/다음 버튼과 키패드를 하단으로 밀어 엄지 도달 범위에 둔다 (FR-17) */
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
	.loading {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
