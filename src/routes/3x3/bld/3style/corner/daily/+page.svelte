<!--
	매일 퀴즈 (SPEC FR-DQ, 사용자 결정 2026-10-19).

	연습 퀴즈와 다른 점은 셋이다.
	  - 하루에 한 판. 문제는 시작할 때 고르고 그날 동안 저장한다 (FR-DQ-6)
	  - 다 풀고 한 번에 채점한다. 채점 전에는 이전/다음으로 오가며 답을 고칠 수 있다
	    (FR-DQ-4, 사용자 결정 — 진행 버튼이 둘이 되는 것을 감수한다)
	  - 결과가 그날 동안 남으므로 측정하는 판이다. 입력 방식은 판이 도는 동안 접고
	    잠근다 (규약 2.3)

	정답은 채점 전까지 DOM 에 렌더하지 않는다 — 연습 퀴즈와 같다.

	데이터셋이 오기 전에는 본문을 그리지 않는다. 판의 단계가 localStorage 에서 오므로
	서버가 그린 화면과 하이드레이션한 화면이 갈리지 않게 하려면, 단계에 매인 것은 전부
	데이터셋(브라우저에서만 온다) 뒤에 선다.
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import MoveKeypad from '$lib/ui/MoveKeypad.svelte';
	import AnchorPad from '$lib/ui/AnchorPad.svelte';
	import SegToggle from '$lib/ui/SegToggle.svelte';
	import UpLink from '$lib/ui/UpLink.svelte';
	import { settings } from '$lib/ui/settings.svelte.js';
	import { memorize } from '$lib/ui/memorize.svelte.js';
	import { daily } from '$lib/ui/daily.svelte.js';
	import { push } from '$lib/ui/push.svelte.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { getSim, type CubeSim } from '$lib/cube/sim.js';
	import { grade, verdictText, type Verdict } from '$lib/domain/grade.js';
	import { formatAlg, type AlgPart, type Mode } from '$lib/domain/format.js';
	import { targetText } from '$lib/domain/validate.js';
	import { anchorRefs, expandSetup, refLabel, type AnchorRef } from '$lib/domain/anchor.js';
	import { buildDailySet, isAnswered, type DailyAnswer } from '$lib/domain/daily.js';
	import { localDate } from '$lib/push/meta.js';
	import type { CaseEntry, Dataset } from '$lib/domain/types.js';

	let ds = $state<Dataset | null>(null);
	let sim = $state<CubeSim | null>(null);
	/** 지금 보고 있는 문제의 번호 (0부터). */
	let at = $state(0);

	const INPUT_OPTIONS: [
		{ value: Mode; label: string; hint: string; title: string },
		{ value: Mode; label: string; hint: string; title: string }
	] = [
		{
			value: 'direct',
			label: 'direct',
			hint: '무브를 직접 입력합니다',
			title: '18개 무브 버튼으로 알고리즘 전체를 입력한다'
		},
		{
			value: 'setup',
			label: 'setup',
			hint: '셋업 무브를 넣고 기준공식을 고릅니다',
			title: '셋업 S 를 입력한 뒤 기준공식을 고른다. 채점은 [S: 기준] 으로 한다'
		}
	];

	const today = localDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

	Promise.all([loadDataset(), getSim()]).then(([d, s]) => {
		ds = d;
		sim = s;
		// 풀다 나간 판이면 아직 답이 없는 첫 문제부터 연다
		const sn = daily.session;
		if (sn && sn.date === today && !sn.graded) {
			const i = sn.answers.findIndex((a) => !isAnswered(sn.mode, a));
			at = i === -1 ? 0 : i;
		}
	});

	/** 오늘의 판. 지난 날짜의 판은 없는 것과 같다. */
	let session = $derived(daily.session?.date === today ? daily.session : null);

	let stage = $derived(!ds ? '' : !session ? 'idle' : session.graded ? 'result' : 'active');

	/** 시작 전 안내에 쓰는 수. 지금 입력 방식의 암기 체크 중 데이터에 있는 것. */
	let memorizedCount = $derived.by(() => {
		if (!ds) return 0;
		const cases = ds.cases;
		return [...memorize.checkedFor(settings.quizInput)].filter((c) => c in cases).length;
	});
	let fromMemorized = $derived(Math.min(memorizedCount, daily.size));

	let current = $derived<CaseEntry | null>(
		session && ds ? (ds.cases[session.cases[at]] ?? null) : null
	);
	let answer = $derived<DailyAnswer | null>(session ? session.answers[at] : null);
	let isLast = $derived(session ? at === session.cases.length - 1 : false);
	let answeredCount = $derived(
		session ? session.answers.filter((a) => isAnswered(session.mode, a)).length : 0
	);
	let refs = $derived(ds ? anchorRefs(ds) : []);

	function partsOf(a: DailyAnswer): AlgPart[] {
		const parts: AlgPart[] = [];
		if (a.moves.length > 0) parts.push({ text: a.moves.join(' '), role: 'plain' });
		if (a.ref) parts.push({ text: refLabel(a.ref), role: 'anchor' });
		return parts;
	}

	function setMoves(moves: string[]) {
		if (answer) daily.answer(at, { ...answer, moves });
	}
	function pick(ref: AnchorRef) {
		if (answer) daily.answer(at, { ...answer, ref });
	}

	function start() {
		if (!ds || stage !== 'idle') return;
		const mode = settings.quizInput;
		const cases = buildDailySet(
			Object.keys(ds.cases),
			memorize.checkedFor(mode),
			daily.size,
			(c) => ds!.cases[c]?.inverse,
			Math.random
		);
		daily.start(today, mode, cases);
		at = 0;
		window.scrollTo({ top: 0 });
	}

	function move(d: number) {
		if (!session) return;
		at = Math.max(0, Math.min(session.cases.length - 1, at + d));
	}

	function gradeAll() {
		if (stage !== 'active') return;
		daily.grade();
		push.noteQuiz();
		window.scrollTo({ top: 0 });
	}

	/**
	 * 채점 결과. 답만 저장하고 판정은 저장하지 않는다 — 채점은 결정적이라 다시 열 때
	 * 같은 답에서 같은 판정이 나온다. 답이 없는 문제는 판정이 `null` 이다.
	 */
	let results = $derived.by(() => {
		if (!session?.graded || !ds || !sim) return [];
		const d = ds;
		const s = sim;
		const mode = session.mode;
		return session.cases.flatMap((code, i) => {
			const entry = d.cases[code];
			if (!entry) return [];
			const a = session.answers[i];
			let verdict: Verdict | null = null;
			if (isAnswered(mode, a)) {
				const alg = mode === 'setup' ? expandSetup(d, a.moves.join(' '), a.ref!) : a.moves.join(' ');
				verdict = grade(s, d, entry, alg);
			}
			return [{ entry, answer: a, verdict }];
		});
	});
	let correctCount = $derived(results.filter((r) => r.verdict?.kind === 'correct').length);
