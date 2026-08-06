<!--
  무브 입력 키패드 (FR-17).
  조회(FR-3)와 달리 여기서는 버튼을 쓴다. 프라임 문자가 모바일 키보드에서
  2단계 깊이에 있어 연속 입력이 끊기기 때문이다.
-->
<script lang="ts">
	const FACES = ['U', 'L', 'F', 'R', 'B', 'D'] as const;
	const SUFFIXES = ['', "'", '2'] as const;
	const MAX_MOVES = 200;

	let { moves = $bindable<string[]>([]) }: { moves?: string[] } = $props();

	function push(face: string, suffix: string) {
		if (moves.length >= MAX_MOVES) return;
		moves = [...moves, face + suffix];
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
					onclick={() => push(face, sfx)}
					disabled={moves.length >= MAX_MOVES}
				>
					<!-- 수식자 칸의 폭을 항상 예약해 면 글자가 어느 행에서나 같은 위치에 온다 -->
					<span class="face">{face}</span><span class="sfx">{sfx}</span>
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
