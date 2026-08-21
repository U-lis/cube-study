<!--
	24글자 온스크린 스티커 패드 (FR-TR-18).

	`MoveKeypad.svelte:1-5` 와 같은 발상이다 — 모바일 소프트 키보드는 연속 입력에서
	자동 대문자·자동 완성·포커스 이동으로 흐름을 끊는다. 0.1.0 SPEC 이 "온스크린
	스티커 입력 패드 | 0.2.0 이후 재검토" 로 미뤄둔 항목이 여기서 돌아온다.

	─── SSR/CSR 요소 개수 (AD-14) ──────────────────────────────
	버튼 24개 + 동작 버튼 2개가 **항상** 존재한다. `{#if}` 로 넣다 뺐다 하지 않고
	`disabled` 로만 잠근다. 이 저장소가 두 번 밟은 함정이다.
	────────────────────────────────────────────────────────────

	─── 버퍼 문자를 색으로만 잠그지 않는다 ─────────────────────
	버퍼 스티커는 타깃이 될 수 없다(HANDOFF §4.1). 그렇다고 버튼을 빼면 24글자
	배치가 흐트러져 "몇 번째 칸이 무슨 문자인가" 라는 근육 기억이 깨진다. 그래서
	자리는 두고 잠근다. 잠근 표시는 **색이 아니라 파선 테두리와 취소선** 이다 —
	색만으로 상태를 알리면 색각 이상에서 그냥 눌리는 버튼으로 보인다.
	────────────────────────────────────────────────────────────
-->
<script lang="ts">
	let {
		letters,
		value = $bindable(),
		blocked = [],
		disabled = false,
		max,
		onedit,
		pad
	}: {
		/** 24글자. 코너면 `CORNER_LETTERS`, 엣지면 `EDGE_LETTERS` (`speffz.ts:51-52`). */
		letters: string[];
		/** 입력된 문자 열. 순서가 의미를 갖는 구획에서는 그대로 타깃 열이다. */
		value: string[];
		/** 눌러도 들어가지 않는 문자. 타깃 구획의 버퍼 스티커가 이것이다. */
		blocked?: readonly string[];
		disabled?: boolean;
		/** 상한 (`MoveKeypad.svelte:9` 의 `MAX_MOVES` 와 같은 취지 — 폭주 방지). */
		max: number;
		/** 검사용 이름. 두 구획의 패드를 구분한다. */
		pad: string;
		/** 입력이 있었음을 알린다. 계시의 종료 시점이 마지막 입력이다 (FR-TR-23). */
		onedit?: () => void;
	} = $props();

	let locked = $derived(new Set(blocked));
	let full = $derived(value.length >= max);

	function push(letter: string) {
		if (locked.has(letter) || value.length >= max) return;
		value = [...value, letter];
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

<div class="pad" data-pad={pad} data-max={max} data-count={value.length}>
	<div class="keys">
		{#each letters as letter (letter)}
			<button
				type="button"
				data-letter={letter}
				data-blocked={locked.has(letter) ? 'true' : 'false'}
				title={locked.has(letter) ? `${letter} — 버퍼 스티커라 타깃이 될 수 없습니다` : letter}
				disabled={disabled || locked.has(letter) || full}
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
	/*
	 * 잠긴 버퍼 문자. 색 외의 신호가 둘이다 — 파선 테두리와 취소선.
	 * 흑백으로 인쇄해도 구분된다.
	 */
	.keys button[data-blocked='true'] {
		border-style: dashed;
		text-decoration: line-through;
	}
	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.25rem;
	}
	.actions button {
		font-family: var(--sans);
		font-size: 0.85rem;
		color: var(--muted);
	}
</style>