</script>

<svelte:head><title>3-Style Corner — 매일 퀴즈</title></svelte:head>

<UpLink href="/" label="홈" />

<h1>매일 퀴즈</h1>

{#if ds}
	<section
		class="daily"
		data-stage={stage}
		data-last={isLast}
		data-mode={session?.mode ?? settings.quizInput}
	>
		<div class="settings">
			<SegToggle
				name="daily-input"
				bind:value={settings.quizInput}
				options={INPUT_OPTIONS}
				disabled={stage !== 'idle'}
			/>
			<p class="plan" data-plan>
				{daily.size}문제. 암기 표시한 공식에서 {fromMemorized}개{#if fromMemorized < daily.size},
					나머지 {daily.size - fromMemorized}개는 무작위{/if}입니다.
			</p>
			<p class="plan">
				문제 수는 <a href="/settings/notify" data-goto-settings>알림 설정</a>에서 바꿉니다.
			</p>
		</div>

		{#if session && current && answer}
			<div class="run">
				<p class="pos" data-pos>
					{at + 1} / {session.cases.length} · 입력한 답 {answeredCount}개
				</p>
				<header>
					<div class="case" data-case={current.case}>{current.case}</div>
					<div class="targets">
						<span>{targetText(current.target1)}</span>
						<span>{targetText(current.target2)}</span>
					</div>
				</header>

				<div class="entry" data-alg={answer.moves.join(' ')} data-picked={answer.ref ? refLabel(answer.ref) : ''}>
					{#if partsOf(answer).length > 0}
						<Alg parts={partsOf(answer)} size="md" />
					{:else if session.mode === 'setup'}
						<span class="placeholder">셋업 무브를 넣고 기준공식을 고르세요</span>
					{:else}
						<span class="placeholder">공식을 입력하세요</span>
					{/if}
				</div>

				<MoveKeypad bind:moves={() => answer?.moves ?? [], setMoves} />

				{#if session.mode === 'setup'}
					<AnchorPad {refs} onpick={pick} />
				{/if}
			</div>
		{/if}

		<div class="result">
			<p class="summary" data-summary>
				{results.length}문제 중 {correctCount}개 정답
			</p>
			<ol>
				{#each results as r, i (i)}
					<li data-result-case={r.entry.case}>
						<div class="row-head">
							<span class="row-case">{r.entry.case}</span>
							<span class="row-targets"
								>{targetText(r.entry.target1)} → {targetText(r.entry.target2)}</span
							>
						</div>
						<div class="mine">
							{#if partsOf(r.answer).length > 0}
								<Alg parts={partsOf(r.answer)} size="sm" />
							{:else}
								<span class="placeholder">입력 없음</span>
							{/if}
						</div>
						<div
							class="verdict"
							data-verdict
							data-kind={r.verdict?.kind ?? 'blank'}
							data-result={r.verdict?.kind === 'correct' ? 'ok' : 'bad'}
						>
							{r.verdict ? verdictText(r.verdict) : '답을 내지 않았습니다'}
						</div>
						{#if r.verdict?.kind !== 'correct'}
							<dl class="answer">
								<dt>direct</dt>
								<dd><Alg parts={formatAlg(r.entry, 'direct', settings.notation)} size="sm" /></dd>
								<dt>setup</dt>
								<dd><Alg parts={formatAlg(r.entry, 'setup', settings.notation)} size="sm" /></dd>
							</dl>
						{/if}
					</li>
				{/each}
			</ol>
		</div>

		<div class="controls">
			<button type="button" class="primary" data-start disabled={stage !== 'idle'} onclick={start}
				>시작</button
			>
			<button
				type="button"
				class="secondary"
				data-prev
				disabled={stage !== 'active' || at === 0}
				onclick={() => move(-1)}>이전</button
			>
			<button
				type="button"
				class="primary"
				data-next
				disabled={stage !== 'active' || isLast}
				onclick={() => move(1)}>다음</button
			>
			<button
				type="button"
				class="primary"
				data-grade
				disabled={stage !== 'active' || !isLast}
				onclick={gradeAll}>채점</button
			>
		</div>
	</section>
{:else}
	<p class="loading">불러오는 중</p>
{/if}

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0.2rem 0 0.6rem;
	}
	.daily {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding-top: 0.6rem;
		/*
		 * 화면 높이를 채우지 않는다. 퀴즈의 `min-height: calc(100dvh - …)` 는 위의
		 * 되돌아가기·h1 높이와 실제 하단 탭 높이를 빼지 않아서, 본문이 짧은 시작 전
		 * 단계에서 [시작] 을 하단 탭 뒤로 밀어 넣었다 (2026-10-20 폰에서 확인).
		 */
	}

	/*
	 * 단계별 접기 (규약 2.7). 신호는 `data-stage` 하나, 마지막 문제인지만
	 * `data-last` 로 따로 낸다 — 다음과 채점이 단계만으로는 안 갈린다 (규약 2.5).
	 * 잠금은 각 버튼의 `disabled` 가 따로 한다 (규약 2.4).
	 */
	.daily:not([data-stage='idle']) .settings,
	.daily:not([data-stage='active']) .run,
	.daily:not([data-stage='result']) .result,
	.controls button {
		display: none;
	}
	[data-stage='idle'] [data-start],
	[data-stage='active'] [data-prev],
	[data-stage='active'][data-last='false'] [data-next],
	[data-stage='active'][data-last='true'] [data-grade] {
		display: block;
	}

	.settings {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 20rem;
		width: 100%;
		margin: 0 auto;
	}
	.plan {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--muted);
	}
	.plan a {
		color: var(--accent);
	}
	.run {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.pos {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
		text-align: center;
	}
	header {
		text-align: center;
	}
	.case {
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
	.summary {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}
	.result ol {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.result li {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.row-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
	}
	.row-case {
		font-family: var(--mono);
		font-size: 1.2rem;
		letter-spacing: 0.1em;
	}
	.row-targets {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--muted);
	}
	.verdict {
		padding: 0.4rem 0.6rem;
		font-size: 0.9rem;
		border-radius: 6px;
		border: 1px solid var(--border);
	}
	/* 색은 `data-result` 하나만 본다 (규약) */
	.verdict[data-result='ok'] {
		color: var(--ok);
		border-color: var(--ok);
	}
	.verdict[data-result='bad'] {
		color: var(--danger);
		border-color: var(--danger);
	}
	.answer {
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
	/* 진행 버튼은 본문 최하단 (규약 1.3). 엄지 도달 범위에 둔다 */
	.controls {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
	}
	.controls button {
		flex: 1;
		min-height: 48px;
		font-size: 1rem;
		border-radius: 8px;
		cursor: pointer;
	}
	.primary {
		color: var(--bg);
		background: var(--fg);
		border: none;
	}
	.secondary {
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
	}
	.controls button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.loading {
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
