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
	import { type CaseEntry, type Dataset } from '$lib/domain/types.js';

	let ds = $state<Dataset | null>(null);
	let sim = $state<CubeSim | null>(null);
	let current = $state<CaseEntry | null>(null);
	let moves = $state<string[]>([]);
	let picked = $state<AnchorRef | null>(null);
	let verdict = $state<Verdict | null>(null);

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
		if (pool.length === 0) {
			current = null;
			clearEntry();
			return;
		}
		let pick: string;
		do {
			pick = pool[Math.floor(Math.random() * pool.length)];
		} while (pool.length > 1 && pick === current?.case);
		current = ds.cases[pick];
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
</script>

<svelte:head><title>3-Style Corner — 퀴즈</title></svelte:head>

{#if ds}
	<section class="quiz">
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
				<h1 data-case={current.case}>{current.case}</h1>
				<div class="targets">
					<span>{targetText(current.target1)}</span>
					<span>{targetText(current.target2)}</span>
				</div>
			</header>

			<div class="entry" data-alg={alg} data-picked={picked ? refLabel(picked) : ''}>
				{#if entryParts.length > 0}
					<Alg parts={entryParts} size="md" />
				{:else if settings.quizInput === 'setup'}
					<span class="placeholder">셋업 무브를 넣고 기준공식을 고르세요</span>
				{:else}
					<span class="placeholder">공식을 입력하세요</span>
				{/if}
			</div>

			{#if verdict}
				<div class="verdict" data-verdict={verdict.kind}>{verdictText(verdict)}</div>

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
					<a href="/?c={current.case}" data-goto={current.case}>조회 화면에서 보기</a>
				</div>
			{/if}

			<div class="controls">
				{#if verdict}
					<button type="button" class="primary" data-action="next" onclick={next}
						>다음 문제</button
					>
				{:else if settings.quizInput === 'setup'}
					<!-- 기준을 고르는 순간이 제출이라 제출 버튼이 없다 -->
					<AnchorPad {refs} onpick={pick} />
				{:else}
					<button
						type="button"
						class="primary"
						data-action="submit"
						onclick={submit}
						disabled={!canSubmit}>제출</button
					>
				{/if}
			</div>

			<MoveKeypad bind:moves />
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
	h1 {
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
	.verdict[data-verdict='correct'] {
		color: var(--accent);
		border-color: var(--accent);
	}
	.verdict[data-verdict='edge-dirty'],
	.verdict[data-verdict='twist'] {
		color: var(--insert);
		border-color: var(--insert);
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
