<!--
  퀴즈 (FR-16 ~ FR-19).
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
		next();
	});

	/** 입력만 지운다. 문제는 그대로 둔다 (입력 방식 전환용). */
	function clearEntry() {
		moves = [];
		picked = null;
		verdict = null;
	}

	function next() {
		if (!ds) return;
		const codes = Object.keys(ds.cases);
		let pick: string;
		do {
			pick = codes[Math.floor(Math.random() * codes.length)];
		} while (codes.length > 1 && pick === current?.case);
		current = ds.cases[pick];
		clearEntry();
	}

	// 입력 방식을 바꾸면 반쯤 만들다 만 입력이 남는다. 문제는 유지한 채 입력만 비운다.
	$effect(() => {
		settings.quizInput;
		clearEntry();
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

	// setup 입력은 셋업 무브와 기준 이름의 역할이 다르므로 색을 나눠 보여준다.
	let entryParts = $derived.by((): AlgPart[] => {
		const parts: AlgPart[] = [];
		if (alg) parts.push({ text: alg, role: 'plain' });
		if (picked) parts.push({ text: refLabel(picked), role: 'anchor' });
		return parts;
	});
</script>

<svelte:head><title>3-Style Corner — 퀴즈</title></svelte:head>

{#if current && ds}
	<section class="quiz">
		<div class="input-mode">
			<SegToggle name="quiz-input" bind:value={settings.quizInput} options={INPUT_OPTIONS} />
		</div>

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
				<button type="button" class="primary" data-action="next" onclick={next}>다음 문제</button>
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
