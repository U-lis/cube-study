<!--
	시험 (SPEC FR-EX, 사용자 결정 2026-10-29).

	매일 퀴즈와 세 가지가 다르다.
	  - **날짜가 없다.** 하루 몇 번을 쳐도 같은 저장을 쓴다 (FR-EX-S-4). 과거 결과는
	    `exam.records` 에 쌓여 idle 목록에 뜬다 (FR-EX-REC-4).
	  - **채점 뒤 되돌아간다.** 결과는 저장되어 있으니 `다시 시작` 버튼 하나로 idle
	    로 간다 — 매일 퀴즈처럼 그날 동안 결과를 띄워 두지 않는다.
	  - **기록은 그린 그대로다.** idle 목록은 저장된 `correct` 를 쓴다. 재채점하지
	    않는다 (AD-13) — 데이터가 바뀌어도 과거 기록이 바뀌지 않고, 50건을 다시
	    돌리는 비용도 없다.

	매일 퀴즈 run 블록과 결과 블록(`QuizResults.svelte`)은 그대로 쓴다. 세션 스토어는
	각자 모듈이 들고 있다 (GLOBAL AD-12).

	데이터셋이 오기 전에는 본문을 그리지 않는다. 판의 단계가 localStorage 에서 오므로
	서버가 그린 화면과 하이드레이션한 화면이 갈리지 않게 한다 — 매일 퀴즈의 주석을
	참고.
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import MoveKeypad from '$lib/ui/MoveKeypad.svelte';
	import AnchorPad from '$lib/ui/AnchorPad.svelte';
	import SegToggle from '$lib/ui/SegToggle.svelte';
	import PageTitle from '$lib/ui/PageTitle.svelte';
	import QuizResults from '$lib/ui/QuizResults.svelte';
	import { settings } from '$lib/ui/settings.svelte.js';
	import { memorize } from '$lib/ui/memorize.svelte.js';
	import { exam } from '$lib/ui/exam.svelte.js';
	import { push } from '$lib/ui/push.svelte.js';
	import { loadDataset } from '$lib/data/loader.js';
	import { getSim, type CubeSim } from '$lib/cube/sim.js';
	import { grade, type Verdict } from '$lib/domain/grade.js';
	import { type AlgPart, type Mode } from '$lib/domain/format.js';
	import { targetText } from '$lib/domain/validate.js';
	import { anchorRefs, expandSetup, refLabel, type AnchorRef } from '$lib/domain/anchor.js';
	import { buildDailySet } from '$lib/domain/daily.js';
	import { EXAM_SIZES } from '$lib/domain/exam.js';
	import { isAnswered, type QuizAnswer } from '$lib/domain/session.js';
	import { localDate } from '$lib/push/meta.js';
	import type { CaseEntry, Dataset } from '$lib/domain/types.js';

	let ds = $state<Dataset | null>(null);
	let sim = $state<CubeSim | null>(null);
	/** 지금 보고 있는 문항의 번호 (0부터). */
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

	Promise.all([loadDataset(), getSim()]).then(([d, s]) => {
		ds = d;
		sim = s;
		// 풀다 나간 판이면 아직 답이 없는 첫 문항부터 연다 (FR-EX-S-6)
		const sn = exam.session;
		if (sn && !sn.graded) {
			const i = sn.answers.findIndex((a) => !isAnswered(sn.mode, a));
			at = i === -1 ? 0 : i;
		}
	});

	let session = $derived(exam.session);
	let stage = $derived(!ds ? '' : !session ? 'idle' : session.graded ? 'result' : 'active');

	/** 시작 전 안내에 쓰는 수. 지금 입력 방식의 암기 체크 중 데이터에 있는 것. */
	let memorizedCount = $derived.by(() => {
		if (!ds) return 0;
		const cases = ds.cases;
		return [...memorize.checkedFor(settings.quizInput)].filter((c) => c in cases).length;
	});
	let fromMemorized = $derived(Math.min(memorizedCount, exam.size));

	let current = $derived<CaseEntry | null>(
		session && ds ? (ds.cases[session.cases[at]] ?? null) : null
	);
	let answer = $derived<QuizAnswer | null>(session ? session.answers[at] : null);
	let isLast = $derived(session ? at === session.cases.length - 1 : false);
	let answeredCount = $derived(
		session ? session.answers.filter((a) => isAnswered(session.mode, a)).length : 0
	);
	let refs = $derived(ds ? anchorRefs(ds) : []);

	function partsOf(a: QuizAnswer): AlgPart[] {
		const parts: AlgPart[] = [];
		if (a.moves.length > 0) parts.push({ text: a.moves.join(' '), role: 'plain' });
		if (a.ref) parts.push({ text: refLabel(a.ref), role: 'anchor' });
		return parts;
	}

	function setMoves(moves: string[]) {
		if (answer) exam.answer(at, { ...answer, moves });
	}
	function pick(ref: AnchorRef) {
		if (answer) exam.answer(at, { ...answer, ref });
	}

	function start() {
		if (!ds || stage !== 'idle') return;
		const mode = settings.quizInput;
		const cases = buildDailySet(
			Object.keys(ds.cases),
			memorize.checkedFor(mode),
			exam.size,
			(c) => ds!.cases[c]?.inverse,
			Math.random
		);
		exam.start(mode, cases);
		at = 0;
		window.scrollTo({ top: 0 });
	}

	function move(d: number) {
		if (!session) return;
		at = Math.max(0, Math.min(session.cases.length - 1, at + d));
	}

	/**
	 * 채점 결과. 답만 저장하고 판정은 저장하지 않는다 — 채점은 결정적이라 다시 열
	 * 때 같은 답에서 같은 판정이 나온다. 답이 없는 문항은 판정이 `null` 이다.
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

	function gradeAll() {
		if (stage !== 'active' || !ds || !sim) return;
		// 채점을 먼저 돌려 `correct` 를 세고 그 숫자를 기록 스냅샷에 박는다 (AD-13).
		const sn = session;
		if (!sn) return;
		const d = ds;
		const s = sim;
		let correct = 0;
		for (let i = 0; i < sn.cases.length; i++) {
			const entry = d.cases[sn.cases[i]];
			if (!entry) continue;
			const a = sn.answers[i];
			if (!isAnswered(sn.mode, a)) continue;
			const alg = sn.mode === 'setup' ? expandSetup(d, a.moves.join(' '), a.ref!) : a.moves.join(' ');
			const v = grade(s, d, entry, alg);
			if (v.kind === 'correct') correct++;
		}
		const today = localDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
		exam.grade(correct, today);
		push.noteQuiz();
		window.scrollTo({ top: 0 });
	}

	function reset() {
		exam.reset();
		at = 0;
		window.scrollTo({ top: 0 });
	}

	const INPUT_LABEL: Record<Mode, string> = { direct: 'direct', setup: 'setup' };
</script>

<svelte:head><title>3-Style Corner — 시험</title></svelte:head>

<PageTitle href="/" label="홈"><h1>시험</h1></PageTitle>

{#if ds}
	<section
		class="exam"
		data-stage={stage}
		data-last={isLast}
		data-mode={session?.mode ?? settings.quizInput}
	>
		<div class="settings">
			<SegToggle
				name="exam-input"
				bind:value={settings.quizInput}
				options={INPUT_OPTIONS}
				disabled={stage !== 'idle'}
			/>
			<label class="size">
				<span>문항 수</span>
				<select
					data-exam-size
					value={exam.size}
					disabled={stage !== 'idle'}
					onchange={(e) => exam.setSize(Number(e.currentTarget.value))}
				>
					{#each EXAM_SIZES as n (n)}
						<option value={n}>{n}</option>
					{/each}
				</select>
			</label>
			<p class="plan" data-plan>
				{exam.size}문제. 암기 표시한 공식에서 {fromMemorized}개{#if fromMemorized < exam.size},
					나머지 {exam.size - fromMemorized}개는 무작위{/if}입니다.
			</p>

			<div class="records" data-records>
				<h2>지난 기록</h2>
				{#if exam.records.length === 0}
					<p class="empty" data-records-empty>기록이 없습니다</p>
				{:else}
					<ul>
						{#each exam.records as r, i (i)}
							<li data-record>
								<span class="date">{r.date}</span>
								<span class="mode">{INPUT_LABEL[r.mode]}</span>
								<span class="score">{r.cases.length}문제 중 {r.correct}개</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
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

				<div
					class="entry"
					data-alg={answer.moves.join(' ')}
					data-picked={answer.ref ? refLabel(answer.ref) : ''}
				>
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
			<QuizResults
				results={session?.graded ? results : []}
				mode={session?.mode ?? settings.quizInput}
				notation={settings.notation}
			/>
		</div>

		<div class="controls">
			<button
				type="button"
				class="primary"
				data-start
				disabled={stage !== 'idle'}
				onclick={start}>시작</button
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
			<button
				type="button"
				class="primary"
				data-restart
				disabled={stage !== 'result'}
				onclick={reset}>다시 시작</button
			>
		</div>
	</section>
{:else}
	<p class="loading">불러오는 중</p>
{/if}

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0;
	}
	h2 {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0;
	}
	.exam {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding-top: 0.6rem;
		/* 매일 퀴즈·M2 퀴즈·코너 퀴즈와 같은 패턴 (AD-11). calc 는 쓰지 않는다. */
		flex: 1;
	}

	/*
	 * 단계별 접기 (규약 2.7). 신호는 `data-stage` 하나, 마지막 문항인지만
	 * `data-last` 로 따로 낸다. 잠금은 각 버튼의 `disabled` 가 따로 한다 (규약 2.4).
	 * 접기는 CSS 로 한다 — `{#if}` 로 DOM 에서 빼지 않는다 (CLAUDE.md 함정).
	 */
	.exam:not([data-stage='idle']) .settings,
	.exam:not([data-stage='active']) .run,
	.exam:not([data-stage='result']) .result,
	.controls button {
		display: none;
	}
	[data-stage='idle'] [data-start],
	[data-stage='active'] [data-prev],
	[data-stage='active'][data-last='false'] [data-next],
	[data-stage='active'][data-last='true'] [data-grade],
	[data-stage='result'] [data-restart] {
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
	.size {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 44px;
		font-size: 0.9rem;
	}
	.size select {
		flex: 1;
		min-height: 44px;
		padding: 0 0.6rem;
		font-size: 1rem;
		background: var(--bg);
		color: var(--fg);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.plan {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: var(--muted);
	}
	.records {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}
	.records ul {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.records li {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: 0.6rem;
		align-items: baseline;
		padding: 0.4rem 0.6rem;
		font-size: 0.9rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.records .date,
	.records .mode {
		font-family: var(--mono);
		color: var(--muted);
	}
	.records .score {
		text-align: right;
	}
	.empty {
		margin: 0;
		font-size: 0.88rem;
		color: var(--muted);
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
	/* 진행 버튼은 본문 최하단 (규약 1.3). 매일 퀴즈와 같은 모양. */
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
