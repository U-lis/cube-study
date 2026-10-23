<!--
  무브 입력 키패드 (FR-17).
  조회(FR-3)와 달리 여기서는 버튼을 쓴다. 프라임 문자가 모바일 키보드에서
  2단계 깊이에 있어 연속 입력이 끊기기 때문이다.
-->
<script lang="ts">
	const FACES = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
	const SUFFIXES = ['', "'", '2'] as const;
	const MAX_MOVES = 200;

	/**
	 * 면 18개 밖의 무브 줄들 (SPEC AD-3). M2 퀴즈가 `M·M'·M2` 와 `l·l'·r·r'` 을
	 * 넘긴다 — 그 세트의 공식이 쓰는 무브 전부다. 기본값 빈 배열이라 기존 호출부는
	 * 변경 없이 돈다.
	 */
	let {
		moves = $bindable<string[]>([]),
		extraRows = []
	}: { moves?: string[]; extraRows?: readonly (readonly string[])[] } = $props();

	function pushToken(token: string) {
		if (moves.length >= MAX_MOVES) return;
		moves = [...moves, token];
	}
	function undo() {
		moves = moves.slice(0, -1);
	}
	function clear() {
		moves = [];
	}
</script>

<div class="pad">
	{#each SUFFIXES as sfx (sfx)}
		<div class="row">
			{#each FACES as face (face)}
				<button
					type="button"
					data-move={face + sfx}
					onclick={() => pushToken(face + sfx)}
					disabled={moves.length >= MAX_MOVES}
				>
					<!-- 수식자 칸의 폭을 항상 예약해 면 글자가 어느 행에서나 같은 위치에 온다 -->
					<span class="face">{face}</span><span class="sfx">{sfx}</span>
				</button>
			{/each}
		</div>
	{/each}
	{#each extraRows as row, i (i)}
		<!-- 각 추가 행은 자기 길이에 맞춘 그리드다 (SPEC AD-3). -->
		<div class="row extra" style="grid-template-columns: repeat({row.length}, 1fr);">
			{#each row as token (token)}
				<button
					type="button"
					data-move={token}
					onclick={() => pushToken(token)}
					disabled={moves.length >= MAX_MOVES}
				>
					<span class="face">{token}</span>
				</button>
			{/each}
		</div>
	{/each}
	<div class="row actions">
		<button type="button" data-action="undo" onclick={undo} disabled={moves.length === 0}>
			되돌리기
		</button>
		<button type="button" data-action="clear" onclick={clear} disabled={moves.length === 0}>
			전체 지우기
		</button>
	</div>
</div>

<style>
	.pad {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.4rem;
	}
	button {
		min-height: 46px;
		font-family: var(--mono);
		font-size: 1.05rem;
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
	.face {
		display: inline-block;
	}
	.sfx {
		display: inline-block;
		width: 1ch;
		text-align: left;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.actions {
		grid-template-columns: 1fr 1fr;
		margin-top: 0.2rem;
	}
	.actions button {
		font-family: var(--sans);
		font-size: 0.9rem;
		color: var(--muted);
	}
</style>
