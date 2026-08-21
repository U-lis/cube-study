<!--
	24글자 온스크린 스티커 패드 (FR-TR-18).

	`MoveKeypad.svelte:1-5` 와 같은 발상이다 — 모바일 소프트 키보드는 연속 입력에서
	자동 대문자·자동 완성·포커스 이동으로 흐름을 끊는다. 0.1.0 SPEC 이 "온스크린
	스티커 입력 패드 | 0.2.0 이후 재검토" 로 미뤄둔 항목이 여기서 돌아온다.

	─── SSR/CSR 요소 개수 (AD-14) ──────────────────────────────
	버튼 24개 + 동작 버튼 3개(삭제·전체 지우기·구분자)가 **항상** 존재한다.
	구분자 버튼은 대상이 `both` 일 때만 눌리지만, 없앴다 넣었다 하지 않는다 —
	대상 설정은 저장소에서 오므로 SSR 과 CSR 의 버튼 개수가 갈린다. `{#if}` 로 넣다 뺐다 하지 않고
	`disabled` 로만 잠근다. 이 저장소가 두 번 밟은 함정이다.
	────────────────────────────────────────────────────────────

	─── 24글자 전부가 눌린다 ───────────────────────────────────
	버퍼 문자도 잠그지 않는다. 입력이 한 줄로 합쳐진 뒤로는 "타깃 자리에서는 잠기고
	비틀림 선언 자리에서는 열린다" 가 문맥에 따라 갈리는 규칙이 되어 사용자가
	예측할 수 없다. 버퍼를 피하는 것은 사람이 할 일이고, 틀렸을 때 왜 틀렸는지는
	채점이 말한다 (`buffer-sticker`).
	────────────────────────────────────────────────────────────
-->
<script lang="ts">
	let {
		letters,
		value = $bindable(),
		disabled = false,
		max,
		onedit,
		pad,
		separator,
		separatorLabel,
		separatorEnabled = false
	}: {
		/** 24글자. 코너면 `CORNER_LETTERS`, 엣지면 `EDGE_LETTERS` (`speffz.ts:51-52`). */
		letters: string[];
		/** 입력된 문자 열. 순서가 그대로 판독의 입력이다. */
		value: string[];
		disabled?: boolean;
		/** 상한 (`MoveKeypad.svelte:9` 의 `MAX_MOVES` 와 같은 취지 — 폭주 방지). */
		max: number;
		/** 검사용 이름. 두 구획의 패드를 구분한다. */
		pad: string;
		/** 입력이 있었음을 알린다. 계시의 종료 시점이 마지막 입력이다 (FR-TR-23). */
		onedit?: () => void;
		/** 갈래를 가르는 문자. 상한은 글자만 세므로 이 문자는 빼고 센다. */
		separator: string;
		/** 구분자 버튼의 라벨. */
		separatorLabel: string;
		/**
		 * 구분자를 넣을 수 있는가. **버튼은 언제나 그린다** — `{#if}` 로 넣다 뺐다
		 * 하면 대상 설정에 따라 SSR 과 CSR 의 버튼 개수가 갈린다 (AD-14).
		 */
		separatorEnabled?: boolean;
	} = $props();

	/** 상한이 세는 것은 글자다. 구분자는 갈래의 경계이지 타깃이 아니다. */
	let count = $derived(value.filter((c) => c !== separator).length);
	let full = $derived(count >= max);

	function push(letter: string) {
		if (full) return;
		value = [...value, letter];
		onedit?.();
	}

	/** 구분자를 넣는다. 이 뒤로 패드 글자가 다음 갈래로 바뀐다 (호출부가 정한다). */
	function split() {
		value = [...value, separator];
		onedit?.();
	}

	function back() {
		value = value.slice(0, -1);
		onedit?.();
	}

	function clear() {
		value = [];
		onedit?.();
	}
</script>

<div class="pad" data-pad={pad} data-max={max} data-count={count}>
	<div class="keys">
		{#each letters as letter (letter)}
			<button
				type="button"
				data-letter={letter}
				title={letter}
				disabled={disabled || full}
				onclick={() => push(letter)}
			>
				{letter}
			</button>
		{/each}
	</div>
	<div class="actions">
		<button
			type="button"
			data-action="back"
			disabled={disabled || value.length === 0}
			onclick={back}
		>
			삭제
		</button>
		<button
			type="button"
			data-action="clear"
			disabled={disabled || value.length === 0}
			onclick={clear}
		>
			전체 지우기
		</button>
		<button
			type="button"
			data-action="separator"
			title={separatorLabel}
			disabled={disabled || !separatorEnabled}
			onclick={split}
		>
			{separatorLabel}
		</button>
	</div>
</div>

<style>
	.pad {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.keys {
		display: grid;
		/* 6 × 4. 320px 폭에서도 가로가 넘치지 않도록 열이 늘어난다. */
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.25rem;
	}
	button {
		/* 터치 타깃 44px (FR-MC-4 와 같은 기준). */
		min-height: 44px;
		min-width: 0;
		padding: 0;
		font-family: var(--mono);
		font-size: 1rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		cursor: pointer;
		touch-action: manipulation;
	}
	button:active {
		background: var(--border);
	}
	button:disabled {
		color: var(--muted);
		cursor: default;
		opacity: 0.5;
	}
	.actions {
		display: grid;
		/* 세 칸. 320px 에서도 칸이 밖으로 밀지 않도록 `minmax(0, …)` 로 둔다. */
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.25rem;
	}
	.actions button {
		padding: 0 0.15rem;
		font-family: var(--sans);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--muted);
	}
</style>
