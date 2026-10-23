<!--
	M2 엣지 — 퀴즈 (#17, SPEC FR-M2-Q).

	타깃 하나를 보고 공식 전체를 친다. 입력 방식은 직접 입력 하나뿐이고(AD-7)
	셋업/기준공식 구분이 없다 — M2 는 기준공식 개념이 없다.

	채점은 54칸 상태 비교(AD-2). 다른 순서의 동치 공식도 정답, 다른 줄의 공식이면
	그 라벨을 돌려준다.

	3-style 코너 퀴즈와 같은 자리에 같은 신호를 둔다 (`data-stage`, `data-verdict`,
	`data-grade`, `data-next`).
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import MoveKeypad from '$lib/ui/MoveKeypad.svelte';
	import PageTitle from '$lib/ui/PageTitle.svelte';
	import { m2 } from '$lib/ui/m2.svelte.js';
	import { push } from '$lib/ui/push.svelte.js';
	import { gradeM2, itemsOf, labelOf, m2VerdictText, type M2DataSet, type M2Item, type M2Verdict } from '$lib/domain/m2.js';
	import { pickNext, pushRecent } from '$lib/domain/quiz.js';
	import dataJson from '$lib/data/edge-DF-m2.json';

	const ds = dataJson as unknown as M2DataSet;
	const items: M2Item[] = itemsOf(ds);
	/** id → item 역색인. pickNext 가 id 문자열만 넘기므로 되찾을 길이 필요하다. */
	const byId: Record<string, M2Item> = Object.fromEntries(items.map((it) => [it.id, it]));

	/**
	 * 자판 추가 줄 (SPEC AD-3, FR-M2-Q-2). 이 세트의 공식이 쓰는 무브 전부다 —
	 * `M·M'·M2` 와 `l·l'·r·r'`. 면 18개는 `MoveKeypad` 가 이미 들고 있다.
	 */
	const EXTRA_ROWS: readonly (readonly string[])[] = [
		['M', "M'", 'M2'],
		['l', "l'", 'r', "r'"]
	];

	let current = $state<M2Item | null>(null);
	let moves = $state<string[]>([]);
	let verdict = $state<M2Verdict | null>(null);
	/** 세션 내 최근 20 (SPEC FR-M2-Q-5). 새로고침하면 비는 것이 맞다. */
	let recent = $state<string[]>([]);

	/** 출제 풀. memorizedOnly 가 켜지면 체크한 id 로 좁힌다 (SPEC FR-M2-Q-4). */
	let pool = $derived.by((): string[] => {
		if (m2.memorizedOnly) {
			const checked = m2.checked;
			return items.filter((it) => checked.has(it.id)).map((it) => it.id);
		}
		return items.map((it) => it.id);
	});

	function clearEntry() {
		moves = [];
		verdict = null;
	}

	function next() {
		const seen = current ? pushRecent(recent, current.id) : recent;
		const picked = pickNext(pool, seen, undefined, Math.random);
		if (picked === null) {
			current = null;
			clearEntry();
			return;
		}
		recent = seen;
		current = byId[picked];
		clearEntry();
	}

	/**
	 * pool 이 비면 current = null 로 두고 안내만 낸다. 전체로 자동 전환하지 않는다
	 * (SPEC FR-M2-Q-4). pool 이 들어차면 그때 첫 문제를 뽑는다 (3-style 퀴즈와 같은 길).
	 */
	$effect(() => {
		const p = pool;
		if (p.length === 0) {
			if (current !== null) {
				current = null;
				clearEntry();
			}
			return;
		}
		if (!current || !p.includes(current.id)) {
			next();
		}
	});

	function submit() {
		if (!current || moves.length === 0) return;
		verdict = gradeM2(moves.join(' '), current.alg, items);
		push.noteQuiz();
	}

	let alg = $derived(moves.join(' '));
	let canSubmit = $derived(moves.length > 0 && verdict === null);
	let poolEmpty = $derived(m2.memorizedOnly && pool.length === 0);
	/** 색은 `data-result` 하나로만 칠한다. correct 만 ok, 나머지는 bad. */
	let result = $derived<'ok' | 'bad' | ''>(
		verdict ? (verdict.kind === 'correct' ? 'ok' : 'bad') : ''
	);
	/** 단계. idle 은 없다 — 문제가 뜨는 순간 입력이 열린다 (코너 퀴즈와 같은 결정). */
	let stage = $derived(!current ? '' : verdict ? 'result' : 'active');
	/**
	 * 문제 영역의 순번 문구. M 슬라이스(odd/even) 와 패리티에서만 선다 (SPEC FR-M2-Q-1).
	 * 짝이 버퍼인 A·Q (order=null) 처럼 순번과 무관한 줄은 비운다.
	 */
	let orderText = $derived.by((): string => {
		if (!current) return '';
		if (current.order === 'odd') return '홀수 번째';
		if (current.order === 'even') return '짝수 번째';
		if (current.order === 'parity') return '패리티';
		return '';
	});
</script>

<svelte:head><title>M2 엣지 — 퀴즈</title></svelte:head>

<PageTitle href="/" label="홈"><h1>퀴즈</h1></PageTitle>

<section class="quiz" data-stage={stage}>
	<!--
		설정 (SPEC FR-M2-Q-4). 측정 중(active)에는 CSS 로 접는다 — DOM 에서 제거하지
		않는다 (CLAUDE.md "접기는 CSS 로 한다"). 기록을 안 남기므로 잠그지 않는다.
	-->
	<label class="memorized-only" data-memorized-only-toggle>
		<input
			type="checkbox"
			checked={m2.memorizedOnly}
			onchange={(e) => (m2.memorizedOnly = e.currentTarget.checked)}
			data-memorized-only-input
		/>
		<span>암기한 것만 출제</span>
	</label>

	{#if poolEmpty}
		<p class="empty-pool" data-empty-pool>암기 표시한 공식이 없습니다</p>
	{:else if current}
		<header>
			<!--
				문제 영역. 문자는 크게, 자리와 순번은 작게. 코너 퀴즈처럼 `<h1>` 은
				화면 이름이고 문제는 header 아래에 둔다 (화면 규약).
			-->
			<div class="target" data-target-id={current.id}>
				<div class="letter" data-target-letter>{current.letter || '—'}</div>
				<div class="meta">
					<span class="place" data-target-place>{current.place}</span>
					{#if orderText}
						<span class="order" data-target-order>{orderText}</span>
					{/if}
				</div>
			</div>
		</header>

		<!--
			입력창. 판정이 서면 색이 바뀐다. 자리·여백은 그대로.
		-->
		<div class="entry" data-alg={alg} data-result={result}>
			{#if alg}
				<Alg parts={[{ text: alg, role: 'plain' }]} size="md" />
			{:else}
				<span class="placeholder">공식을 입력하세요</span>
			{/if}
		</div>

		<MoveKeypad bind:moves extraRows={EXTRA_ROWS} />

		{#if verdict}
			<!--
				판정 줄 (화면 규약). `data-kind` 가 무엇인지, `data-result` 가 좋은 소식인지.
				색은 뒤쪽만 보고 칠한다.
			-->
			<div class="verdict" data-verdict data-kind={verdict.kind} data-result={result}>
				{m2VerdictText(verdict)}
			</div>

			<!--
				결과 공식 (SPEC FR-M2-Q-3). result 단계에서만 뜬다 — active 에서는 보이지 않는다.
			-->
			<div class="answer" data-answer>
				<dt>공식</dt>
				<dd>
					<Alg parts={[{ text: current.alg, role: 'plain' }]} size="sm" />
				</dd>
				<a href="/3x3/bld/m2/edge/lookup" data-goto-lookup>조회 화면에서 보기</a>
			</div>
		{/if}

		<div class="controls">
			{#if verdict}
				<button type="button" class="primary" data-next onclick={next}>다음 문제</button>
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

<style>
	h1 {
		font-size: 1.3rem;
		margin: 0;
	}
	.quiz {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding-top: 0.6rem;
		/* 셸 높이에서 상단 바와 하단 네비를 뺀 만큼 — 코너 퀴즈와 같은 값. */
		min-height: calc(100dvh - 52px - 40px - 1rem);
	}
	/*
	 * 설정 (화면 규약 "측정하는 판이 도는 동안만 접는다"). active 에서는 CSS 로 접고
	 * DOM 에는 남긴다. 잠그지 않는다 — 기록을 안 남기는 화면이라서다.
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
	.quiz[data-stage='active'] .memorized-only {
		height: 0;
		min-height: 0;
		overflow: hidden;
		opacity: 0;
		margin: 0;
		pointer-events: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.memorized-only {
			transition: none;
		}
	}
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
	.target {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}
	.letter {
		font-family: var(--mono);
		font-size: 3rem;
		letter-spacing: 0.1em;
		line-height: 1;
	}
	.meta {
		display: flex;
		gap: 0.6rem;
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
		align-items: baseline;
		padding: 0.7rem;
		background: var(--surface);
		border-radius: 8px;
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
	.answer a {
		grid-column: 1 / -1;
		margin-top: 0.3rem;
		font-size: 0.85rem;
		color: var(--accent);
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
