<!--
	OP 코너 — 퀴즈 (#18, SPEC FR-OP-Q).

	문자 하나를 보고 공식 전체(`setup [Y] setup'`)를 친다. 자판에 `[Y]` 토큰
	하나를 추가해 15수를 다시 치지 않게 한다 (AD-1). Y 행 문제에서는 `[Y]` 를
	잠근다 — 정답이 `[Y]` 단독이면 외우는 것이 아니라 토큰 하나 누르는 것이 된다
	(AD-6). P 행은 정답이 `[Y]` 단독이라 잠그지 않는다 (AD-6).

	채점은 `expandY` → 54칸 상태 비교 (AD-5). 다른 순서의 동치 공식도 정답, 다른
	줄의 공식이면 그 라벨을 돌려준다.

	M2 퀴즈와 같은 자리에 같은 신호를 둔다 (`data-stage`, `data-verdict`,
	`data-grade`, `data-next`).
-->
<script lang="ts">
	import Alg from '$lib/ui/Alg.svelte';
	import MoveKeypad from '$lib/ui/MoveKeypad.svelte';
	import PageTitle from '$lib/ui/PageTitle.svelte';
	import { op } from '$lib/ui/op.svelte.js';
	import { push } from '$lib/ui/push.svelte.js';
	import {
		displayPartsOf,
		gradeOp,
		itemsOf,
		opVerdictText,
		type OpDataSet,
		type OpItem,
		type OpVerdict
	} from '$lib/domain/op.js';
	import { pickNext, pushRecent } from '$lib/domain/quiz.js';
	import dataJson from '$lib/data/corner-UBL-op.json';

	const ds = dataJson as unknown as OpDataSet;
	const items: OpItem[] = itemsOf(ds);
	const yPerm = ds.meta.yPerm;
	/** id → item 역색인. pickNext 가 id 문자열만 넘기므로 되찾을 길이 필요하다. */
	const byId: Record<string, OpItem> = Object.fromEntries(items.map((it) => [it.id, it]));

	/**
	 * 자판 추가 줄 (AD-1). 자판의 단일 토큰 `[Y]` 하나. 면 18개는 `MoveKeypad` 가
	 * 이미 들고 있다 — OP 는 D·F·R 면만 쓰지만 자판은 세트별로 나누지 않는다
	 * (M2 퀴즈의 추가 줄과 같은 결정).
	 */
	const EXTRA_ROWS: readonly (readonly string[])[] = [['[Y]']];

	let current = $state<OpItem | null>(null);
	let moves = $state<string[]>([]);
	let verdict = $state<OpVerdict | null>(null);
	/** 세션 내 최근 20 (SPEC FR-OP-Q-5). 새로고침하면 비는 것이 맞다. */
	let recent = $state<string[]>([]);

	/** 출제 풀. memorizedOnly 가 켜지면 체크한 id 로 좁힌다 (SPEC FR-OP-Q-4). */
	let pool = $derived.by((): string[] => {
		if (op.memorizedOnly) {
			const checked = op.checked;
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
	 * (SPEC FR-OP-Q-4, M2 퀴즈와 같은 길).
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
		verdict = gradeOp(moves.join(' '), current, items, yPerm);
		push.noteQuiz();
	}

	let alg = $derived(moves.join(' '));
	let canSubmit = $derived(moves.length > 0 && verdict === null);
	let poolEmpty = $derived(op.memorizedOnly && pool.length === 0);
	/** 색은 `data-result` 하나로만 칠한다. correct 만 ok, 나머지는 bad. */
	let result = $derived<'ok' | 'bad' | ''>(
		verdict ? (verdict.kind === 'correct' ? 'ok' : 'bad') : ''
	);
	/** 단계. idle 은 없다 — 문제가 뜨는 순간 입력이 열린다 (M2 퀴즈와 같은 결정). */
	let stage = $derived(!current ? '' : verdict ? 'result' : 'active');
	/**
	 * 문제 영역의 자리 문구. Y 행에서는 `piece` 대신 `Y-perm` 으로 표시한다
	 * (SPEC FR-OP-Q-1) — 자리의 이름이 아니라 공식 자체의 이름이기 때문이다.
	 */
	let placeText = $derived.by((): string => {
		if (!current) return '';
		return current.isYRow ? 'Y-perm' : current.piece;
	});
	/**
	 * Y 행 문제에서만 `[Y]` 를 잠근다 (AD-6). P 행은 정답이 `[Y]` 단독이라
	 * 잠그면 입력할 수 없다.
	 */
	let disabledTokens = $derived<readonly string[]>(current?.isYRow ? ['[Y]'] : []);
</script>

<svelte:head><title>OP 코너 — 퀴즈</title></svelte:head>

<PageTitle href="/" label="홈"><h1>퀴즈</h1></PageTitle>

<section class="quiz" data-stage={stage}>
	<!--
		설정 (SPEC FR-OP-Q-4). 측정 중(active)에는 CSS 로 접는다 — DOM 에서 제거하지
		않는다 (CLAUDE.md "접기는 CSS 로 한다"). 기록을 안 남기므로 잠그지 않는다.
	-->
	<label class="memorized-only" data-memorized-only-toggle>
		<input
			type="checkbox"
			checked={op.memorizedOnly}
			onchange={(e) => (op.memorizedOnly = e.currentTarget.checked)}
			data-memorized-only-input
		/>
		<span>암기한 것만 출제</span>
	</label>

	{#if poolEmpty}
		<p class="empty-pool" data-empty-pool>암기 표시한 공식이 없습니다</p>
	{:else if current}
		<header>
			<!--
				문제 영역. 문자는 크게, 자리는 작게. `<h1>` 은 화면 이름이고 문제는
				header 아래에 둔다 (화면 규약).
			-->
			<div class="target" data-target-id={current.id}>
				<div class="letter" data-target-letter>{current.letter}</div>
				<div class="meta">
					<span class="place" data-target-place>{placeText}</span>
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

		<MoveKeypad bind:moves extraRows={EXTRA_ROWS} {disabledTokens} />

		{#if verdict}
			<!--
				판정 줄 (화면 규약). `data-kind` 가 무엇인지, `data-result` 가 좋은 소식인지.
				색은 뒤쪽만 보고 칠한다.
			-->
			<div class="verdict" data-verdict data-kind={verdict.kind} data-result={result}>
				{opVerdictText(verdict)}
			</div>

			<!--
				결과 공식 (SPEC FR-OP-Q-3). result 단계에서만 뜬다 — active 에서는 보이지 않는다.
			-->
			<div class="answer" data-answer>
				<dt>공식</dt>
				<dd>
					<Alg parts={displayPartsOf(current, yPerm)} size="sm" />
				</dd>
				<a href="/3x3/bld/op/corner/lookup" data-goto-lookup>조회 화면에서 보기</a>
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
		/* 셸 높이에서 상단 바를 뺀 만큼 — M2 퀴즈와 같은 값. */
		flex: 1;
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
